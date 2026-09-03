import { describe, expect, test } from "bun:test"
import { initialVoiceModeState, parseVoiceModeEvent, reduceVoiceMode } from "./voice-mode"

describe("parseVoiceModeEvent", () => {
  test("accepts versioned transcript events", () => {
    expect(parseVoiceModeEvent('{"type":"transcript.partial","version":1,"turnId":"turn-1","text":"hello"}')).toEqual({
      type: "transcript.partial",
      version: 1,
      turnId: "turn-1",
      text: "hello",
    })
  })

  test("accepts the backend voice.v1 snake_case session contract", () => {
    expect(
      parseVoiceModeEvent(
        JSON.stringify({
          type: "session.started",
          version: 1,
          session_id: "voice-1",
          capabilities: { partials: true, tts: false, final_only: false },
        }),
      ),
    ).toEqual({
      type: "session.started",
      version: 1,
      sessionId: "voice-1",
      capabilities: { partials: true, tts: false, finalOnly: false },
    })
  })

  test("accepts backend snake_case turn ids", () => {
    expect(parseVoiceModeEvent(JSON.stringify({ type: "transcript.final", version: 1, turn_id: "turn-1", text: "hello" }))).toEqual({
      type: "transcript.final",
      version: 1,
      turnId: "turn-1",
      text: "hello",
    })
  })

  test("rejects malformed and unsupported events", () => {
    expect(parseVoiceModeEvent("not-json")).toBeUndefined()
    expect(parseVoiceModeEvent({ type: "speech.started", version: 2, turnId: "turn-1" })).toBeUndefined()
    expect(parseVoiceModeEvent({ type: "assistant.audio.delta", version: 1, turnId: "turn-1" })).toBeUndefined()
  })
})

describe("reduceVoiceMode", () => {
  test("moves through connection and response states", () => {
    const connecting = reduceVoiceMode(initialVoiceModeState(), { type: "open" }).state
    const listening = reduceVoiceMode(connecting, {
      type: "server",
      event: { type: "session.started", version: 1, sessionId: "voice-1" },
    }).state
    const thinking = reduceVoiceMode(listening, {
      type: "server",
      event: { type: "speech.stopped", version: 1, turnId: "turn-1" },
    }).state
    const speaking = reduceVoiceMode(thinking, {
      type: "server",
      event: { type: "assistant.audio.delta", version: 1, turnId: "turn-1", audio: "AA==" },
    }).state
    expect([connecting.phase, listening.phase, thinking.phase, speaking.phase]).toEqual([
      "connecting",
      "listening",
      "thinking",
      "speaking",
    ])
  })

  test("produces barge-in effects", () => {
    const result = reduceVoiceMode(
      { ...initialVoiceModeState(), phase: "speaking" },
      {
        type: "server",
        event: { type: "speech.started", version: 1, turnId: "turn-2" },
      },
    )
    expect(result.state.phase).toBe("listening")
    expect(result.effects).toEqual(["stop-playback", "cancel-response"])
  })

  test("does not duplicate committed turns across reconnect", () => {
    const committed = reduceVoiceMode(initialVoiceModeState(), {
      type: "server",
      event: { type: "transcript.final", version: 1, turnId: "turn-1", text: "hello" },
    }).state
    const reconnecting = reduceVoiceMode(committed, { type: "reconnect" }).state
    const duplicate = reduceVoiceMode(reconnecting, {
      type: "server",
      event: { type: "transcript.final", version: 1, turnId: "turn-1", text: "hello" },
    }).state
    expect(duplicate.committedTurnIds).toEqual(["turn-1"])
  })
})
