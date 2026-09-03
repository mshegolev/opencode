export const VOICE_MODE_PROTOCOL_VERSION = 1 as const

export type VoiceModePhase =
  | "closed"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "muted"
  | "reconnecting"
  | "error"

export type VoiceModeCapabilities = {
  tts?: boolean
  partials?: boolean
  finalOnly?: boolean
  audioFormat?: string
}

export type VoiceModeServerEvent =
  | { type: "session.started"; version: 1; sessionId: string; capabilities?: VoiceModeCapabilities }
  | { type: "speech.started"; version: 1; turnId: string }
  | { type: "speech.stopped"; version: 1; turnId: string }
  | { type: "transcript.partial"; version: 1; turnId: string; text: string }
  | { type: "transcript.final"; version: 1; turnId: string; text: string }
  | { type: "assistant.text.delta"; version: 1; turnId: string; text: string }
  | { type: "assistant.audio.delta"; version: 1; turnId: string; audio: string; format?: string }
  | { type: "response.completed"; version: 1; turnId: string }
  | { type: "error"; version: 1; code: string; message: string }

export type VoiceModeEffect = "stop-playback" | "cancel-response" | "close-resources"

export type VoiceModeState = {
  phase: VoiceModePhase
  committedTurnIds: string[]
  sessionId?: string
  error?: string
  capabilities?: VoiceModeCapabilities
}

export type VoiceModeAction =
  | { type: "open" }
  | { type: "mute" }
  | { type: "unmute" }
  | { type: "reconnect" }
  | { type: "close" }
  | { type: "server"; event: VoiceModeServerEvent }
  | { type: "transport-error"; message: string }

export function initialVoiceModeState(): VoiceModeState {
  return { phase: "closed", committedTurnIds: [] }
}

export function reduceVoiceMode(
  state: VoiceModeState,
  action: VoiceModeAction,
): { state: VoiceModeState; effects: VoiceModeEffect[] } {
  if (action.type === "open") return { state: { ...state, phase: "connecting", error: undefined }, effects: [] }
  if (action.type === "mute") return { state: { ...state, phase: "muted" }, effects: ["stop-playback"] }
  if (action.type === "unmute") return { state: { ...state, phase: "listening", error: undefined }, effects: [] }
  if (action.type === "reconnect") {
    return { state: { ...state, phase: "reconnecting", error: undefined }, effects: ["stop-playback"] }
  }
  if (action.type === "close") {
    return {
      state: { ...initialVoiceModeState(), committedTurnIds: state.committedTurnIds },
      effects: ["close-resources"],
    }
  }
  if (action.type === "transport-error") {
    return { state: { ...state, phase: "error", error: action.message }, effects: ["stop-playback"] }
  }

  const event = action.event
  if (event.type === "session.started") {
    return {
      state: { ...state, phase: "listening", sessionId: event.sessionId, capabilities: event.capabilities, error: undefined },
      effects: [],
    }
  }
  if (event.type === "speech.started") {
    const bargeIn = state.phase === "speaking"
    return { state: { ...state, phase: "listening" }, effects: bargeIn ? ["stop-playback", "cancel-response"] : [] }
  }
  if (event.type === "speech.stopped") return { state: { ...state, phase: "thinking" }, effects: [] }
  if (event.type === "transcript.final") {
    if (state.committedTurnIds.includes(event.turnId)) return { state, effects: [] }
    return { state: { ...state, committedTurnIds: [...state.committedTurnIds, event.turnId] }, effects: [] }
  }
  if (event.type === "assistant.text.delta") return { state: { ...state, phase: "thinking" }, effects: [] }
  if (event.type === "assistant.audio.delta") return { state: { ...state, phase: "speaking" }, effects: [] }
  if (event.type === "response.completed") {
    return { state: { ...state, phase: state.phase === "muted" ? "muted" : "listening" }, effects: [] }
  }
  if (event.type !== "error") return { state, effects: [] }
  return {
    state: { ...state, phase: "error", error: `${event.code}: ${event.message}` },
    effects: ["stop-playback"],
  }
}

export function shouldCommitTranscript(state: VoiceModeState, event: VoiceModeServerEvent) {
  return event.type === "transcript.final" && !state.committedTurnIds.includes(event.turnId)
}

export function parseVoiceModeEvent(input: unknown): VoiceModeServerEvent | undefined {
  const parsed = typeof input === "string" ? parseJson(input) : input
  if (!isRecord(parsed) || parsed.version !== VOICE_MODE_PROTOCOL_VERSION || typeof parsed.type !== "string") return undefined

  const sessionId = text(parsed.session_id) ? parsed.session_id : text(parsed.sessionId) ? parsed.sessionId : undefined
  if (parsed.type === "session.started" && sessionId) {
    return {
      type: parsed.type,
      version: VOICE_MODE_PROTOCOL_VERSION,
      sessionId,
      capabilities: capabilities(parsed.capabilities),
    }
  }
  const turnId = text(parsed.turn_id) ? parsed.turn_id : text(parsed.turnId) ? parsed.turnId : undefined
  if (
    (parsed.type === "speech.started" || parsed.type === "speech.stopped" || parsed.type === "response.completed") &&
    turnId
  ) {
    return { type: parsed.type, version: VOICE_MODE_PROTOCOL_VERSION, turnId }
  }
  if (
    (parsed.type === "transcript.partial" || parsed.type === "transcript.final" || parsed.type === "assistant.text.delta") &&
    turnId &&
    typeof parsed.text === "string"
  ) {
    return { type: parsed.type, version: VOICE_MODE_PROTOCOL_VERSION, turnId, text: parsed.text }
  }
  if (parsed.type === "assistant.audio.delta" && turnId && text(parsed.audio)) {
    return {
      type: parsed.type,
      version: VOICE_MODE_PROTOCOL_VERSION,
      turnId,
      audio: parsed.audio,
      format: text(parsed.format) ? parsed.format : undefined,
    }
  }
  if (parsed.type === "error" && text(parsed.code) && text(parsed.message)) {
    return { type: parsed.type, version: VOICE_MODE_PROTOCOL_VERSION, code: parsed.code, message: parsed.message }
  }
  return undefined
}

function capabilities(value: unknown): VoiceModeCapabilities | undefined {
  if (!isRecord(value)) return undefined
  const result: VoiceModeCapabilities = {}
  if (typeof value.tts === "boolean") result.tts = value.tts
  if (typeof value.partials === "boolean") result.partials = value.partials
  if (typeof value.final_only === "boolean") result.finalOnly = value.final_only
  if (typeof value.finalOnly === "boolean") result.finalOnly = value.finalOnly
  if (text(value.audioFormat)) result.audioFormat = value.audioFormat
  return Object.keys(result).length > 0 ? result : undefined
}

function parseJson(input: string): unknown {
  try {
    return JSON.parse(input)
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}
