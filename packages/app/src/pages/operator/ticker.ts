import { createSignal, onCleanup } from "solid-js"

/**
 * One tick source for every visible countdown. Never one interval per row:
 * the queue is virtualised and a hundred intervals produce a stuttering scroll.
 */
export function createTicker(intervalMs = 1_000): () => number {
  const [tick, setTick] = createSignal(0)

  const timer = setInterval(() => {
    if (typeof document !== "undefined" && document.hidden) return
    setTick((n) => n + 1)
  }, intervalMs)

  onCleanup(() => clearInterval(timer))

  return tick
}
