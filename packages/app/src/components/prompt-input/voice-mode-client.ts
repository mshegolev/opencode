import { encodeWav, startRecording, type RecorderOptions } from "./voice"
import {
  VOICE_MODE_PROTOCOL_VERSION,
  parseVoiceModeEvent,
  shouldCommitTranscript,
  type VoiceModeServerEvent,
} from "./voice-mode"

export type VoiceModeSocket = {
  readonly readyState: number
  binaryType: BinaryType
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  send(data: string | ArrayBuffer | Blob): void
  close(code?: number, reason?: string): void
}

export type VoiceModeAudioChunk = {
  data: Uint8Array
  turnId?: string
  mimeType?: string
}

type VoiceModeRecording = Awaited<ReturnType<typeof startRecording>>

export type VoiceModeClientOptions = {
  url: string
  socketFactory?: (url: string) => VoiceModeSocket
  recordingFactory?: (options: RecorderOptions) => Promise<VoiceModeRecording>
  reconnect?: boolean
  reconnectDelayMs?: number
  onEvent?: (event: VoiceModeServerEvent) => void
  onAudio?: (chunk: VoiceModeAudioChunk) => void
  onState?: (state: "connecting" | "reconnecting" | "closed" | "error", message?: string) => void
  onTranscriptFinal?: (event: Extract<VoiceModeServerEvent, { type: "transcript.final" }>) => void
}

const OPEN = 1
const DEFAULT_RECONNECT_DELAY_MS = 500

export class VoiceModeClient {
  private readonly options: VoiceModeClientOptions
  private socket: VoiceModeSocket | undefined
  private recording: VoiceModeRecording | undefined
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined
  private reconnectAttempt = 0
  private captureGeneration = 0
  private closed = true
  private sessionStarted = false
  private muted = false
  private committing = false
  private readonly committedTurnIds = new Set<string>()

  constructor(options: VoiceModeClientOptions) {
    this.options = options
  }

  open() {
    this.closed = false
    this.muted = false
    this.options.onState?.("connecting")
    this.connect()
  }

  close() {
    this.closed = true
    this.sessionStarted = false
    this.muted = true
    this.captureGeneration += 1
    this.clearReconnectTimer()
    this.cancelCapture()
    const socket = this.socket
    if (socket?.readyState === OPEN) this.send({ type: "session.stop", version: VOICE_MODE_PROTOCOL_VERSION })
    this.socket = undefined
    socket?.close(1000, "voice mode closed")
    this.options.onState?.("closed")
  }

  mute() {
    this.muted = true
    this.captureGeneration += 1
    this.cancelCapture()
  }

  unmute() {
    this.muted = false
    if (this.sessionStarted) void this.startCapture()
  }

  stopTurn() {
    return this.commitTurn()
  }

  cancelResponse() {
    this.send({ type: "response.cancel", version: VOICE_MODE_PROTOCOL_VERSION })
  }

