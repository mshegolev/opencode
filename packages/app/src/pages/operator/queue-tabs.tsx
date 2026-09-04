import { For, Show } from "solid-js"
import type { QueuePage, QueueScope } from "./types"

const LABEL: Record<QueueScope, string> = { mine: "На мне", group: "Очередь группы", all: "Все" }

export function QueueTabs(props: { scope: QueueScope; counts: QueuePage["counts"]; onSelect: (scope: QueueScope) => void }) {
  const scopes: QueueScope[] = ["mine", "group", "all"]
  return (
    <div role="tablist" class="flex border-b border-border-base bg-background-strong">
      <For each={scopes}>
        {(scope) => (
          <button
            type="button"
            role="tab"
            aria-selected={props.scope === scope}
            onClick={() => props.onSelect(scope)}
            class={`flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-interactive-focus ${
              props.scope === scope ? "border-text-strong font-semibold text-text-strong" : "border-transparent text-text-weak"
            }`}
          >
            <span>{LABEL[scope]}</span>
            <span class="rounded-full bg-surface-raised-base px-1.5 text-[10px] font-semibold tabular-nums">{props.counts[scope]}</span>
            {/* Counts for THIS tab, not for the queue as a whole: the badge's job is to say
                what this tab hides, and a global figure on the group tab would include the
                operator's own incidents, which this tab does not show. */}
            <Show when={scope !== "mine" && props.counts.ready[scope] > 0}>
              <span class="rounded-full bg-surface-success-weak px-1.5 text-[10px] font-semibold tabular-nums text-icon-success-base">
                {props.counts.ready[scope]} готово
              </span>
            </Show>
            <Show when={scope !== "mine" && props.counts.breached[scope] > 0}>
              <span class="rounded-full bg-surface-critical-weak px-1.5 text-[10px] font-semibold tabular-nums text-icon-critical-base">
                {props.counts.breached[scope]} нарушено
              </span>
            </Show>
          </button>
        )}
      </For>
    </div>
  )
}
