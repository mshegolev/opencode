import { For } from "solid-js"
import { TriageFields } from "./triage-fields"
import { fixtureIncidentDetail } from "./fixtures"
import type { TriageFieldSet } from "./types"

export default { title: "Operator/TriageFields" }

const NOW = Date.parse("2026-09-05T10:00:00.000Z")

export const Ready = () => {
  const detail = fixtureIncidentDetail("INC0048812", NOW, NOW)
  return <div class="max-w-2xl p-4">{detail.fields ? <TriageFields fields={detail.fields} /> : null}</div>
}

/**
 * All three confidence levels together. This is the field the design makes load-bearing, and the
 * check is that they are distinguishable at a glance — not only by the one word that differs.
 */
export const EveryConfidence = () => {
  const base = fixtureIncidentDetail("INC0048812", NOW, NOW).fields!
  const levels: TriageFieldSet["confidence"][] = ["high", "medium", "low"]
  return (
    <div class="max-w-2xl p-4">
      <For each={levels}>{(confidence) => <TriageFields fields={{ ...base, confidence }} />}</For>
    </div>
  )
}
