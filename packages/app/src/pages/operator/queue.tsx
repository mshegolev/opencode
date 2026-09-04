import { createMemo, createSignal, For, Show } from "solid-js"
import { useNavigate, useSearchParams } from "@solidjs/router"
import { useQuery } from "@tanstack/solid-query"
import { QueueRow } from "./queue-row"
import { QueueTabs } from "./queue-tabs"
import { ingestStale, readQueue, serverOffsetMs } from "./queue-data"
import { slaClockView } from "./sla-clock"
import { createTicker } from "./ticker"
import { OperatorShell } from "./shell"
import type { QueueScope } from "./types"

const SCOPES: QueueScope[] = ["mine", "group", "all"]

export default function Queue() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams<{ scope?: string }>()
  const tick = createTicker()
  const [offset, setOffset] = createSignal<number | null>(null)

  const scope = createMemo<QueueScope>(() => {
    const raw = params.scope
    return SCOPES.includes(raw as QueueScope) ? (raw as QueueScope) : "mine"
  })

  const query = useQuery(() => ({
    queryKey: ["operator", "queue", scope()],
    queryFn: async () => {
      const page = await readQueue(scope())
      setOffset(serverOffsetMs(page.serverTime, Date.now()))
      return page
    },
    refetchInterval: 30_000,
  }))

  const serverNow = () => {
    tick()
    const o = offset()
    return o === null ? null : Date.now() + o
  }

  return (
    <OperatorShell>
      <Show when={query.data} fallback={<p class="p-4 text-sm text-text-weak">{query.isError ? "Очередь не загрузилась" : "Загружаю очередь…"}</p>}>
        {(page) => (
          <div class="flex h-full flex-col">
            <QueueTabs scope={scope()} counts={page().counts} onSelect={(next) => setParams({ scope: next })} />
            <Show when={serverNow() !== null && ingestStale(page(), serverNow()!)}>
              <p class="border-b border-border-warning-base bg-background-strong px-3 py-1.5 text-xs text-icon-warning-base">
                Данные могли устареть: события из ITSM не приходили дольше пяти минут.
              </p>
            </Show>
            <Show
              when={page().rows.length > 0}
              fallback={<p class="p-4 text-sm text-text-weak">{scope() === "mine" ? "На вас ничего не назначено" : "В очереди пусто"}</p>}
            >
              <div class="min-h-0 flex-1 overflow-y-auto">
                <For each={page().rows}>
                  {(incident) => (
                    <QueueRow
                      incident={incident}
                      clock={slaClockView({ snapshot: incident.sla, serverNowMs: serverNow() })}
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
