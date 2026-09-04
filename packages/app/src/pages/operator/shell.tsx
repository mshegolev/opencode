import type { ParentProps } from "solid-js"

/**
 * Deliberately NOT `Layout`. Placement outside `<Route path="/:dir">` in `app.tsx` does not by
 * itself keep the developer chrome out — `Router`'s `root` (`RouterRoot`) wraps every route
 * regardless of nesting. What actually keeps it out is `RouterRoot` checking
 * `isOperatorPath(location.pathname)` (`./routes`) and skipping `AppShellProviders` — the
 * titlebar, project sidebar, and the terminals/models/permissions/prompt providers it nests —
 * for operator paths. This component only renders inside that bypass. Task 10 tests that this
 * stays true.
 */
export function OperatorShell(props: ParentProps) {
  return (
    <div class="flex h-full flex-col bg-background-base text-text-base">
      <header class="flex items-baseline gap-3 border-b border-border-base px-4 py-3">
        {/* Size and weight sit on the span: base.css resets them on h1–h6 outside Tailwind's
            layers, where an unlayered rule beats a layered utility. */}
        <h1>
          <span class="text-sm font-semibold text-text-strong">Инциденты</span>
        </h1>
        <span class="text-xs text-text-weak">разбор и очередь</span>
      </header>
      <div class="min-h-0 flex-1">{props.children}</div>
    </div>
  )
}
