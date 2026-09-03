import { describe, expect, test } from "bun:test"
import { parseVoiceConfig, voiceConfig } from "./voice-config"

function root(content?: string) {
  return {
    querySelector: () => (content === undefined ? null : { content }),
  }
}

describe("parseVoiceConfig", () => {
  test("reads enabled same-origin capabilities", () => {
    const content = encodeURIComponent(
      JSON.stringify({
        dictation: { enabled: true, batchUrl: "/chat/stt", silenceMs: 900 },
        mode: { enabled: true, realtimeUrl: "/chat/voice/ws" },
      }),
    )
    expect(parseVoiceConfig(content)).toEqual({
      dictation: { enabled: true, batchUrl: "/chat/stt", silenceMs: 900 },
      mode: { enabled: true, realtimeUrl: "/chat/voice/ws" },
    })
  })

  test("rejects malformed, external, and protocol-relative paths", () => {
    expect(parseVoiceConfig("not-json")).toBeUndefined()
    expect(
      parseVoiceConfig(
        encodeURIComponent(
          JSON.stringify({
            dictation: { enabled: true, batchUrl: "https://example.com/stt" },
            mode: { enabled: true, realtimeUrl: "//example.com/ws" },
          }),
        ),
      ),
    ).toEqual({})
  })

  test("bounds the silence interval", () => {
    expect(
      parseVoiceConfig(
        encodeURIComponent(JSON.stringify({ dictation: { enabled: true, batchUrl: "/stt", silenceMs: 10 } })),
      )?.dictation?.silenceMs,
    ).toBe(300)
  })
})

describe("voiceConfig", () => {
  test("prefers runtime configuration", () => {
    const content = encodeURIComponent(
      JSON.stringify({ dictation: { enabled: true, batchUrl: "/runtime", silenceMs: 1500 } }),
    )
    expect(voiceConfig(root(content), "/build").dictation?.batchUrl).toBe("/runtime")
  })

  test("uses the safe build fallback when runtime config is absent", () => {
    expect(voiceConfig(root(), "/build")).toEqual({
      dictation: { enabled: true, batchUrl: "/build", silenceMs: 1200 },
    })
    expect(voiceConfig(root(), "https://example.com/stt")).toEqual({})
  })
})
