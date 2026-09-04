import { describe, expect, test } from "bun:test"
import {
  VoiceError,
  detectVoiceActivity,
  downsample,
  encodeWav,
  mergeChunks,
  selectCaptureImplementation,
  separatorBefore,
  startRecording,
  transcribe,
  MAX_RECORDING_SECONDS,
  MIN_RECORDING_SECONDS,
  TARGET_SAMPLE_RATE,
  type Fetcher,
  type VoiceActivityState,
} from "./voice"

function readAscii(view: DataView, offset: number, length: number) {
  let out = ""
  for (let i = 0; i < length; i++) out += String.fromCharCode(view.getUint8(offset + i))
  return out
}

describe("mergeChunks", () => {
  test("concatenates chunks in order", () => {
    const merged = mergeChunks([new Float32Array([1, 2]), new Float32Array([3])])
    expect(Array.from(merged)).toEqual([1, 2, 3])
  })

  test("returns empty buffer for no chunks", () => {
    expect(mergeChunks([]).length).toBe(0)
  })
})

describe("downsample", () => {
  test("averages into the lower rate", () => {
    const out = downsample(new Float32Array([0, 1, 0, 1]), 32000, 16000)
    expect(out.length).toBe(2)
    expect(out[0]).toBeCloseTo(0.5, 5)
    expect(out[1]).toBeCloseTo(0.5, 5)
  })

  test("leaves the buffer alone when the target rate is not lower", () => {
    const input = new Float32Array([0.25, -0.25])
    expect(downsample(input, 16000, 16000)).toBe(input)
    expect(downsample(input, 8000, 16000)).toBe(input)
  })
})

describe("encodeWav", () => {
  test("writes a 16-bit mono PCM header for the given rate", async () => {
    const samples = new Float32Array([0, 1, -1])
    const view = new DataView(await encodeWav(samples, TARGET_SAMPLE_RATE).arrayBuffer())

    expect(readAscii(view, 0, 4)).toBe("RIFF")
    expect(readAscii(view, 8, 4)).toBe("WAVE")
    expect(readAscii(view, 12, 4)).toBe("fmt ")
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(TARGET_SAMPLE_RATE)
    expect(view.getUint32(28, true)).toBe(TARGET_SAMPLE_RATE * 2) // byte rate
    expect(view.getUint16(34, true)).toBe(16) // bits per sample
    expect(readAscii(view, 36, 4)).toBe("data")
    expect(view.getUint32(40, true)).toBe(samples.length * 2)
    expect(view.byteLength).toBe(44 + samples.length * 2)
  })

  test("clamps samples outside [-1, 1]", async () => {
    const view = new DataView(await encodeWav(new Float32Array([2, -2]), TARGET_SAMPLE_RATE).arrayBuffer())
    expect(view.getInt16(44, true)).toBe(32767)
    expect(view.getInt16(46, true)).toBe(-32768)
  })
})

describe("detectVoiceActivity", () => {
  const quiet = new Float32Array(160)
  const speech = new Float32Array(160).fill(0.1)
  const initial = (): VoiceActivityState => ({ speechStarted: false, voicedMs: 0, finalized: false })
  const options = { minSpeechMs: 20, silenceMs: 300 }

  test("does not finalize silence before speech", () => {
    const result = detectVoiceActivity(initial(), quiet, 16000, 1000, options)
    expect(result.event).toBeUndefined()
    expect(result.state.speechStarted).toBeFalse()
  })

  test("emits speech start after sustained voiced frames", () => {
    const first = detectVoiceActivity(initial(), speech, 16000, 1000, options)
    const second = detectVoiceActivity(first.state, speech, 16000, 1010, options)
    expect(second.event).toBe("speech-started")
    expect(second.state.speechStarted).toBeTrue()
  })

  test("emits silence once after speech", () => {
    const started: VoiceActivityState = {
      speechStarted: true,
      voicedMs: 20,
      lastVoiceAt: 1000,
      finalized: false,
    }
    const waiting = detectVoiceActivity(started, quiet, 16000, 1299, options)
    expect(waiting.event).toBeUndefined()
    const silence = detectVoiceActivity(waiting.state, quiet, 16000, 1300, options)
    expect(silence.event).toBe("silence")
    expect(detectVoiceActivity(silence.state, quiet, 16000, 1600, options).event).toBeUndefined()
  })
})

