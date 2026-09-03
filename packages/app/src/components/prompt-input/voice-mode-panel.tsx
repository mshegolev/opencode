import { createSignal, onCleanup, onMount, type Component } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { useLanguage } from "@/context/language"
import {
  VoiceModeAudioPlayer,
  VoiceModeClient,
  type VoiceModeAudioChunk,
} from "./voice-mode-client"
import {
  initialVoiceModeState,
  reduceVoiceMode,
  type VoiceModeAction,
  type VoiceModeCapabilities,
  type VoiceModeServerEvent,
  type VoiceModeState,
} from "./voice-mode"

export type VoiceModePanelProps = {
  url: string
  onTranscriptFinal: (text: string, turnId: string) => void
  onAbort: () => Promise<void> | void
  onExit: () => void
}

export const VoiceModePanel: Component<VoiceModePanelProps> = (props) => {
  const language = useLanguage()
  const [state, setState] = createSignal<VoiceModeState>(initialVoiceModeState())
  const [partial, setPartial] = createSignal("")
  const [assistantText, setAssistantText] = createSignal("")
  const [capabilities, setCapabilities] = createSignal<VoiceModeCapabilities | undefined>()
  let client: VoiceModeClient | undefined
  const player = new VoiceModeAudioPlayer()

  const run = (action: VoiceModeAction) => {
    const result = reduceVoiceMode(state(), action)
    setState(result.state)
    for (const effect of result.effects) {
      if (effect === "stop-playback") player.stop()
      if (effect === "cancel-response") {
        client?.cancelResponse()
        void props.onAbort()
      }
    }
  }

  const event = (value: VoiceModeServerEvent) => {
    if (value.type === "session.started") {
      setCapabilities(value.capabilities)
      setPartial("")
      setAssistantText("")
    }
    if (value.type === "transcript.partial") setPartial(value.text)
    if (value.type === "transcript.final") {
      setPartial("")
      props.onTranscriptFinal(value.text, value.turnId)
    }
    if (value.type === "assistant.text.delta") setAssistantText((current) => current + value.text)
    run({ type: "server", event: value })
  }

  const audio = (chunk: VoiceModeAudioChunk) => {
    // Only provider-produced audio is played. There is no browser TTS fallback.
    if (capabilities()?.tts !== true) return
    void player.play(chunk).catch(() => {
      player.stop()
    })
  }

  const open = () => {
    client = new VoiceModeClient({
      url: props.url,
      onEvent: event,
      onAudio: audio,
      onState: (value, message) => {
        if (value === "connecting") run({ type: "open" })
        if (value === "reconnecting") run({ type: "reconnect" })
        if (value === "closed") run({ type: "close" })
        if (value === "error") run({ type: "transport-error", message: message ?? "Voice Mode connection failed" })
      },
    })
    client.open()
  }

  const mute = () => {
    if (state().phase === "muted") {
      client?.unmute()
      run({ type: "unmute" })
      return
    }
    client?.mute()
    run({ type: "mute" })
  }

  const exit = () => {
    client?.close()
    client = undefined
    player.close()
    run({ type: "close" })
    props.onExit()
  }

  onMount(open)
  onCleanup(() => {
    client?.close()
    player.close()
  })

  const phaseLabel = () => {
    const value = state().phase
    if (value === "closed") return language.t("prompt.voiceMode.status.closed")
    if (value === "connecting") return language.t("prompt.voiceMode.status.connecting")
    if (value === "listening") return language.t("prompt.voiceMode.status.listening")
    if (value === "thinking") return language.t("prompt.voiceMode.status.thinking")
    if (value === "speaking") return language.t("prompt.voiceMode.status.speaking")
    if (value === "muted") return language.t("prompt.voiceMode.status.muted")
    if (value === "reconnecting") return language.t("prompt.voiceMode.status.reconnecting")
    return language.t("prompt.voiceMode.status.error")
  }

  const capabilityLabel = () => {
    if (capabilities()?.tts === true) return language.t("prompt.voiceMode.capability.audio")
    if (capabilities()?.tts === false) return language.t("prompt.voiceMode.capability.textOnly")
    return language.t("prompt.voiceMode.capability.awaitingAudio")
  }

  return (
    <section
      data-component="voice-mode-panel"
      data-voice-mode-state={state().phase}
      class="mb-2 rounded-xl border border-border-weak-base bg-surface-panel px-3 py-3 shadow-xs"
      aria-live="polite"
    >
      <div class="flex items-center gap-2">
        <div
          class="flex size-9 items-center justify-center rounded-full bg-icon-info-active/15 text-icon-info-active"
          classList={{ "animate-pulse": state().phase === "listening" || state().phase === "speaking" }}
        >
          <Icon name={state().phase === "speaking" ? "prompt" : "microphone-recording"} />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-13-medium text-text-base">{language.t("prompt.voiceMode.title")}</div>
          <div class="text-12-regular text-text-weak">{phaseLabel()}</div>
        </div>
        <IconButton
          data-action="voice-mode-mute"
          type="button"
          variant="ghost"
          icon={state().phase === "muted" ? "microphone" : "microphone-recording"}
          aria-pressed={state().phase === "muted"}
          aria-label={
            state().phase === "muted"
              ? language.t("prompt.voiceMode.action.unmute")
              : language.t("prompt.voiceMode.action.mute")
          }
          onClick={mute}
          disabled={state().phase === "connecting" || state().phase === "reconnecting"}
        />
        <IconButton
          data-action="voice-mode-exit"
          type="button"
          variant="ghost"
          icon="close"
          aria-label={language.t("prompt.voiceMode.action.exit")}
          onClick={exit}
        />
      </div>
      <div class="mt-2 rounded-md bg-surface-raised px-2.5 py-2 text-12-regular text-text-weak">
        {capabilityLabel()}
      </div>
      <div class="mt-2 min-h-5 text-13-regular text-text-base">
        {partial() || assistantText()}
      </div>
      {state().error ? <div class="mt-2 text-12-regular text-icon-critical-active">{state().error}</div> : null}
      <div class="mt-3 flex justify-end">
        <Button type="button" variant="ghost" size="small" onClick={exit}>
          {language.t("prompt.voiceMode.action.close")}
        </Button>
      </div>
    </section>
  )
}
