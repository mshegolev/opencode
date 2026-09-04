import { describe, expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createTicker } from "./ticker"

describe("createTicker", () => {
  test("advances on the interval and stops when disposed", async () => {
    let tick!: () => number
    const dispose = createRoot((d) => {
      tick = createTicker(10)
      return d
    })
    expect(tick()).toBe(0)
    await new Promise((r) => setTimeout(r, 35))
    const advanced = tick()
    expect(advanced).toBeGreaterThan(0)
    dispose()
    await new Promise((r) => setTimeout(r, 35))
    expect(tick()).toBe(advanced)
  })
})