type FakeProcessor = {
  onaudioprocess: ((event: { inputBuffer: { getChannelData(channel: number): Float32Array } }) => void) | null
}

/**
 * Stands in for the browser audio stack, so the recorder can be driven frame by
 * frame on a clock the test owns instead of waiting on a real microphone.
 */
function installFakeAudio({ sampleRate = 16000 } = {}) {
  const original = {
    AudioContext: globalThis.AudioContext,
    secureContext: Object.getOwnPropertyDescriptor(globalThis, "isSecureContext"),
    navigator: globalThis.navigator,
    now: Date.now,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
  }
  const counts = { processorDisconnected: 0, contextClosed: 0, trackStopped: 0, intervalCleared: 0 }
  let processor: FakeProcessor | undefined
  let watchdog: (() => void) | undefined
  let clock = 0

  class FakeAudioContext {
    sampleRate = sampleRate
    destination = {}
    createMediaStreamSource() {
      return { connect() {}, disconnect() {} }
    }
    createScriptProcessor() {
      const created = {
        onaudioprocess: null,
        connect() {},
        disconnect() {
          counts.processorDisconnected++
        },
      }
      processor = created
      return created
    }
    close() {
      counts.contextClosed++
      return Promise.resolve()
    }
  }

  Object.defineProperty(globalThis, "isSecureContext", { configurable: true, value: true })
  Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: FakeAudioContext })
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async () => ({ getTracks: () => [{ stop: () => counts.trackStopped++ }] }),
      },
    },
  })
  Date.now = () => clock
  globalThis.setInterval = ((handler: () => void) => {
    watchdog = handler
    return 0
  }) as unknown as typeof setInterval
  globalThis.clearInterval = (() => {
    counts.intervalCleared++
  }) as unknown as typeof clearInterval

  return {
    counts,
    /** Delivers one capture frame, as the ScriptProcessor would. */
    feed(samples: Float32Array) {
      processor?.onaudioprocess?.({ inputBuffer: { getChannelData: () => samples } })
    },
    /** Runs the duration watchdog the recorder installed. */
    tick() {
      watchdog?.()
    },
    advance(ms: number) {
      clock += ms
    },
    restore() {
      if (original.secureContext) Object.defineProperty(globalThis, "isSecureContext", original.secureContext)
      else Reflect.deleteProperty(globalThis, "isSecureContext")
      Date.now = original.now
      globalThis.setInterval = original.setInterval
      globalThis.clearInterval = original.clearInterval
      Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: original.AudioContext })
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: original.navigator })
    },
  }
}

const loud = () => new Float32Array(160).fill(0.1)
const quiet = () => new Float32Array(160)

describe("detectVoiceActivity calibration", () => {
  const idle = (): VoiceActivityState => ({ speechStarted: false, voicedMs: 0, finalized: false })

  /** Feeds frames of a constant amplitude and reports when speech was declared. */
  function speak(level: number, floorLevel: number, frames = 30) {
    let state = idle()
    let started = false
    let now = 0
    // Some room tone first, then the voice: the quiet part is what the detector
    // has to learn from.
    for (const amplitude of [...Array(10).fill(floorLevel), ...Array(frames).fill(level)]) {
      now += 10
      const next = detectVoiceActivity(state, new Float32Array(160).fill(amplitude), 16000, now, { minSpeechMs: 60 })
      state = next.state
      if (next.event === "speech-started") started = true
    }
    return started
  }

  test("hears a quiet microphone in a quiet room", () => {
    // Far below the 0.015 constant this replaced: on such a microphone nothing
    // was ever detected, so no phrase ever ended and the button looked dead.
    expect(speak(0.006, 0.0008)).toBe(true)
  })

  test("does not mistake a noisy room for speech", () => {
    // Above that same constant, which called steady room tone "speech" and left
    // a phrase that never ended.
    expect(speak(0.02, 0.02)).toBe(false)
  })

  test("still hears speech over that noisy room", () => {
    expect(speak(0.12, 0.02)).toBe(true)
  })

  test("an explicit threshold overrides what was learned", () => {
    let state = idle()
    const loud = new Float32Array(160).fill(0.05)
    const first = detectVoiceActivity(state, loud, 16000, 10, { minSpeechMs: 10, speechThreshold: 0.5 })
    expect(first.event).toBeUndefined()
    const second = detectVoiceActivity(state, loud, 16000, 20, { minSpeechMs: 10, speechThreshold: 0.01 })
    expect(second.event).toBe("speech-started")
  })
})

