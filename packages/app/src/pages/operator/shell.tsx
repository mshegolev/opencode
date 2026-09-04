import type { ParentProps } from "solid-js"
import { DataProvider } from "@opencode-ai/ui/context"

/**
 * Deliberately NOT `Layout`. Placement outside `<Route path="/:dir">` in `app.tsx` does not by
 * itself keep the developer chrome out — `Router`'s `root` (`RouterRoot`) wraps every route
 * regardless of nesting. What actually keeps it out is `RouterRoot` checking
 * `isOperatorPath(location.pathname)` (`./routes`) and skipping `AppShellProviders` — the
 * titlebar, project sidebar, and the terminals/models/permissions/prompt providers it nests —
 * for operator paths. This component only renders inside that bypass. Task 10 tests that this
 * stays true.
 *
 * `DataProvider` is mounted here because `@opencode-ai/ui/message-part`'s `Message` component
 * calls `useData()` — it is a presentational component, not a context-free one. It is fed a
 * read-only store: no session list, no diffs, no status — only what the transcript reads.
 */
export function OperatorShell(props: ParentProps) {
  return (
    <DataProvider data={{ session: [], session_status: {}, session_diff: {}, message: {}, part: {} }} directory="">
      <div class="flex h-full flex-col bg-background-base text-text-base">
        <header class="flex items-baseline gap-3 border-b border-border-base px-4 py-3">
          <h1 class="text-sm font-semibold">Инциденты</h1>
          <span class="text-xs text-text-weak">разбор и очередь</span>
        </header>
        <div class="min-h-0 flex-1">{props.children}</div>
      </div>
    </DataProvider>
  )
}
