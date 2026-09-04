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

/**
 * An instant rendered in the operator's own local time. The instant itself still comes from the
 * server — only its presentation is local, which is the only form an operator can act on. In UTC
 * it would show a confidently wrong wall-clock time to anyone not on UTC, with no marker saying
 * so, on the very path that exists to stay trustworthy when everything else is not. This does not
 * weaken "the browser clock never enters the calculation": no duration is derived from
 * `Date.now()` here, only a timezone applied to an instant the server chose.
 */
export function localHhMm(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function ageCaption(ageMs: number): string {
  return `данные ${Math.round(ageMs / 60_000)} мин назад`
}

export function slaClockView(input: ClockInput): ClockView {
  const { snapshot, serverNowMs } = input
  const staleAfter = input.staleAfterMs ?? DEFAULT_STALE_AFTER_MS

  if (snapshot.clockState === "none") {
    return { display: "—", caption: "SLA не задан", tone: "none", stale: false, ageMs: 0 }
  }

  if (serverNowMs === null) {
    return {
      display: snapshot.breachAt ? `до ${localHhMm(snapshot.breachAt)}` : "—",
      caption: "время сервера неизвестно",
      tone: snapshot.clockState === "breached" ? "breached" : "calm",
      stale: false,
      ageMs: 0,
    }
  }

  const ageMs = Math.max(0, serverNowMs - Date.parse(snapshot.capturedAt))
  const stale = ageMs > staleAfter

  // A hold is reversible, so an old "paused" snapshot cannot assert that the clock is still on
  // hold: it may have been released hours ago and the deadline may now be minutes away. Say the
  // clock was on hold as of a stated age instead. Breach is monotone — once past, always past —
  // which is why the branch below can honestly report `stale: false` and this one cannot.
  if (snapshot.clockState === "paused") {
    return {
      display: format(snapshot.remainingMs ?? 0),
      caption: stale ? `на паузе, ${ageCaption(ageMs)}` : "на паузе",
      tone: "paused",
      stale,
      ageMs,
    }
  }

  if (snapshot.clockState === "breached") {
    const over = snapshot.breachAt ? Math.max(0, serverNowMs - Date.parse(snapshot.breachAt)) : 0
    return { display: `−${format(over)}`, caption: "нарушен", tone: "breached", stale: false, ageMs }
  }

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
    caption: stale ? ageCaption(ageMs) : "осталось",
    tone: toneFor(left),
    stale,
    ageMs,
  }
}
