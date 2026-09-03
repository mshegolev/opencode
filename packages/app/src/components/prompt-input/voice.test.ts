import { describe, expect, test } from "bun:test"
import {
  VoiceError,
  detectVoiceActivity,
  downsample,
  encodeWav,
  mergeChunks,
  selectCaptureImplementation,
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
function installFakeAudio() {
  const original = {
    AudioContext: globalThis.AudioContext,
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
    sampleRate = 16000
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

describe("recorder capture", () => {
  test("selects AudioWorklet only when both APIs are available", () => {
    expect(selectCaptureImplementation({}, false)).toBe("script-processor")
    expect(selectCaptureImplementation({ audioWorklet: { addModule: async () => {} } }, false)).toBe("script-processor")
    expect(selectCaptureImplementation({ audioWorklet: { addModule: async () => {} } }, true)).toBe("audio-worklet")
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
