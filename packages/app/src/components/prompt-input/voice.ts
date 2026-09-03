/**
 * Voice input for the prompt: record from the microphone in the browser, send
 * the audio to a speech-to-text endpoint, get text back.
 *
 * The endpoint is configured at build time (`OPENCODE_VOICE_STT_URL`, exposed as
 * `import.meta.env.VITE_OPENCODE_VOICE_STT_URL`); with no endpoint configured the
 * button never appears, so a default build behaves exactly as before.
 *
 * Audio leaves the browser as 16 kHz mono 16-bit WAV, assembled here from raw
 * PCM rather than through `MediaRecorder`: WAV is the one container every
 * whisper-style endpoint accepts, while `MediaRecorder` produces webm/opus or
 * mp4 depending on the browser.
 */

export const TARGET_SAMPLE_RATE = 16000
export const MAX_RECORDING_SECONDS = 60
/** Shorter than this is a mis-click, not a phrase — nothing is sent. */
export const MIN_RECORDING_SECONDS = 0.5
/** Above this the endpoint says it heard speech, but does not believe it. */
export const NO_SPEECH_SUSPECT = 0.6

export type VoiceTranscript = {
  text: string
  model?: string
  language?: string
  latencyMs?: number
  noSpeechProb?: number
}

/** A failure that can be told to the user by name, never a silent empty result. */
export class VoiceError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "VoiceError"
    this.status = status
  }
}

export function sttEndpoint(): string {
  const configured = import.meta.env.VITE_OPENCODE_VOICE_STT_URL
  return typeof configured === "string" ? configured.trim() : ""
}

export function mergeChunks(chunks: Float32Array[]): Float32Array {
  let total = 0
  for (const chunk of chunks) total += chunk.length
  const merged = new Float32Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}

export function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (toRate >= fromRate) return buffer
  const ratio = fromRate / toRate
  const length = Math.floor(buffer.length / ratio)
  const result = new Float32Array(length)
  let offset = 0
  for (let i = 0; i < length; i++) {
    const next = Math.floor((i + 1) * ratio)
    let sum = 0
    let count = 0
    for (let j = offset; j < next && j < buffer.length; j++) {
      sum += buffer[j]
      count++
    }
    result[i] = count ? sum / count : 0
    offset = next
  }
  return result
}

export function encodeWav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }

  ascii(0, "RIFF")
  view.setUint32(4, 36 + samples.length * 2, true)
  ascii(8, "WAVE")
  ascii(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, "data")
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const sample = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }

  return new Blob([buffer], { type: "audio/wav" })
}

/** Just the part of `fetch` this module uses, so tests can stand in for it. */
export type Fetcher = (input: string, init: RequestInit) => Promise<Response>

export async function transcribe(audio: Blob, endpoint: string, fetcher: Fetcher = fetch): Promise<VoiceTranscript> {
  let response: Response
  try {
    response = await fetcher(endpoint, {
      method: "POST",
      headers: { "Content-Type": "audio/wav" },
      body: audio,
    })
  } catch (error) {
    throw new VoiceError(`network did not answer: ${error instanceof Error ? error.message : String(error)}`, 0)
  }

  let body: Record<string, unknown> | undefined
  try {
    const parsed: unknown = await response.json()
    if (parsed && typeof parsed === "object") body = { ...parsed }
  } catch {
    // The status code carries the outcome even when the body is not JSON.
  }

  if (!response.ok) {
    const detail = typeof body?.detail === "string" ? body.detail : "unknown reason"
    throw new VoiceError(detail, response.status)
  }

  if (typeof body?.text !== "string") {
    throw new VoiceError("response carried no text", response.status)
  }

  return {
    text: body.text.trim(),
    model: typeof body.model === "string" ? body.model : undefined,
    language: typeof body.language === "string" ? body.language : undefined,
    latencyMs: typeof body.latency_ms === "number" ? body.latency_ms : undefined,
    noSpeechProb: typeof body.no_speech_prob === "number" ? body.no_speech_prob : undefined,
  }
}

type RecorderHandle = {
  /** Stops capture and returns the recording as WAV, or undefined if too short. */
  stop(): Promise<{ audio: Blob; seconds: number } | undefined>
  /** Drops the recording and releases the microphone. */
  cancel(): Promise<void>
}

/**
 * Opens the microphone and captures mono PCM until stopped. Rejects with a
 * `VoiceError` when the browser has no microphone API or refuses access — a
 * denied permission and an absent device are different problems for the user.
 */
export async function startRecording(onLimit?: () => void): Promise<RecorderHandle> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new VoiceError("this browser exposes no microphone API", 0)
  }

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    })
  } catch (error) {
    throw new VoiceError(`microphone unavailable (${error instanceof Error ? error.name : "error"})`, 0)
  }

  const context = new AudioContext()
  const source = context.createMediaStreamSource(stream)
  // ScriptProcessor is deprecated but needs no separate worklet file, which keeps
  // the recorder a single module inside the bundle.
  const processor = context.createScriptProcessor(4096, 1, 1)
  const chunks: Float32Array[] = []
  const sampleRate = context.sampleRate
  const startedAt = Date.now()

  processor.onaudioprocess = (event) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))
  }
  source.connect(processor)
  processor.connect(context.destination)

  let released = false
  const release = async () => {
    if (released) return
    released = true
    clearInterval(limitTimer)
    processor.disconnect()
    source.disconnect()
    for (const track of stream.getTracks()) track.stop()
    await context.close()
  }

  const limitTimer = setInterval(() => {
    if (Date.now() - startedAt >= MAX_RECORDING_SECONDS * 1000) onLimit?.()
  }, 250)

  return {
    async stop() {
      const seconds = (Date.now() - startedAt) / 1000
      await release()
      const samples = mergeChunks(chunks)
      chunks.length = 0
      if (seconds < MIN_RECORDING_SECONDS || samples.length === 0) return undefined
      return { audio: encodeWav(downsample(samples, sampleRate, TARGET_SAMPLE_RATE), TARGET_SAMPLE_RATE), seconds }
    },
    async cancel() {
      await release()
      chunks.length = 0
    },
  }
}
