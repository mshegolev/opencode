// packages/app/src/pages/operator/queue-data.test.ts
import { describe, expect, test } from "bun:test"
import { ingestStale, readQueue, serverOffsetMs } from "./queue-data"
import { fixtureQueuePage } from "./fixtures"

const NOW = Date.parse("2026-09-05T10:00:00.000Z")

describe("serverOffsetMs", () => {
  test("is the signed difference between server and client clocks", () => {
    expect(serverOffsetMs(new Date(NOW).toISOString(), NOW - 300_000)).toBe(300_000)
    expect(serverOffsetMs(new Date(NOW).toISOString(), NOW + 300_000)).toBe(-300_000)
  })
})

describe("ingestStale", () => {
  test("is false while events keep arriving", () => {
    expect(ingestStale(fixtureQueuePage("all", NOW), NOW)).toBe(false)
  })

  test("is true once the stream goes quiet past the threshold", () => {
    const page = { ...fixtureQueuePage("all", NOW), lastEventAt: new Date(NOW - 400_000).toISOString() }
    expect(ingestStale(page, NOW)).toBe(true)
  })
})

describe("readQueue", () => {
  test("mine returns only incidents assigned to the operator", async () => {
    const page = await readQueue("mine")
    expect(page.rows.length).toBeGreaterThan(0)
    expect(page.rows.every((r) => r.assignedToMe)).toBe(true)
  })

  test("preserves source order and never sorts", async () => {
    const page = await readQueue("all")
    expect(page.rows.map((r) => r.number)).toEqual(fixtureQueuePage("all", Date.now()).rows.map((r) => r.number))
  })
})
