export type VoiceConfig = {
  dictation?: {
    enabled: boolean
    batchUrl: string
    silenceMs: number
  }
  mode?: {
    enabled: boolean
    realtimeUrl: string
  }
}

const DEFAULT_SILENCE_MS = 1200

export function voiceConfig(
  root: Pick<Document, "querySelector"> = document,
  fallback = import.meta.env.VITE_OPENCODE_VOICE_STT_URL,
): VoiceConfig {
  const content = root.querySelector<HTMLMetaElement>('meta[name="opencode-voice-config"]')?.content
  const runtime = parseVoiceConfig(content)
  if (runtime) return runtime
  const batchUrl = safePath(fallback)
  if (!batchUrl) return {}
  return { dictation: { enabled: true, batchUrl, silenceMs: DEFAULT_SILENCE_MS } }
}

export function parseVoiceConfig(content: string | undefined): VoiceConfig | undefined {
  if (!content) return undefined
  const decoded = decode(content)
  if (!isRecord(decoded)) return undefined
  const dictation = isRecord(decoded.dictation) ? decoded.dictation : undefined
  const mode = isRecord(decoded.mode) ? decoded.mode : undefined
  const batchUrl = safePath(dictation?.batchUrl)
  const realtimeUrl = safePath(mode?.realtimeUrl)
  const result: VoiceConfig = {}

  if (dictation?.enabled === true && batchUrl) {
    result.dictation = {
      enabled: true,
      batchUrl,
      silenceMs: silence(dictation.silenceMs),
    }
  }
  if (mode?.enabled === true && realtimeUrl) {
    result.mode = { enabled: true, realtimeUrl }
  }
  return result
}

function decode(content: string): unknown {
  try {
    const value: unknown = JSON.parse(decodeURIComponent(content))
    return value
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function safePath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const path = value.trim()
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return undefined
  return path
}

function silence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_SILENCE_MS
  return Math.min(5000, Math.max(300, Math.round(value)))
}