describe("recorder capture", () => {
  test("selects AudioWorklet only when both APIs are available", () => {
    expect(selectCaptureImplementation({}, false)).toBe("script-processor")
    expect(selectCaptureImplementation({ audioWorklet: { addModule: async () => {} } }, false)).toBe("script-processor")
    expect(selectCaptureImplementation({ audioWorklet: { addModule: async () => {} } }, true)).toBe("audio-worklet")
  })

  test("names an insecure page as the reason, not a missing microphone API", async () => {
    const originalSecure = Object.getOwnPropertyDescriptor(globalThis, "isSecureContext")
    const originalNavigator = globalThis.navigator
    Object.defineProperty(globalThis, "isSecureContext", { configurable: true, value: false })
    // A microphone API is present: only the origin disqualifies this page.
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) } },
    })
    try {
      const error = await startRecording().catch((reason: unknown) => reason)
      expect(error).toBeInstanceOf(VoiceError)
      expect((error as VoiceError).message).toContain("https")
    } finally {
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: originalNavigator })
      if (originalSecure) Object.defineProperty(globalThis, "isSecureContext", originalSecure)
      else Reflect.deleteProperty(globalThis, "isSecureContext")
    }
  })

  test("resamples a 48 kHz capture, the rate Windows and Chrome usually pick", async () => {
    const audio = installFakeAudio({ sampleRate: 48000 })
    let silenceCalls = 0
    try {
      // 480 samples is 10 ms at 48 kHz, the same frame duration as 160 at 16 kHz,
      // so the voice-activity rules must land on the same decisions.
      const frame = (fill: number) => new Float32Array(480).fill(fill)
      const handle = await startRecording({ minSpeechMs: 20, silenceMs: 300, onSilence: () => silenceCalls++ })
      audio.feed(frame(0.1))
      audio.advance(10)
      audio.feed(frame(0.1))
      audio.advance(300)
      audio.feed(frame(0))
      expect(silenceCalls).toBe(1)
      audio.advance(700)
      const recorded = await handle.stop()
      // 1440 captured samples at 48 kHz become 480 at the 16 kHz target.
      expect(recorded?.audio.size).toBe(44 + 480 * 2)
    } finally {
      audio.restore()
    }
  })

  test("refuses to record when the browser exposes no microphone API", async () => {
    const originalNavigator = globalThis.navigator
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} })
    try {
      await expect(startRecording()).rejects.toBeInstanceOf(VoiceError)
    } finally {
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: originalNavigator })
    }
  })

  test("cleans up the ScriptProcessor fallback and is safe to cancel twice", async () => {
    const audio = installFakeAudio()
    let silenceCalls = 0
    try {
      const handle = await startRecording({ minSpeechMs: 20, silenceMs: 300, onSilence: () => silenceCalls++ })
      audio.advance(1000)
      audio.feed(loud())
      audio.advance(10)
      audio.feed(loud())
      audio.advance(300)
      audio.feed(quiet())
      audio.advance(300)
      audio.feed(quiet())
      expect(silenceCalls).toBe(1)
      await handle.cancel()
      await handle.cancel()
      expect(audio.counts.processorDisconnected).toBe(1)
      expect(audio.counts.contextClosed).toBe(1)
      expect(audio.counts.trackStopped).toBe(1)
      expect(audio.counts.intervalCleared).toBe(1)
    } finally {
      audio.restore()
    }
  })

  test("stop returns the captured audio as WAV and releases the microphone", async () => {
    const audio = installFakeAudio()
    try {
      const handle = await startRecording()
      audio.feed(loud())
      audio.feed(loud())
      audio.advance(1000)
      const recorded = await handle.stop()
      expect(recorded?.seconds).toBe(1)
      expect(recorded?.audio.type).toBe("audio/wav")
      // 320 captured samples at the target rate, so no resampling: header + 16-bit frames.
      expect(recorded?.audio.size).toBe(44 + 320 * 2)
      expect(audio.counts.processorDisconnected).toBe(1)
      expect(audio.counts.contextClosed).toBe(1)
      expect(audio.counts.trackStopped).toBe(1)
      expect(audio.counts.intervalCleared).toBe(1)
    } finally {
      audio.restore()
    }
  })

  test("stop discards a mis-click shorter than the minimum, still releasing the microphone", async () => {
    const audio = installFakeAudio()
    try {
      const handle = await startRecording()
      audio.feed(loud())
      audio.advance(MIN_RECORDING_SECONDS * 1000 - 1)
      expect(await handle.stop()).toBeUndefined()
      expect(audio.counts.trackStopped).toBe(1)
      expect(audio.counts.contextClosed).toBe(1)
    } finally {
      audio.restore()
    }
  })

  test("flush cuts a segment and keeps the microphone open", async () => {
    const audio = installFakeAudio()
    let silenceCalls = 0
    try {
      const handle = await startRecording({ minSpeechMs: 20, silenceMs: 300, onSilence: () => silenceCalls++ })
      audio.advance(1000)
      audio.feed(loud())
      audio.advance(10)
      audio.feed(loud())
      audio.advance(300)
      audio.feed(quiet())
      expect(silenceCalls).toBe(1)

      const first = handle.flush()
      expect(first?.audio.size).toBe(44 + 480 * 2)
      // Still recording: nothing was released by cutting a segment.
      expect(audio.counts.trackStopped).toBe(0)
      expect(audio.counts.contextClosed).toBe(0)

      // The silence rule starts over, so the next pause is reported too.
      audio.advance(10)
      audio.feed(loud())
      audio.advance(10)
      audio.feed(loud())
      audio.advance(300)
      audio.feed(quiet())
      expect(silenceCalls).toBe(2)

      const second = handle.flush()
      // The second segment carries only what came after the first cut.
      expect(second?.audio.size).toBe(44 + 480 * 2)
      await handle.cancel()
      expect(audio.counts.trackStopped).toBe(1)
    } finally {
      audio.restore()
    }
  })

  test("flush returns nothing once the recorder is released", async () => {
    const audio = installFakeAudio()
    try {
      const handle = await startRecording()
      audio.feed(loud())
      audio.advance(1000)
      await handle.cancel()
      expect(handle.flush()).toBeUndefined()
    } finally {
      audio.restore()
    }
  })

  test("announces going idle once, when no speech follows for the idle window", async () => {
    const audio = installFakeAudio()
    let idleCalls = 0
    try {
      const handle = await startRecording({ minSpeechMs: 20, silenceMs: 300, idleMs: 2000, onIdle: () => idleCalls++ })
      audio.feed(loud())
      audio.advance(10)
      audio.feed(loud())
      audio.advance(1000)
      audio.tick()
      expect(idleCalls).toBe(0)
      audio.advance(1500)
      audio.tick()
      audio.tick()
      expect(idleCalls).toBe(1)
      await handle.cancel()
    } finally {
      audio.restore()
    }
  })

  test("speech keeps the idle window from expiring", async () => {
    const audio = installFakeAudio()
    let idleCalls = 0
    try {
      const handle = await startRecording({ minSpeechMs: 20, silenceMs: 300, idleMs: 1000, onIdle: () => idleCalls++ })
      for (let i = 0; i < 5; i++) {
        audio.advance(800)
        audio.feed(loud())
        audio.tick()
      }
      expect(idleCalls).toBe(0)
      await handle.cancel()
    } finally {
      audio.restore()
    }
  })

  test("the duration limit measures the current segment, not the whole session", async () => {
    const audio = installFakeAudio()
    let limitCalls = 0
    try {
      const handle = await startRecording({ onLimit: () => limitCalls++ })
      audio.feed(loud())
      audio.advance(MAX_RECORDING_SECONDS * 1000 - 100)
      handle.flush()
      audio.tick()
      // The clock passed the ceiling, but this segment did not.
      expect(limitCalls).toBe(0)
      audio.feed(loud())
      audio.advance(MAX_RECORDING_SECONDS * 1000)
      audio.tick()
      expect(limitCalls).toBe(1)
      await handle.cancel()
    } finally {
      audio.restore()
    }
  })

  test("announces the duration limit once, however often the watchdog runs", async () => {
    const audio = installFakeAudio()
    let limitCalls = 0
    try {
      const handle = await startRecording({ onLimit: () => limitCalls++ })
      audio.tick()
      expect(limitCalls).toBe(0)
      audio.advance(MAX_RECORDING_SECONDS * 1000)
      audio.tick()
      audio.tick()
      expect(limitCalls).toBe(1)
      await handle.cancel()
    } finally {
      audio.restore()
    }
  })
})

