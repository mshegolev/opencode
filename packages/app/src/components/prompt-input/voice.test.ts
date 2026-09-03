import { describe, expect, test } from "bun:test"
import { VoiceError, downsample, encodeWav, mergeChunks, transcribe, TARGET_SAMPLE_RATE, type Fetcher } from "./voice"

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
