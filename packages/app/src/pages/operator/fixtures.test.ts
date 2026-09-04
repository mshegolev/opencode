import { describe, expect, test } from "bun:test"
import { fixtureQueuePage } from "./fixtures"
import { slaClockView } from "./sla-clock"
import type { QueueScope } from "./types"

const NOW = Date.parse("2026-09-05T10:00:00.000Z")
const SCOPES: QueueScope[] = ["mine", "group", "all"]

describe("fixture queue counts", () => {
  test("the breached badge agrees with the rows' own clocks, on every tab", () => {
    for (const scope of SCOPES) {
      const page = fixtureQueuePage(scope, NOW, NOW)
      const breachedRows = page.rows.filter((r) => slaClockView({ snapshot: r.sla, serverNowMs: NOW }).tone === "breached")
      expect({ scope, count: page.counts.breached[scope] }).toEqual({ scope, count: breachedRows.length })
    }
  })

  test("a running clock past its deadline is counted as breached, not only an explicit breached state", () => {
    // An anchor an hour in the past puts INC0048812's 41-minute deadline behind us while its
    // snapshot still says "running" — exactly the case where a `clockState`-only count would
    // report one breach while two rows read "нарушен".
    const page = fixtureQueuePage("all", NOW, NOW - 3_600_000)
    const clockStateOnly = page.rows.filter((r) => r.sla.clockState === "breached").length
    const byTheClockModule = page.rows.filter((r) => slaClockView({ snapshot: r.sla, serverNowMs: NOW }).tone === "breached").length

    expect(clockStateOnly).toBe(1)
    expect(byTheClockModule).toBe(2)
    expect(page.counts.breached.all).toBe(2)
  })

  test("the ready count is per tab, so the group tab does not claim the operator's own incidents", () => {
    const page = fixtureQueuePage("all", NOW, NOW)
    expect(page.counts.ready).toEqual({ mine: 1, group: 1, all: 2 })
    expect(page.counts.ready.group).toBeLessThan(page.counts.ready.all)
  })

  test("every scope's row count matches its own tab count", () => {
    for (const scope of SCOPES) {
      const page = fixtureQueuePage(scope, NOW, NOW)
      expect({ scope, rows: page.rows.length }).toEqual({ scope, rows: page.counts[scope] })
    }
  })
})

describe("the fixture anchor", () => {
  test("an explicit anchor makes the fixture deterministic across calls", () => {
    // What the stories rely on: pass the same anchor and the same `nowMs` twice and the
    // deadlines are identical, rather than drifting with however long the module has been loaded.
    const a = fixtureQueuePage("all", NOW, NOW)
    const b = fixtureQueuePage("all", NOW, NOW)
    expect(a.rows.map((r) => r.sla)).toEqual(b.rows.map((r) => r.sla))
    expect(a.lastEventAt).toBe(new Date(NOW - 12_000).toISOString())
  })

  test("with the anchor equal to now, the fixture spreads across tones instead of collapsing to breached", () => {
    // The reason the stories pass `anchorMs === nowMs`: anchored elsewhere the fixture's tone
    // spread collapses — most rows read "нарушен" — and the Storybook page that exists to review
    // timer tones stops showing them. `hot` has no fixture row (nothing is inside fifteen
    // minutes); it is reviewed in the synthetic `EveryTone` story in `queue-row.stories.tsx`.
    const page = fixtureQueuePage("all", NOW, NOW)
    const tones = new Set(page.rows.map((r) => slaClockView({ snapshot: r.sla, serverNowMs: NOW }).tone))
    expect([...tones].sort()).toEqual(["breached", "calm", "none", "paused", "warm"])
  })
})
