import { describe, expect, test } from "bun:test"
import { encodeWav, type RecorderOptions } from "./voice"
import { VoiceModeClient, decodeBase64, type VoiceModeSocket } from "./voice-mode-client"

class FakeSocket implements VoiceModeSocket {
  readyState = 0
  binaryType: BinaryType = "arraybuffer"
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  sent: (string | ArrayBuffer | Blob)[] = []

  send(data: string | ArrayBuffer | Blob) {
    this.sent.push(data)
  }

  close() {
    this.readyState = 3
    this.onclose?.({} as CloseEvent)
  }

  open() {
    this.readyState = 1
    this.onopen?.({} as Event)
  }

  message(data: string | ArrayBuffer | Blob) {
    this.onmessage?.({ data } as MessageEvent)
  }
}

describe("decodeBase64", () => {
  test("decodes provider audio at the transport boundary", () => {
    expect(Array.from(decodeBase64("AAEC/w=="))).toEqual([0, 1, 2, 255])
  })
})

describe("VoiceModeClient voice.v1 contract", () => {
  test("sends one valid WAV and commits the turn after VAD silence", async () => {
    const socket = new FakeSocket()
    let recorderOptions: RecorderOptions | undefined
    const client = new VoiceModeClient({
      url: "/chat/voice/ws",
      socketFactory: () => socket,
      recordingFactory: async (options) => {
        recorderOptions = options
        return {
          stop: async () => ({ audio: encodeWav(new Float32Array([0.1, -0.1]), 16000), seconds: 1 }),
          cancel: async () => {},
        }
      },
      reconnect: false,
    })

    client.open()
    socket.open()
    socket.message(
      JSON.stringify({
        type: "session.started",
        version: 1,
        session_id: "voice-1",
        capabilities: { partials: true, tts: false, final_only: false },
      }),
    )
    await Promise.resolve()
    recorderOptions?.onSilence?.()
    await Promise.resolve()
    await Promise.resolve()

    const audio = socket.sent[1]
    expect(audio).toBeInstanceOf(Blob)
    expect((audio as Blob).type).toBe("audio/wav")
    expect(new TextDecoder().decode(new Uint8Array(await (audio as Blob).arrayBuffer()).slice(0, 4))).toBe("RIFF")
    expect(socket.sent[2]).toBe(JSON.stringify({ type: "input_audio.commit", version: 1 }))
    client.close()
  })

  test("commits on manual stop and never sends MediaRecorder output", async () => {
    const socket = new FakeSocket()
    const client = new VoiceModeClient({
      url: "/chat/voice/ws",
      socketFactory: () => socket,
      recordingFactory: async () => ({
        stop: async () => ({ audio: encodeWav(new Float32Array([0.2]), 16000), seconds: 1 }),
        cancel: async () => {},
      }),
      reconnect: false,
    })
    client.open()
    socket.open()
    socket.message(JSON.stringify({ type: "session.started", version: 1, session_id: "voice-1" }))
    await Promise.resolve()
    await client.stopTurn()
    expect(socket.sent.filter((value) => typeof value === "string")).toEqual([
      JSON.stringify({ type: "session.start", version: 1 }),
      JSON.stringify({ type: "input_audio.commit", version: 1 }),
    ])
    expect(socket.sent.some((value) => typeof value !== "string" && !(value instanceof Blob))).toBeFalse()
    client.close()
  })

  test("deduplicates final turns across reconnects", () => {
    const socket = new FakeSocket()
    const finals: string[] = []
    const client = new VoiceModeClient({
      url: "/chat/voice/ws",
      socketFactory: () => socket,
      reconnect: false,
      onTranscriptFinal: (event) => finals.push(event.text),
    })
    client.open()
    socket.open()
    const final = JSON.stringify({ type: "transcript.final", version: 1, turnId: "turn-1", text: "hello" })
    socket.message(final)
    socket.message(final)
    expect(finals).toEqual(["hello"])
    client.close()
  })

  test("forwards JSON audio events and binary audio frames without synthesizing audio", () => {
    const socket = new FakeSocket()
    const chunks: Uint8Array[] = []
    const client = new VoiceModeClient({
      url: "/chat/voice/ws",
      socketFactory: () => socket,
      reconnect: false,
      onAudio: (chunk) => chunks.push(chunk.data),
    })
    client.open()
    socket.open()
    socket.message(JSON.stringify({ type: "assistant.audio.delta", version: 1, turn_id: "turn-1", audio: "AQI=" }))
    socket.message(new Uint8Array([3, 4]).buffer)
    expect(chunks.map((chunk) => Array.from(chunk))).toEqual([
      [1, 2],
      [3, 4],
    ])
    client.close()
  })

  test("reconnects after an unexpected close and cleanup cancels the retry", async () => {
    const first = new FakeSocket()
    const second = new FakeSocket()
    const sockets = [first, second]
    const states: string[] = []
    const client = new VoiceModeClient({
      url: "/chat/voice/ws",
      socketFactory: () => sockets.shift()!,
      reconnectDelayMs: 1,
      onState: (state) => states.push(state),
    })
    client.open()
    first.open()
    first.close()
    expect(states).toContain("reconnecting")
    client.close()
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(sockets).toEqual([second])
  })
})
