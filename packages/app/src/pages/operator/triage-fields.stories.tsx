import { TriageFields } from "./triage-fields"
import { fixtureIncidentDetail } from "./fixtures"

export default { title: "Operator/TriageFields" }

export const Ready = () => {
  const detail = fixtureIncidentDetail("INC0048812", Date.parse("2026-09-05T10:00:00.000Z"))
  return <div class="max-w-2xl p-4">{detail.fields ? <TriageFields fields={detail.fields} /> : null}</div>
}
