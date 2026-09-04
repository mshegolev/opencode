import { Show } from "solid-js"
import { useParams } from "@solidjs/router"
import { useQuery } from "@tanstack/solid-query"
import { Link } from "@/components/link"
import { OperatorShell } from "./shell"
import { TriageFields } from "./triage-fields"
import { TriageTimeline } from "./triage-timeline"
import { fixtureTranscript } from "./fixtures"
import { LoadFailedNotice, LoadingNotice, SnapshotBanner } from "./notices"
import { itsmIncidentUrl, readIncident } from "./queue-data"
import { createServerClock } from "./server-clock"
import { slaClockView } from "./sla-clock"
import { triageLabel } from "./queue-row"

export default function Incident() {
  const params = useParams<{ number: string }>()
  const serverClock = createServerClock()

  const query = useQuery(() => ({
    queryKey: ["operator", "incident", params.number],
    queryFn: async () => {
      const detail = await readIncident(params.number)
      serverClock.setFromServerTime(detail.serverTime)
      return detail
    },
  }))

  return (
    <OperatorShell>
      <Show
        when={query.data}
        fallback={
          query.isError ? <LoadFailedNotice>Инцидент не загрузился</LoadFailedNotice> : <LoadingNotice>Загружаю…</LoadingNotice>
        }
      >
        {(detail) => {
          const clock = () => slaClockView({ snapshot: detail().row.sla, serverNowMs: serverClock.serverNow() })
          return (
            <div class="flex h-full flex-col">
              <div class="flex items-start gap-4 border-b border-border-base px-4 py-3">
                <div class="min-w-0 flex-1">
                  {/*
                    Typography rides on a span, not on the heading. `packages/ui`'s base.css sets
                    `h1–h6 { font-size: inherit; font-weight: inherit }` outside Tailwind's layers,
                    and unlayered rules beat layered utilities — so a size or weight utility on the
                    heading itself silently loses. `text-base` is worse than useless here: this repo
                    declares BOTH `--text-base` (14px) and `--color-base`, and Tailwind resolves the
                    ambiguity to the colour, so it was painting the incident's title in
                    `rgba(0,0,0,0.034)` — very nearly invisible on a light background.
                  */}
                  <h2>
                    <span class="text-[14px] font-semibold text-text-strong">{detail().row.description}</span>
                  </h2>
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
                <SnapshotBanner capturedAt={detail().row.sla.capturedAt} />
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
                <Link href={itsmIncidentUrl(detail().row.number)}>Открыть тикет в ITSM</Link>
              </div>
            </div>
          )
        }}
      </Show>
    </OperatorShell>
  )
}
