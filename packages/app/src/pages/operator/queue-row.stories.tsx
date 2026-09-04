import { For } from "solid-js"
import { QueueRow } from "./queue-row"
import { slaClockView } from "./sla-clock"
import { fixtureQueuePage } from "./fixtures"

export default { title: "Operator/QueueRow" }

export const EveryState = () => {
  const now = Date.parse("2026-09-05T10:00:00.000Z")
  const page = fixtureQueuePage("all", now)
  return (
    <div class="max-w-2xl border border-border-base">
      <For each={page.rows}>
        {(incident) => (
          <QueueRow incident={incident} clock={slaClockView({ snapshot: incident.sla, serverNowMs: now })} onOpen={() => {}} />
        )}
      </For>
    </div>
  )
}

export const ServerClockUnknown = () => {
  const now = Date.parse("2026-09-05T10:00:00.000Z")
  const incident = fixtureQueuePage("all", now).rows[0]
  return (
    <div class="max-w-2xl border border-border-base">
      <QueueRow incident={incident} clock={slaClockView({ snapshot: incident.sla, serverNowMs: null })} onOpen={() => {}} />
    </div>
  )
}
