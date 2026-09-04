import { describe, expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createServerClock } from "./server-clock"

describe("createServerClock", () => {
  test("reports nothing until a response has carried a server time", () => {
    createRoot((dispose) => {
      const clock = createServerClock()
      // Null, not Date.now(): an unknown server clock must degrade to the absolute breach time,
      // never silently to the browser's clock.
      expect(clock.serverNow()).toBeNull()
      dispose()
    })
  })

  test("re-bases onto the server's timeline once a response arrives", () => {
    createRoot((dispose) => {
      const clock = createServerClock()
      const serverAhead = Date.now() + 300_000
      clock.setFromServerTime(new Date(serverAhead).toISOString())

      const now = clock.serverNow()
      expect(now).not.toBeNull()
      // Within a second of the server's instant: the call itself takes real milliseconds.
      expect(Math.abs(now! - serverAhead)).toBeLessThan(1_000)
      dispose()
    })
  })

  test("a server behind this browser moves the reported now backwards", () => {
    createRoot((dispose) => {
      const clock = createServerClock()
      const serverBehind = Date.now() - 300_000
      clock.setFromServerTime(new Date(serverBehind).toISOString())

      expect(clock.serverNow()!).toBeLessThan(Date.now())
      expect(Math.abs(clock.serverNow()! - serverBehind)).toBeLessThan(1_000)
      dispose()
    })
  })
})
