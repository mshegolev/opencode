import { createMemo, For, Show } from "solid-js"
import { useNavigate, useSearchParams } from "@solidjs/router"
import { useQuery } from "@tanstack/solid-query"
import { QueueRow } from "./queue-row"
import { QueueTabs } from "./queue-tabs"
import { EmptyQueueNotice, LoadFailedNotice, LoadingNotice, StaleProjectionBanner } from "./notices"
import { ingestStale, readQueue } from "./queue-data"
import { createServerClock } from "./server-clock"
import { slaClockView } from "./sla-clock"
import { OperatorShell } from "./shell"
import type { QueueScope } from "./types"

const SCOPES: QueueScope[] = ["mine", "group", "all"]

export default function Queue() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams<{ scope?: string }>()
  const serverClock = createServerClock()

  const scope = createMemo<QueueScope>(() => {
    const raw = params.scope
    return SCOPES.includes(raw as QueueScope) ? (raw as QueueScope) : "mine"
  })

  const query = useQuery(() => ({
    queryKey: ["operator", "queue", scope()],
    queryFn: async () => {
      const page = await readQueue(scope())
      serverClock.setFromServerTime(page.serverTime)
      return page
    },
    refetchInterval: 30_000,
  }))

  return (
    <OperatorShell>
      <Show
        when={query.data}
        fallback={
          query.isError ? <LoadFailedNotice>Очередь не загрузилась</LoadFailedNotice> : <LoadingNotice>Загружаю очередь…</LoadingNotice>
        }
      >
        {(page) => (
          <div class="flex h-full flex-col">
            <QueueTabs scope={scope()} counts={page().counts} onSelect={(next) => setParams({ scope: next })} />
            <Show when={serverClock.serverNow() !== null && ingestStale(page(), serverClock.serverNow()!)}>
              <StaleProjectionBanner />
            </Show>
            <Show when={page().rows.length > 0} fallback={<EmptyQueueNotice scope={scope()} />}>
              <div class="min-h-0 flex-1 overflow-y-auto">
                <For each={page().rows}>
                  {(incident) => (
                    <QueueRow
                      incident={incident}
                      clock={slaClockView({ snapshot: incident.sla, serverNowMs: serverClock.serverNow() })}
                      onOpen={(number) => navigate(`/queue/${number}`)}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
        )}
      </Show>
    </OperatorShell>
  )
}
