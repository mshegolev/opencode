import { Show } from "solid-js"
import type { ClockView } from "./sla-clock"
import type { IncidentRow, TriageState } from "./types"

export function triageLabel(state: TriageState): string {
  switch (state) {
    case "ready": return "разбор готов"
    case "running": return "разбор идёт"
    case "interrupted": return "разбор прерван"
    case "not-started": return "разбор не начат"
    case "nothing-to-triage": return "нечего разбирать"
    case "unknown": return "состояние неизвестно"
  }
}

const TONE_TEXT: Record<ClockView["tone"], string> = {
  hot: "text-icon-critical-base",
  breached: "text-icon-critical-base",
  warm: "text-icon-warning-base",
  paused: "text-text-weak",
  calm: "text-text-base",
  none: "text-text-weak",
}

const CHIP_TONE: Record<TriageState, string> = {
  ready: "border-border-success-base text-icon-success-base",
  running: "border-border-warning-base text-icon-warning-base",
  interrupted: "border-border-critical-base text-icon-critical-base",
  "not-started": "border-border-base text-text-weak",
  "nothing-to-triage": "border-border-base text-text-weak",
  unknown: "border-border-base text-text-weak",
}

export function QueueRow(props: { incident: IncidentRow; clock: ClockView; onOpen: (number: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => props.onOpen(props.incident.number)}
      class={`w-full border-b border-border-base px-3 py-2 text-left hover:bg-surface-base-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-interactive-focus ${
        props.incident.assignedToMe ? "shadow-[inset_3px_0_0_var(--text-strong)]" : ""
      }`}
    >
      <div class="flex items-baseline gap-2.5">
        <span class="w-6 shrink-0 font-semibold tabular-nums">P{props.incident.priority}</span>
        <span class="min-w-0 flex-1 truncate font-medium">{props.incident.description}</span>
        <span class={`shrink-0 text-right font-mono tabular-nums ${TONE_TEXT[props.clock.tone]}`}>
          <span class="block text-sm font-semibold">{props.clock.display}</span>
          <span class="block text-[9px] uppercase tracking-wider text-text-weak">{props.clock.caption}</span>
        </span>
      </div>
      <div class="mt-0.5 flex items-center gap-2.5 pl-8 text-xs text-text-weak">
        <span class="font-mono">{props.incident.number}</span>
        <Show when={props.incident.assignedToMe}>
          <span>мне</span>
        </Show>
        <span class={`rounded-sm border px-1.5 text-[10px] uppercase tracking-wide ${CHIP_TONE[props.incident.triage]}`}>
          {triageLabel(props.incident.triage)}
        </span>
      </div>
    </button>
  )
}
