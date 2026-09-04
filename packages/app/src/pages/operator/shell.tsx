import type { ParentProps } from "solid-js"

/**
 * Deliberately NOT `Layout`. The operator shell mounts inside the base providers only —
 * no terminals, models, permissions or prompt. Task 10 tests that this stays true.
 */
export function OperatorShell(props: ParentProps) {
  return (
    <div class="flex h-full flex-col bg-background-base text-text-base">
      <header class="flex items-baseline gap-3 border-b border-border-base px-4 py-3">
        <h1 class="text-sm font-semibold">Инциденты</h1>
        <span class="text-xs text-text-weak">разбор и очередь</span>
      </header>
      <div class="min-h-0 flex-1">{props.children}</div>
    </div>
  )
}
