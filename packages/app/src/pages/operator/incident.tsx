import { createSignal, Show } from "solid-js"
import { useParams } from "@solidjs/router"
import { useQuery } from "@tanstack/solid-query"
import { Link } from "@/components/link"
import { OperatorShell } from "./shell"
import { TriageFields } from "./triage-fields"
import { TriageTimeline } from "./triage-timeline"
import { fixtureTranscript } from "./fixtures"
import { readIncident, serverOffsetMs } from "./queue-data"
import { slaClockView } from "./sla-clock"
import { createTicker } from "./ticker"
import { triageLabel } from "./queue-row"

export default function Incident() {
  const params = useParams<{ number: string }>()
  const tick = createTicker()
  const [offset, setOffset] = createSignal<number | null>(null)

  const query = useQuery(() => ({
    queryKey: ["operator", "incident", params.number],
    queryFn: async () => {
      const detail = await readIncident(params.number)
      setOffset(serverOffsetMs(detail.serverTime, Date.now()))
      return detail
    },
  }))

  const serverNow = () => {
    tick()
    const o = offset()
    return o === null ? null : Date.now() + o
  }

  return (
    <OperatorShell>
      <Show
        when={query.data}
        fallback={<p class="p-4 text-sm text-text-weak">{query.isError ? "Инцидент не загрузился" : "Загружаю…"}</p>}
      >
        {(detail) => {
          const clock = () => slaClockView({ snapshot: detail().row.sla, serverNowMs: serverNow() })
          return (
            <div class="flex h-full flex-col">
              <div class="flex items-start gap-4 border-b border-border-base px-4 py-3">
                <div class="min-w-0 flex-1">
                  <h2 class="text-base font-semibold">{detail().row.description}</h2>
                  <div class="mt-0.5 flex gap-2.5 text-xs text-text-weak">
                    <span class="font-mono">{detail().row.number}</span>
                    <span>P{detail().row.priority}</span>
                    <span>{detail().row.group}</span>
                    <span>{triageLabel(detail().row.triage)}</span>
                  </div>
                </div>
                <div class="shrink-0 text-right font-mono tabular-nums">
                  <span class="block text-[32px] font-semibold">{clock().display}</span>
                  <span class="block text-[9px] uppercase tracking-wider text-text-weak">{clock().caption}</span>
                </div>
              </div>
              <Show when={detail().fromSnapshot}>
                <p
                  role="status"
                  class="border-b border-border-warning-base bg-background-strong px-4 py-1.5 text-xs text-icon-warning-base"
                >
                  Дочитать не удалось — показан снимок.
                </p>
              </Show>
              <div class="min-h-0 flex-1 overflow-y-auto p-4">
                <Show
                  when={detail().fields}
                  fallback={<p class="text-sm text-text-weak">Разбора нет: {triageLabel(detail().row.triage)}.</p>}
                >
                  {(fields) => <TriageFields fields={fields()} />}
                </Show>
                <Show when={detail().row.sessionId}>
                  {(sessionId) => {
                    const transcript = fixtureTranscript(sessionId())
                    return (
                      <details class="mt-4 rounded border border-border-base">
                        <summary class="cursor-pointer px-3 py-2 text-xs uppercase tracking-wide text-text-weak">
                          Лента разбора — {transcript.messages.length} сообщений
                        </summary>
                        <div class="border-t border-border-base p-3">
                          <TriageTimeline sessionId={sessionId()} messages={transcript.messages} parts={transcript.parts} />
                        </div>
                      </details>
                    )
                  }}
                </Show>
              </div>
              <div class="border-t border-border-base bg-background-strong px-4 py-2 text-xs text-text-weak">
                <Link href={`https://itsm.example/incident/${detail().row.number}`}>Открыть тикет в ITSM</Link>
              </div>
            </div>
          )
        }}
      </Show>
    </OperatorShell>
  )
}
