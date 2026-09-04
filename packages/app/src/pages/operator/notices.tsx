import type { JSX } from "solid-js"
import { localHhMm } from "./sla-clock"
import type { QueueScope } from "./types"

/**
 * Everything this surface says when it has less than the whole truth. They live together
 * because the distinctions between them are the point: an empty queue is good news and must not
 * look like a failure, and a degraded read must say how degraded rather than merely that it is.
 * Presentational and context-free, so Storybook can lay them side by side — these are the states
 * seen once a month in production and never reviewed unless they are on one page.
 */

// The tinted surface carries the intent, the way the tab badges do; `text-on-warning-base` is
// the repo's pairing for text on a weak semantic surface (see the diagnostics block in
// `@opencode-ai/ui`'s message-part.css), and it stays readable where an icon colour would wash out.
const BANNER = "border-b border-border-warning-base bg-surface-warning-weak px-4 py-1.5 text-xs text-text-on-warning-base"

/** Queue-level. Ingest has gone quiet, so every row is stale at once — never a per-row mark. */
export function StaleProjectionBanner() {
  return (
    <p role="status" class={BANNER}>
      Данные могли устареть: события из ITSM не приходили дольше пяти минут.
    </p>
  )
}

/**
 * Incident-level. The live read failed and the projection's snapshot is on screen. It names the
 * capture time, because "a snapshot" without an age is unreadable: ten seconds old and ten hours
 * old call for opposite decisions, and the operator cannot tell them apart.
 */
export function SnapshotBanner(props: { capturedAt: string }) {
  return (
    <p role="status" class={BANNER}>
      Дочитать не удалось — показан снимок на {localHhMm(props.capturedAt)}.
    </p>
  )
}

/** Good news, and one line of it. Deliberately quiet, and deliberately not shaped like an error. */
export function EmptyQueueNotice(props: { scope: QueueScope }) {
  return <p class="p-4 text-sm text-text-weak">{props.scope === "mine" ? "На вас ничего не назначено" : "В очереди пусто"}</p>
}

/** In progress. Quiet, like the empty state — nothing has gone wrong yet. */
export function LoadingNotice(props: { children: JSX.Element }) {
  return <p class="p-4 text-sm text-text-weak">{props.children}</p>
}

/**
 * A failure, and it must not render like the empty state. An operator who reads "queue failed to
 * load" as "nothing assigned to you" stops looking, which is the worse of the two mistakes.
 */
export function LoadFailedNotice(props: { children: JSX.Element }) {
  return (
    <p
      role="alert"
      class="m-4 rounded border border-border-critical-base bg-surface-critical-weak px-3 py-2 text-sm text-text-on-critical-base"
    >
      {props.children}
    </p>
  )
}
