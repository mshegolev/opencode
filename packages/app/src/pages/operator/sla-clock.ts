import type { SlaSnapshot } from "./types"

export type ClockTone = "calm" | "warm" | "hot" | "breached" | "paused" | "none"

export interface ClockView {
  display: string
  caption: string
  tone: ClockTone
  stale: boolean
  ageMs: number
}

export interface ClockInput {
  snapshot: SlaSnapshot
  /** Milliseconds since epoch on the SERVER's timeline, or null when the offset is unknown. */
  serverNowMs: number | null
  staleAfterMs?: number
}

export const DEFAULT_STALE_AFTER_MS = 60_000

const HOT_MS = 15 * 60_000
const WARM_MS = 2 * 3_600_000
const DAY_MS = 24 * 3_600_000

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function format(ms: number): string {
  if (ms >= DAY_MS) {
    const days = Math.floor(ms / DAY_MS)
    const hours = Math.floor((ms % DAY_MS) / 3_600_000)
    return `${days}д ${pad(hours)}ч`
  }
  const total = Math.floor(ms / 60_000)
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

function toneFor(ms: number): ClockTone {
  if (ms < HOT_MS) return "hot"
  if (ms < WARM_MS) return "warm"
  return "calm"
}

function hhmm(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

export function slaClockView(input: ClockInput): ClockView {
  const { snapshot, serverNowMs } = input
  const staleAfter = input.staleAfterMs ?? DEFAULT_STALE_AFTER_MS

  if (snapshot.clockState === "none") {
    return { display: "—", caption: "SLA не задан", tone: "none", stale: false, ageMs: 0 }
  }

  if (serverNowMs === null) {
    return {
      display: snapshot.breachAt ? `до ${hhmm(snapshot.breachAt)}` : "—",
      caption: "время сервера неизвестно",
      tone: snapshot.clockState === "breached" ? "breached" : "calm",
      stale: false,
      ageMs: 0,
    }
  }

  const ageMs = Math.max(0, serverNowMs - Date.parse(snapshot.capturedAt))

  if (snapshot.clockState === "paused") {
    return {
      display: format(snapshot.remainingMs ?? 0),
      caption: "на паузе",
      tone: "paused",
      stale: false,
      ageMs,
    }
  }

  if (snapshot.clockState === "breached") {
    const over = snapshot.breachAt ? Math.max(0, serverNowMs - Date.parse(snapshot.breachAt)) : 0
    return { display: `−${format(over)}`, caption: "нарушен", tone: "breached", stale: false, ageMs }
  }

  const stale = ageMs > staleAfter
  const remaining = snapshot.remainingMs ?? 0
  const projected = remaining - ageMs

  // Breach is decided BEFORE the stale freeze. A deadline already in the past is known to
  // have passed however old the snapshot is, and freezing there would show time that has
  // certainly elapsed — the one thing this module exists to avoid.
  if (projected <= 0) {
    return { display: `−${format(-projected)}`, caption: "нарушен", tone: "breached", stale, ageMs }
  }

  // Still ahead of the deadline: a stale snapshot stops interpolating and shows its age.
  const left = stale ? remaining : projected

  return {
    display: format(left),
    caption: stale ? `данные ${Math.round(ageMs / 60_000)} мин назад` : "осталось",
    tone: toneFor(left),
    stale,
    ageMs,
  }
}