  private connect() {
    if (this.closed) return
    const factory = this.options.socketFactory ?? ((url: string): VoiceModeSocket => new WebSocket(url))
    const socket = factory(this.options.url)
    socket.binaryType = "arraybuffer"
    this.socket = socket
    socket.onopen = () => {
      if (this.closed || this.socket !== socket) return
      this.reconnectAttempt = 0
      this.send({ type: "session.start", version: VOICE_MODE_PROTOCOL_VERSION })
    }
    socket.onmessage = (event) => {
      if (this.closed || this.socket !== socket) return
      void this.handleMessage(event.data)
    }
    socket.onerror = () => {
      if (this.closed || this.socket !== socket) return
      this.options.onState?.("error", "Voice Mode WebSocket error")
    }
    socket.onclose = () => {
      if (this.socket === socket) this.socket = undefined
      this.sessionStarted = false
      this.captureGeneration += 1
      this.cancelCapture()
      if (this.closed) {
        this.options.onState?.("closed")
        return
      }
      if (this.options.reconnect === false) {
        this.options.onState?.("error", "Voice Mode connection closed")
        return
      }
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.closed) return
    this.options.onState?.("reconnecting")
    const base = this.options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS
    const delay = Math.min(8000, base * 2 ** this.reconnectAttempt)
    this.reconnectAttempt += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      this.connect()
    }, delay)
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = undefined
  }

  private send(value: Record<string, unknown>) {
    const socket = this.socket
    if (!socket || socket.readyState !== OPEN) return false
    socket.send(JSON.stringify(value))
    return true
  }

  private async handleMessage(data: unknown) {
    if (typeof data === "string") {
      this.handleText(data)
      return
    }
    if (data instanceof ArrayBuffer) {
      this.options.onAudio?.({ data: new Uint8Array(data) })
      return
    }
    if (data instanceof Blob) {
      if (data.type === "application/json" || data.type === "text/json") {
        this.handleText(await data.text())
        return
      }
      this.options.onAudio?.({ data: new Uint8Array(await data.arrayBuffer()), mimeType: data.type || undefined })
    }
  }

  private handleText(data: string) {
    const event = parseVoiceModeEvent(data)
    if (!event) return
    if (event.type === "session.started") {
      this.sessionStarted = true
      if (!this.muted) {
        void this.startCapture().catch((error: unknown) => {
          this.cancelCapture()
          this.options.onState?.("error", error instanceof Error ? error.message : "Microphone unavailable")
        })
      }
    }
    if (event.type === "transcript.final") {
      const previous = { phase: "closed" as const, committedTurnIds: [...this.committedTurnIds] }
      if (!shouldCommitTranscript(previous, event)) return
      this.committedTurnIds.add(event.turnId)
      this.options.onTranscriptFinal?.(event)
    }
    if (event.type === "assistant.audio.delta") {
      this.options.onAudio?.({
        data: decodeBase64(event.audio),
        turnId: event.turnId,
        mimeType: event.format,
      })
    }
    this.options.onEvent?.(event)
  }

  private async startCapture() {
    if (this.closed || this.muted || this.recording || !this.sessionStarted) return
    const generation = this.captureGeneration
    const factory = this.options.recordingFactory ?? startRecording
    const recording = await factory({
      onSilence: () => void this.commitTurn(generation),
      onLimit: () => void this.commitTurn(generation),
    })
    if (this.closed || this.muted || generation !== this.captureGeneration) {
      await recording.cancel()
      return
    }
    this.recording = recording
  }

  private async commitTurn(generation = this.captureGeneration) {
    if (this.committing || generation !== this.captureGeneration) return
    const recording = this.recording
    if (!recording) {
      this.sendCommit()
      return
    }
    this.recording = undefined
    this.committing = true
    try {
      const recorded = await recording.stop()
      if (this.closed || this.muted || generation !== this.captureGeneration) return
      if (recorded) this.sendAudio(recorded.audio)
      this.sendCommit()
    } finally {
      this.committing = false
      if (!this.closed && !this.muted && this.sessionStarted) void this.startCapture()
    }
  }

  private sendCommit() {
    this.send({ type: "input_audio.commit", version: VOICE_MODE_PROTOCOL_VERSION })
  }

  private sendAudio(data: Blob) {
    const socket = this.socket
    if (!socket || socket.readyState !== OPEN) return false
    socket.send(data)
    return true
  }

  private cancelCapture() {
    const recording = this.recording
    this.recording = undefined
    if (recording) void recording.cancel()
  }
}

export class VoiceModeAudioPlayer {
  private context: AudioContext | undefined
  private readonly sources = new Set<AudioBufferSourceNode>()
  private nextStart = 0

  async play(chunk: VoiceModeAudioChunk) {
    const context = this.context ?? (this.context = new AudioContext())
    await context.resume()
    const buffer = await context.decodeAudioData(chunk.data.slice().buffer)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    const start = Math.max(context.currentTime, this.nextStart)
    this.nextStart = start + buffer.duration
    this.sources.add(source)
    source.onended = () => this.sources.delete(source)
    source.start(start)
  }

  stop() {
    this.sources.forEach((source) => source.stop())
    this.sources.clear()
    this.nextStart = 0
  }

  close() {
    this.stop()
    const context = this.context
    this.context = undefined
    void context?.close()
  }
}

export function decodeBase64(value: string) {
  const binary = atob(value)
  const data = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) data[index] = binary.charCodeAt(index)
  return data
}

export function emptyVoiceWav() {
  return encodeWav(new Float32Array(), 16000)
}
