import { EmptyQueueNotice, LoadFailedNotice, LoadingNotice, SnapshotBanner, StaleProjectionBanner } from "./notices"

export default { title: "Operator/Notices" }

/**
 * The pair the spec insists must not render identically. "Ничего не назначено" is good news;
 * "очередь не загрузилась" is a failure. Side by side is the only way to check that an operator
 * glancing at the screen can tell which one they are looking at.
 */
export const EmptyVersusFailed = () => (
  <div class="grid max-w-4xl grid-cols-2 gap-4">
    <div class="border border-border-base">
      <p class="border-b border-border-base px-3 py-1.5 text-[10px] uppercase tracking-wide text-text-weak">Хорошая новость</p>
      <EmptyQueueNotice scope="mine" />
    </div>
    <div class="border border-border-base">
      <p class="border-b border-border-base px-3 py-1.5 text-[10px] uppercase tracking-wide text-text-weak">Ошибка</p>
      <LoadFailedNotice>Очередь не загрузилась</LoadFailedNotice>
    </div>
    <div class="border border-border-base">
      <p class="border-b border-border-base px-3 py-1.5 text-[10px] uppercase tracking-wide text-text-weak">Пустая очередь группы</p>
      <EmptyQueueNotice scope="group" />
    </div>
    <div class="border border-border-base">
      <p class="border-b border-border-base px-3 py-1.5 text-[10px] uppercase tracking-wide text-text-weak">Ещё грузится</p>
      <LoadingNotice>Загружаю очередь…</LoadingNotice>
    </div>
  </div>
)

/** The projection has gone quiet: one banner over the whole queue, never a mark per row. */
export const StaleProjection = () => (
  <div class="max-w-2xl border border-border-base">
    <StaleProjectionBanner />
  </div>
)

/** The live read failed. The age is the whole point — "a snapshot" without one says nothing. */
export const ServedFromSnapshot = () => (
  <div class="max-w-2xl border border-border-base">
    <SnapshotBanner capturedAt={new Date(Date.parse("2026-09-05T09:14:00.000Z")).toISOString()} />
  </div>
)

