import { describe, expect, test } from "bun:test"
import { slaClockView } from "./sla-clock"
import type { SlaSnapshot } from "./types"

const NOW = Date.parse("2026-09-05T10:00:00.000Z")
const snap = (over: Partial<SlaSnapshot>): SlaSnapshot => ({
  clockState: "running",
  capturedAt: new Date(NOW).toISOString(),
  ...over,
})

describe("slaClockView", () => {
  test("running clock counts down from the snapshot", () => {
    const v = slaClockView({ snapshot: snap({ remainingMs: 3_660_000 }), serverNowMs: NOW + 60_000 })
    expect(v.display).toBe("01:00")
    expect(v.caption).toBe("осталось")
    expect(v.tone).toBe("warm")
    expect(v.stale).toBe(false)
  })

  test("under fifteen minutes reads hot", () => {
    const v = slaClockView({ snapshot: snap({ remainingMs: 14 * 60_000 }), serverNowMs: NOW })
    expect(v.display).toBe("00:14")
    expect(v.tone).toBe("hot")
  })

  test("beyond a day switches to day scale", () => {
    const v = slaClockView({ snapshot: snap({ remainingMs: 52 * 3_600_000 }), serverNowMs: NOW })
    expect(v.display).toBe("2д 04ч")
    expect(v.tone).toBe("calm")
  })

  test("paused clock freezes and names itself", () => {
    const v = slaClockView({ snapshot: snap({ clockState: "paused", remainingMs: 6_900_000 }), serverNowMs: NOW + 600_000 })
    expect(v.display).toBe("01:55")
    expect(v.caption).toBe("на паузе")
    expect(v.tone).toBe("paused")
  })

  test("breached counts up and shows a minus", () => {
    const v = slaClockView({
      snapshot: snap({ clockState: "breached", breachAt: new Date(NOW - 2_040_000).toISOString() }),
      serverNowMs: NOW,
    })
    expect(v.display).toBe("−00:34")
    expect(v.caption).toBe("нарушен")
    expect(v.tone).toBe("breached")
  })

  test("crossing zero flips a running clock to breached", () => {
    const v = slaClockView({ snapshot: snap({ remainingMs: 60_000 }), serverNowMs: NOW + 120_000 })
    expect(v.display).toBe("−00:01")
    expect(v.tone).toBe("breached")
  })

  test("no SLA renders as absent, never as zero", () => {
    const v = slaClockView({ snapshot: snap({ clockState: "none" }), serverNowMs: NOW })
    expect(v.display).toBe("—")
    expect(v.caption).toBe("SLA не задан")
    expect(v.tone).toBe("none")
  })

  test("a stale snapshot stops interpolating and reports its age", () => {
    const v = slaClockView({
      snapshot: snap({ remainingMs: 3_600_000, capturedAt: new Date(NOW - 240_000).toISOString() }),
      serverNowMs: NOW,
    })
    expect(v.stale).toBe(true)
    expect(v.caption).toBe("данные 4 мин назад")
    expect(v.display).toBe("01:00")
    expect(v.ageMs).toBe(240_000)
  })

  test("without a server clock it degrades to the absolute breach time", () => {
    const v = slaClockView({
      snapshot: snap({ remainingMs: 3_600_000, breachAt: "2026-09-05T11:00:00.000Z" }),
      serverNowMs: null,
    })
    expect(v.display).toBe("до 11:00")
    expect(v.caption).toBe("время сервера неизвестно")
    expect(v.tone).toBe("calm")
  })

  test("without a server clock and without a breach time it says unknown", () => {
    const v = slaClockView({ snapshot: snap({ remainingMs: 3_600_000 }), serverNowMs: null })
    expect(v.display).toBe("—")
    expect(v.caption).toBe("время сервера неизвестно")
  })
})