describe("separatorBefore", () => {
  test("keeps a dictated phrase from fusing with the one before it", () => {
    expect(separatorBefore("Первая фраза.")).toBe(" ")
  })

  test("adds nothing at the start of an empty draft", () => {
    expect(separatorBefore("")).toBe("")
  })

  test("does not double a separator the draft already has", () => {
    expect(separatorBefore("уже с пробелом ")).toBe("")
    expect(separatorBefore("после переноса\n")).toBe("")
  })
})

describe("transcribe", () => {
  const wav = new Blob([new Uint8Array(44)], { type: "audio/wav" })

  async function failure(fetcher: Fetcher) {
    let caught: unknown
    try {
      await transcribe(wav, "/stt", fetcher)
    } catch (error) {
      caught = error
    }
    if (!(caught instanceof VoiceError)) throw new Error(`expected a VoiceError, got ${String(caught)}`)
    return caught
  }

  test("posts the audio and returns the recognized text", async () => {
    let seen: { url: string; method?: string; headers: Headers } | undefined
    const fetcher: Fetcher = async (url, init) => {
      seen = { url, method: init.method, headers: new Headers(init.headers) }
      return new Response(JSON.stringify({ text: " hello ", model: "m", latency_ms: 12, no_speech_prob: 0.1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }

    const result = await transcribe(wav, "/stt", fetcher)

    expect(result.text).toBe("hello")
    expect(result.model).toBe("m")
    expect(result.latencyMs).toBe(12)
    expect(result.noSpeechProb).toBe(0.1)
    expect(seen?.url).toBe("/stt")
    expect(seen?.method).toBe("POST")
    expect(seen?.headers.get("content-type")).toBe("audio/wav")
  })

  test("names the failure when the endpoint rejects the audio", async () => {
    const error = await failure(
      async () => new Response(JSON.stringify({ detail: "stt_disabled: voice input is off" }), { status: 503 }),
    )

    expect(error.status).toBe(503)
    expect(error.message).toContain("stt_disabled")
  })

  test("names the failure when the network never answers", async () => {
    const error = await failure(async () => {
      throw new Error("offline")
    })

    expect(error.status).toBe(0)
  })

  test("rejects a success body without text instead of inserting nothing", async () => {
    const error = await failure(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))

    expect(error.message).toContain("no text")
  })
})
