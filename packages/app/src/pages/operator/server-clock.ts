import { createSignal } from "solid-js"
import { serverOffsetMs } from "./queue-data"
import { createTicker } from "./ticker"

export interface ServerClock {
  /** Milliseconds since epoch on the SERVER's timeline, or null until a response has arrived. */
  serverNow: () => number | null
  /** Called with the `serverTime` of each response; re-measures the offset from that instant. */
  setFromServerTime: (serverTime: string) => void
}

/**
 * The one place "now, on the server's clock" is derived, so the queue and the incident detail
 * cannot drift apart in how they answer that question.
 *
 * This is not SLA arithmetic — it computes no remaining time, no breach and no age. It reads the
 * offset the server declared once and re-bases the local clock onto it; `slaClockView` remains
 * the only module that turns an instant into a duration.
 *
 * `serverNow` reads the ticker, so anything that calls it in a reactive scope re-runs once a
 * second. Call this from a component body: `createTicker` registers an `onCleanup`.
 */
export function createServerClock(): ServerClock {
  const tick = createTicker()
  const [offset, setOffset] = createSignal<number | null>(null)

  return {
    serverNow: () => {
      tick()
      const o = offset()
      return o === null ? null : Date.now() + o
    },
    setFromServerTime: (serverTime) => setOffset(serverOffsetMs(serverTime, Date.now())),
  }
}
