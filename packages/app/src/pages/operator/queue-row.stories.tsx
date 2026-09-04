import { For } from "solid-js"
import { QueueRow } from "./queue-row"
import { slaClockView } from "./sla-clock"
import { fixtureQueuePage } from "./fixtures"
import type { IncidentRow, SlaSnapshot, TriageState } from "./types"

export default { title: "Operator/QueueRow" }

// Stories pin their own "now" so the page is the same every time it is opened. The fixture's
// deadlines are anchored, so the anchor has to be pinned to the same instant — otherwise the
// rows are measured against whenever the module happened to load and most of them read as
// breached, which is precisely what this page exists to make visible rather than hide.
const NOW = Date.parse("2026-09-05T10:00:00.000Z")

export const EveryState = () => {
  const page = fixtureQueuePage("all", NOW, NOW)
  return (
    <div class="max-w-2xl border border-border-base">
      <For each={page.rows}>
        {(incident) => (
          <QueueRow incident={incident} clock={slaClockView({ snapshot: incident.sla, serverNowMs: NOW })} onOpen={() => {}} />
        )}
      </For>
    </div>
  )
}

export const ServerClockUnknown = () => {
  const incident = fixtureQueuePage("all", NOW, NOW).rows[0]
  return (
    <div class="max-w-2xl border border-border-base">
      <QueueRow incident={incident} clock={slaClockView({ snapshot: incident.sla, serverNowMs: null })} onOpen={() => {}} />
    </div>
  )
}

function row(number: string, description: string, over: Partial<IncidentRow> & { sla: SlaSnapshot }): IncidentRow {
  return {
    number,
    priority: 2,
    description,
    assignedToMe: false,
    group: "Платежи",
    status: "New",
    triage: "not-started",
    ...over,
  }
}

const captured = new Date(NOW).toISOString()
const running = (remainingMs: number, capturedAt = captured): SlaSnapshot => ({
  clockState: "running",
  remainingMs,
  breachAt: new Date(NOW + remainingMs).toISOString(),
  capturedAt,
})

/**
 * Every timer tone on one page, from synthetic snapshots rather than the queue fixture. `hot` in
 * particular has no fixture row — nothing in the demo queue sits inside fifteen minutes — so
 * without this story the tone that matters most is never reviewed.
 */
export const EveryTone = () => {
  const rows: IncidentRow[] = [
    row("INC0000001", "calm — далеко до срока", { sla: running(6 * 3_600_000) }),
    row("INC0000002", "calm — суточная шкала", { sla: running(52 * 3_600_000) }),
    row("INC0000003", "warm — меньше двух часов", { sla: running(41 * 60_000) }),
    row("INC0000004", "hot — меньше пятнадцати минут", { sla: running(9 * 60_000) }),
    row("INC0000005", "breached — срок прошёл", {
      sla: { clockState: "breached", breachAt: new Date(NOW - 34 * 60_000).toISOString(), capturedAt: captured },
    }),
    row("INC0000006", "paused — часы на паузе", {
      sla: { clockState: "paused", remainingMs: 115 * 60_000, capturedAt: captured },
    }),
    row("INC0000007", "paused и устарело — пауза могла быть снята", {
      sla: { clockState: "paused", remainingMs: 115 * 60_000, capturedAt: new Date(NOW - 3 * 3_600_000).toISOString() },
    }),
    row("INC0000008", "stale — снимок старше порога, счёт остановлен", {
      sla: running(4 * 3_600_000, new Date(NOW - 240_000).toISOString()),
    }),
    row("INC0000009", "none — SLA не задан", { sla: { clockState: "none", capturedAt: captured } }),
  ]
  return (
    <div class="max-w-2xl border border-border-base">
      <For each={rows}>
        {(incident) => (
          <QueueRow incident={incident} clock={slaClockView({ snapshot: incident.sla, serverNowMs: NOW })} onOpen={() => {}} />
        )}
      </For>
    </div>
  )
}

/**
 * Every triage chip, including `interrupted` — which no fixture produces, so it renders nowhere
 * else in the app. "Состояние неизвестно" is here too: it must never be mistaken for "разбор не
 * начат", which is a claim about the world we cannot make when the AI service is unreachable.
 */
export const EveryTriageState = () => {
  const states: TriageState[] = ["ready", "running", "interrupted", "not-started", "nothing-to-triage", "unknown"]
  return (
    <div class="max-w-2xl border border-border-base">
      <For each={states}>
        {(triage, i) => {
          const incident = row(`INC000001${i()}`, `состояние разбора: ${triage}`, { triage, sla: running(3 * 3_600_000) })
          return <QueueRow incident={incident} clock={slaClockView({ snapshot: incident.sla, serverNowMs: NOW })} onOpen={() => {}} />
        }}
      </For>
    </div>
  )
}
