# Operator Workspace Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the operator workspace shell, queue and incident detail views in the web app, driven by a fixture-backed read layer, so the SLA countdown and every degraded state are real and testable before the ITSM projection or the AI triage service exist.

**Architecture:** A new route tree at `/queue` mounts inside the app's base providers (theme, language, Query, marked, file component) and outside `Layout` and everything developer-facing. All time arithmetic lives in one pure function, `slaClockView`, which every component consumes as data. Rows and tabs are presentational; a single one-second ticker drives every visible countdown.

**Tech Stack:** SolidJS, `@solidjs/router`, `@tanstack/solid-query`, `virtua`, `@opencode-ai/ui` components, Tailwind with the repo's semantic tokens, `bun:test` with the happy-dom preload, Storybook, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-05-operator-workspace-design.md`

## Global Constraints

- **Read-only.** No mutation, no write endpoint, no import of a mutation hook anywhere under `packages/app/src/pages/operator/`. Task 10 enforces this with a test.
- **No component computes time.** Only `slaClockView` performs time arithmetic. Components receive a `ClockView` and render it.
- **The browser clock is never used for SLA display.** The server's time arrives in the payload; when it is absent, the countdown degrades to an absolute breach time rather than falling back to `Date.now()`.
- **Never show something plausible in place of something unknown.** Unknown triage state renders as "state unknown", never "not started". A missing SLA renders as "no SLA set", never zero.
- **Queue order mirrors the source exactly.** Rows render in the order the payload delivers them. No client-side sorting anywhere in this plan.
- **Staleness defaults:** 60 000 ms for a snapshot while the clock runs; 300 000 ms without an ingest event before the queue banner appears. Both configurable.
- **Run app tests over the whole `./src`:** `bun test --preload ./happydom.ts ./src` from `packages/app`. A narrower path makes a passing test fail.
- **Deviation from the spec, deliberate:** the spec calls the clock module `createSlaClock`. This plan names it `slaClockView`, because `create*` in SolidJS denotes a reactive primitive and this is a pure function. Same responsibility, clearer name.

---

### Task 1: Domain contract and fixtures

**Files:**
- Create: `packages/app/src/pages/operator/types.ts`
- Create: `packages/app/src/pages/operator/fixtures.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ClockState`, `SlaSnapshot`, `TriageState`, `IncidentRow`, `QueueScope`, `QueuePage`, `IncidentDetail`, `TriageFieldSet`; fixture builders `fixtureQueuePage(scope: QueueScope, nowMs: number): QueuePage` and `fixtureIncidentDetail(number: string, nowMs: number): IncidentDetail`.

- [ ] **Step 1: Write the contract types**

```ts
// packages/app/src/pages/operator/types.ts
export type ClockState = "running" | "paused" | "breached" | "none"

export interface SlaSnapshot {
  clockState: ClockState
  /** Service-calendar milliseconds left at capture. Absent when clockState is "none". */
  remainingMs?: number
  /** ISO 8601 instant the resolution SLA breaches, when the source provides one. */
  breachAt?: string
  /** ISO 8601 instant this snapshot was taken, on the server's clock. */
  capturedAt: string
}

export type TriageState = "ready" | "running" | "interrupted" | "not-started" | "nothing-to-triage" | "unknown"

export interface IncidentRow {
  number: string
  priority: 1 | 2 | 3 | 4
  description: string
  assignedToMe: boolean
  group: string
  status: string
  sla: SlaSnapshot
  triage: TriageState
  sessionId?: string
}

export type QueueScope = "mine" | "group" | "all"

export interface QueuePage {
  scope: QueueScope
  /** Rendered in exactly this order. Never sorted client-side. */
  rows: IncidentRow[]
  /** Server clock when the response was produced, ISO 8601. */
  serverTime: string
  /** Newest ingest event the projection has seen, ISO 8601. */
  lastEventAt: string
  counts: { mine: number; group: number; all: number; ready: number; breached: number }
}

export interface TriageFieldSet {
  cause: string
  basedOn: string
  related: string[]
  checked: string[]
  notChecked: string[]
  confidence: "high" | "medium" | "low"
  confidenceNote: string
}

export interface IncidentDetail {
  row: IncidentRow
  openedAt: string
  triageFinishedAt?: string
  triageDurationMs?: number
  fields?: TriageFieldSet
  /** True when the detail was served from the projection because the live read failed. */
  fromSnapshot: boolean
  serverTime: string
}
```

- [ ] **Step 2: Write the fixtures**

```ts
// packages/app/src/pages/operator/fixtures.ts
import type { IncidentDetail, IncidentRow, QueuePage, QueueScope } from "./types"

const iso = (ms: number) => new Date(ms).toISOString()

function rows(nowMs: number): IncidentRow[] {
  const captured = iso(nowMs - 5_000)
  return [
    {
      number: "INC0048812",
      priority: 1,
      description: "Оплата не проходит на кассе, 3 магазина",
      assignedToMe: true,
      group: "Платежи",
      status: "In progress",
      sla: { clockState: "running", remainingMs: 41 * 60_000, breachAt: iso(nowMs + 41 * 60_000), capturedAt: captured },
      triage: "ready",
      sessionId: "ses_048812",
    },
    {
      number: "INC0048805",
      priority: 1,
      description: "Недоступен шлюз эквайринга в СЗФО",
      assignedToMe: false,
      group: "Платежи",
      status: "New",
      sla: { clockState: "running", remainingMs: 67 * 60_000, breachAt: iso(nowMs + 67 * 60_000), capturedAt: captured },
      triage: "running",
    },
    {
      number: "INC0048790",
      priority: 2,
      description: "Не открывается отчёт по остаткам",
      assignedToMe: true,
      group: "Отчётность",
      status: "In progress",
      sla: { clockState: "running", remainingMs: 192 * 60_000, breachAt: iso(nowMs + 192 * 60_000), capturedAt: captured },
      triage: "running",
      sessionId: "ses_048790",
    },
    {
      number: "INC0048771",
      priority: 2,
      description: "Синхронизация каталога встала",
      assignedToMe: false,
      group: "Каталог",
      status: "On hold",
      sla: { clockState: "paused", remainingMs: 115 * 60_000, capturedAt: captured },
      triage: "ready",
      sessionId: "ses_048771",
    },
    {
      number: "INC0048764",
      priority: 3,
      description: "Медленно грузится личный кабинет",
      assignedToMe: false,
      group: "Портал",
      status: "New",
      sla: { clockState: "running", remainingMs: 52 * 3_600_000, breachAt: iso(nowMs + 52 * 3_600_000), capturedAt: captured },
      triage: "not-started",
    },
    {
      number: "INC0048755",
      priority: 3,
      description: "Не приходит СМС с кодом подтверждения",
      assignedToMe: false,
      group: "Аутентификация",
      status: "New",
      // Deliberately stale: exercises the age treatment.
      sla: { clockState: "running", remainingMs: 348 * 60_000, breachAt: iso(nowMs + 348 * 60_000), capturedAt: iso(nowMs - 240_000) },
      triage: "unknown",
    },
    {
      number: "INC0048701",
      priority: 4,
      description: "Опечатка в тексте письма",
      assignedToMe: false,
      group: "Контент",
      status: "In progress",
      sla: { clockState: "breached", breachAt: iso(nowMs - 34 * 60_000), capturedAt: captured },
      triage: "nothing-to-triage",
    },
    {
      number: "INC0048688",
      priority: 4,
      description: "Просьба добавить колонку в выгрузку",
      assignedToMe: false,
      group: "Отчётность",
      status: "New",
      sla: { clockState: "none", capturedAt: captured },
      triage: "not-started",
    },
  ]
}

export function fixtureQueuePage(scope: QueueScope, nowMs: number): QueuePage {
  const all = rows(nowMs)
  const visible = scope === "mine" ? all.filter((r) => r.assignedToMe) : scope === "group" ? all.filter((r) => !r.assignedToMe) : all
  return {
    scope,
    rows: visible,
    serverTime: iso(nowMs),
    lastEventAt: iso(nowMs - 12_000),
    counts: {
      mine: all.filter((r) => r.assignedToMe).length,
      group: all.filter((r) => !r.assignedToMe).length,
      all: all.length,
      ready: all.filter((r) => r.triage === "ready").length,
      breached: all.filter((r) => r.sla.clockState === "breached").length,
    },
  }
}

export function fixtureIncidentDetail(number: string, nowMs: number): IncidentDetail {
  const row = rows(nowMs).find((r) => r.number === number)
  if (!row) throw new Error(`no fixture incident ${number}`)
  return {
    row,
    openedAt: iso(nowMs - 40 * 60_000),
    triageFinishedAt: row.triage === "ready" ? iso(nowMs - 33 * 60_000) : undefined,
    triageDurationMs: row.triage === "ready" ? 400_000 : undefined,
    fields:
      row.triage === "ready"
        ? {
            cause: "Таймауты шлюза эквайринга на узле pay-gw-03",
            basedOn: "Доля таймаутов на pay-gw-03 — 2% в 09:00, 41% в 09:12. Все три магазина привязаны к этому узлу.",
            related: ["INC0048805"],
            checked: ["pay-gw-03: метрики 08:30–09:20", "маршрутизация магазинов 4412, 4418, 4501", "журнал изменений за 24ч"],
            notChecked: ["Состояние самого узла — нет доступа", "Сеть между кассами и шлюзом"],
            confidence: "medium",
            confidenceNote: "Корреляция по времени и по узлу сходится, но прямой ошибки от шлюза в журналах не видно.",
          }
        : undefined,
    fromSnapshot: false,
    serverTime: iso(nowMs),
  }
}
```

- [ ] **Step 3: Typecheck**

Run from `packages/app`: `bun run typecheck`
Expected: PASS, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/pages/operator/types.ts packages/app/src/pages/operator/fixtures.ts
git commit -m "feat(operator): define the queue contract and its fixtures"
```

---

### Task 2: The SLA clock

This is the highest-value module in the plan. Everything else renders what it returns.

**Files:**
- Create: `packages/app/src/pages/operator/sla-clock.ts`
- Test: `packages/app/src/pages/operator/sla-clock.test.ts`

**Interfaces:**
- Consumes: `SlaSnapshot` from Task 1.
- Produces: `ClockTone`, `ClockView`, `slaClockView(input: ClockInput): ClockView`, `DEFAULT_STALE_AFTER_MS`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/app/src/pages/operator/sla-clock.test.ts
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run from `packages/app`: `bun test --preload ./happydom.ts ./src`
Expected: FAIL — `Cannot find module './sla-clock'`.

- [ ] **Step 3: Implement the module**

```ts
// packages/app/src/pages/operator/sla-clock.ts
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
  const elapsed = stale ? 0 : ageMs
  const left = (snapshot.remainingMs ?? 0) - elapsed

  if (left <= 0) {
    return { display: `−${format(-left)}`, caption: "нарушен", tone: "breached", stale, ageMs }
  }

  return {
    display: format(left),
    caption: stale ? `данные ${Math.round(ageMs / 60_000)} мин назад` : "осталось",
    tone: toneFor(left),
    stale,
    ageMs,
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run from `packages/app`: `bun test --preload ./happydom.ts ./src`
Expected: PASS, all ten `slaClockView` tests green, no other test broken.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/pages/operator/sla-clock.ts packages/app/src/pages/operator/sla-clock.test.ts
git commit -m "feat(operator): render SLA clocks from the server's snapshot, never from the browser"
```

---

### Task 3: The shared ticker

**Files:**
- Create: `packages/app/src/pages/operator/ticker.ts`
- Test: `packages/app/src/pages/operator/ticker.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `createTicker(intervalMs?: number): () => number` — a Solid accessor returning a monotonically increasing tick count, stopped while `document.hidden` is true and cleaned up on scope disposal.

- [ ] **Step 1: Write the failing test**

```ts
// packages/app/src/pages/operator/ticker.test.ts
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run from `packages/app`: `bun test --preload ./happydom.ts ./src`
Expected: FAIL — `Cannot find module './ticker'`.

- [ ] **Step 3: Implement the ticker**

```ts
// packages/app/src/pages/operator/ticker.ts
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
```

- [ ] **Step 4: Run the test and confirm it passes**

Run from `packages/app`: `bun test --preload ./happydom.ts ./src`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/pages/operator/ticker.ts packages/app/src/pages/operator/ticker.test.ts
git commit -m "feat(operator): drive every countdown from one ticker"
```

---

### Task 4: The queue row

**Files:**
- Create: `packages/app/src/pages/operator/queue-row.tsx`
- Create: `packages/app/src/pages/operator/queue-row.stories.tsx`

**Interfaces:**
- Consumes: `IncidentRow`, `TriageState` (Task 1); `ClockView` (Task 2).
- Produces: `QueueRow(props: { incident: IncidentRow; clock: ClockView; onOpen: (number: string) => void })`, and `triageLabel(state: TriageState): string`.

- [ ] **Step 1: Implement the row**

Two lines per incident, the triage state as a bordered chip, "assigned to me" as a left plank. The row performs no time arithmetic — it renders `props.clock`.

```tsx
// packages/app/src/pages/operator/queue-row.tsx
import { Show } from "solid-js"
import type { ClockView } from "./sla-clock"
import type { IncidentRow, TriageState } from "./types"

export function triageLabel(state: TriageState): string {
  switch (state) {
    case "ready": return "разбор готов"
    case "running": return "разбор идёт"
    case "interrupted": return "разбор прерван"
    case "not-started": return "разбор не начат"
    case "nothing-to-triage": return "нечего разбирать"
    case "unknown": return "состояние неизвестно"
  }
}

const TONE_TEXT: Record<ClockView["tone"], string> = {
  hot: "text-text-danger",
  breached: "text-text-danger",
  warm: "text-text-warning",
  paused: "text-text-muted",
  calm: "text-text",
  none: "text-text-muted",
}

const CHIP_TONE: Record<TriageState, string> = {
  ready: "border-border-success text-text-success",
  running: "border-border-warning text-text-warning",
  interrupted: "border-border-danger text-text-danger",
  "not-started": "border-border text-text-muted",
  "nothing-to-triage": "border-border text-text-muted",
  unknown: "border-border text-text-muted",
}

export function QueueRow(props: { incident: IncidentRow; clock: ClockView; onOpen: (number: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => props.onOpen(props.incident.number)}
      class={`w-full border-b border-border px-3 py-2 text-left hover:bg-background-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus ${
        props.incident.assignedToMe ? "shadow-[inset_3px_0_0_var(--color-text)]" : ""
      }`}
    >
      <div class="flex items-baseline gap-2.5">
        <span class="w-6 shrink-0 font-semibold tabular-nums">P{props.incident.priority}</span>
        <span class="min-w-0 flex-1 truncate font-medium">{props.incident.description}</span>
        <span class={`shrink-0 text-right font-mono tabular-nums ${TONE_TEXT[props.clock.tone]}`}>
          <span class="block text-sm font-semibold">{props.clock.display}</span>
          <span class="block text-[9px] uppercase tracking-wider text-text-muted">{props.clock.caption}</span>
        </span>
      </div>
      <div class="mt-0.5 flex items-center gap-2.5 pl-8 text-xs text-text-muted">
        <span class="font-mono">{props.incident.number}</span>
        <Show when={props.incident.assignedToMe}>
          <span>мне</span>
        </Show>
        <span class={`rounded-sm border px-1.5 text-[10px] uppercase tracking-wide ${CHIP_TONE[props.incident.triage]}`}>
          {triageLabel(props.incident.triage)}
        </span>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Write the stories covering every state**

```tsx
// packages/app/src/pages/operator/queue-row.stories.tsx
import { For } from "solid-js"
import { QueueRow } from "./queue-row"
import { slaClockView } from "./sla-clock"
import { fixtureQueuePage } from "./fixtures"

export default { title: "Operator/QueueRow" }

export const EveryState = () => {
  const now = Date.parse("2026-09-05T10:00:00.000Z")
  const page = fixtureQueuePage("all", now)
  return (
    <div class="max-w-2xl border border-border">
      <For each={page.rows}>
        {(incident) => (
          <QueueRow incident={incident} clock={slaClockView({ snapshot: incident.sla, serverNowMs: now })} onOpen={() => {}} />
        )}
      </For>
    </div>
  )
}

export const ServerClockUnknown = () => {
  const now = Date.parse("2026-09-05T10:00:00.000Z")
  const incident = fixtureQueuePage("all", now).rows[0]
  return (
    <div class="max-w-2xl border border-border">
      <QueueRow incident={incident} clock={slaClockView({ snapshot: incident.sla, serverNowMs: null })} onOpen={() => {}} />
    </div>
  )
}
```

- [ ] **Step 3: Typecheck and review the stories**

Run from `packages/app`: `bun run typecheck`
Then from `packages/storybook`: `bun run storybook`, open `Operator/QueueRow`, and confirm all eight fixture states render — including "состояние неизвестно" and "SLA не задан" — in both light and dark themes.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/pages/operator/queue-row.tsx packages/app/src/pages/operator/queue-row.stories.tsx
git commit -m "feat(operator): draw the queue row, and let it render time rather than compute it"
```

---

### Task 5: The tabs

**Files:**
- Create: `packages/app/src/pages/operator/queue-tabs.tsx`
- Create: `packages/app/src/pages/operator/queue-tabs.stories.tsx`

**Interfaces:**
- Consumes: `QueueScope`, `QueuePage["counts"]` (Task 1).
- Produces: `QueueTabs(props: { scope: QueueScope; counts: QueuePage["counts"]; onSelect: (scope: QueueScope) => void })`.

The counters are the mitigation for the risk tabs carry: what is hidden must announce itself, so the group tab shows how many analyses are ready and how many SLAs are breached.

- [ ] **Step 1: Implement the tabs**

```tsx
// packages/app/src/pages/operator/queue-tabs.tsx
import { For, Show } from "solid-js"
import type { QueuePage, QueueScope } from "./types"

const LABEL: Record<QueueScope, string> = { mine: "На мне", group: "Очередь группы", all: "Все" }

export function QueueTabs(props: { scope: QueueScope; counts: QueuePage["counts"]; onSelect: (scope: QueueScope) => void }) {
  const scopes: QueueScope[] = ["mine", "group", "all"]
  return (
    <div role="tablist" class="flex border-b border-border bg-background-subtle">
      <For each={scopes}>
        {(scope) => (
          <button
            type="button"
            role="tab"
            aria-selected={props.scope === scope}
            onClick={() => props.onSelect(scope)}
            class={`flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus ${
              props.scope === scope ? "border-text font-semibold text-text" : "border-transparent text-text-muted"
            }`}
          >
            <span>{LABEL[scope]}</span>
            <span class="rounded-full bg-background-element px-1.5 text-[10px] font-semibold tabular-nums">{props.counts[scope]}</span>
            <Show when={scope !== "mine" && props.counts.ready > 0}>
              <span class="rounded-full bg-background-success px-1.5 text-[10px] font-semibold tabular-nums text-text-success">
                {props.counts.ready} готово
              </span>
            </Show>
            <Show when={scope !== "mine" && props.counts.breached > 0}>
              <span class="rounded-full bg-background-danger px-1.5 text-[10px] font-semibold tabular-nums text-text-danger">
                {props.counts.breached} нарушено
              </span>
            </Show>
          </button>
        )}
      </For>
    </div>
  )
}
```

- [ ] **Step 2: Write the stories**

```tsx
// packages/app/src/pages/operator/queue-tabs.stories.tsx
import { QueueTabs } from "./queue-tabs"

export default { title: "Operator/QueueTabs" }

export const Loaded = () => (
  <QueueTabs scope="group" counts={{ mine: 2, group: 40, all: 42, ready: 11, breached: 3 }} onSelect={() => {}} />
)

export const NothingUrgent = () => (
  <QueueTabs scope="mine" counts={{ mine: 0, group: 8, all: 8, ready: 0, breached: 0 }} onSelect={() => {}} />
)
```

- [ ] **Step 3: Typecheck and review**

Run from `packages/app`: `bun run typecheck`
In Storybook, confirm the group tab carries its counters and that `NothingUrgent` shows no ready/breached badges rather than zeros.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/pages/operator/queue-tabs.tsx packages/app/src/pages/operator/queue-tabs.stories.tsx
git commit -m "feat(operator): put what the tabs hide onto the tabs themselves"
```

---

### Task 6: The read layer

**Files:**
- Create: `packages/app/src/pages/operator/queue-data.ts`
- Test: `packages/app/src/pages/operator/queue-data.test.ts`

**Interfaces:**
- Consumes: `QueuePage`, `IncidentDetail`, `QueueScope` (Task 1); fixtures (Task 1).
- Produces: `INGEST_STALE_AFTER_MS`, `serverOffsetMs(serverTime: string, clientNowMs: number): number`, `ingestStale(page: QueuePage, serverNowMs: number, thresholdMs?: number): boolean`, `readQueue(scope: QueueScope): Promise<QueuePage>`, `readIncident(number: string): Promise<IncidentDetail>`.

`readQueue` and `readIncident` are the seam. In this plan they resolve from fixtures; Plan 2 replaces their bodies with SDK calls and nothing above them changes.

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run from `packages/app`: `bun test --preload ./happydom.ts ./src`
Expected: FAIL — `Cannot find module './queue-data'`.

- [ ] **Step 3: Implement the read layer**

```ts
// packages/app/src/pages/operator/queue-data.ts
import { fixtureIncidentDetail, fixtureQueuePage } from "./fixtures"
import type { IncidentDetail, QueuePage, QueueScope } from "./types"

export const INGEST_STALE_AFTER_MS = 300_000

/** Positive when the server is ahead of this browser. Add it to Date.now() to get server time. */
export function serverOffsetMs(serverTime: string, clientNowMs: number): number {
  return Date.parse(serverTime) - clientNowMs
}

export function ingestStale(page: QueuePage, serverNowMs: number, thresholdMs = INGEST_STALE_AFTER_MS): boolean {
  return serverNowMs - Date.parse(page.lastEventAt) > thresholdMs
}

/** Seam. Plan 2 replaces the body with an SDK call; the signature does not change. */
export async function readQueue(scope: QueueScope): Promise<QueuePage> {
  return fixtureQueuePage(scope, Date.now())
}

/** Seam. Plan 2 replaces the body with a live read plus snapshot fallback. */
export async function readIncident(number: string): Promise<IncidentDetail> {
  return fixtureIncidentDetail(number, Date.now())
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run from `packages/app`: `bun test --preload ./happydom.ts ./src`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/pages/operator/queue-data.ts packages/app/src/pages/operator/queue-data.test.ts
git commit -m "feat(operator): read the queue behind a seam, and measure the server's clock"
```

---

### Task 7: The shell, the queue page and the routes

**Files:**
- Create: `packages/app/src/pages/operator/shell.tsx`
- Create: `packages/app/src/pages/operator/queue.tsx`
- Modify: `packages/app/src/app.tsx:329` — add the operator routes beside `<Route path="/" component={HomeRoute} />`

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: `OperatorShell(props: ParentProps)`, `Queue()` (default export of `queue.tsx`), route `/queue`. The `/queue/:number` route is registered in Task 8, once `incident.tsx` exists.

- [ ] **Step 1: Implement the shell**

```tsx
// packages/app/src/pages/operator/shell.tsx
import type { ParentProps } from "solid-js"

/**
 * Deliberately NOT `Layout`. The operator shell mounts inside the base providers only —
 * no terminals, models, permissions or prompt. Task 10 tests that this stays true.
 */
export function OperatorShell(props: ParentProps) {
  return (
    <div class="flex h-full flex-col bg-background text-text">
      <header class="flex items-baseline gap-3 border-b border-border px-4 py-3">
        <h1 class="text-sm font-semibold">Инциденты</h1>
        <span class="text-xs text-text-muted">разбор и очередь</span>
      </header>
      <div class="min-h-0 flex-1">{props.children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Implement the queue page**

```tsx
// packages/app/src/pages/operator/queue.tsx
import { createMemo, createSignal, For, Show } from "solid-js"
import { useNavigate, useSearchParams } from "@solidjs/router"
import { useQuery } from "@tanstack/solid-query"
import { QueueRow } from "./queue-row"
import { QueueTabs } from "./queue-tabs"
import { ingestStale, readQueue, serverOffsetMs } from "./queue-data"
import { slaClockView } from "./sla-clock"
import { createTicker } from "./ticker"
import { OperatorShell } from "./shell"
import type { QueueScope } from "./types"

const SCOPES: QueueScope[] = ["mine", "group", "all"]

export default function Queue() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams<{ scope?: string }>()
  const tick = createTicker()
  const [offset, setOffset] = createSignal<number | null>(null)

  const scope = createMemo<QueueScope>(() => {
    const raw = params.scope
    return SCOPES.includes(raw as QueueScope) ? (raw as QueueScope) : "mine"
  })

  const query = useQuery(() => ({
    queryKey: ["operator", "queue", scope()],
    queryFn: async () => {
      const page = await readQueue(scope())
      setOffset(serverOffsetMs(page.serverTime, Date.now()))
      return page
    },
    refetchInterval: 30_000,
  }))

  const serverNow = () => {
    tick()
    const o = offset()
    return o === null ? null : Date.now() + o
  }

  return (
    <OperatorShell>
      <Show when={query.data} fallback={<p class="p-4 text-sm text-text-muted">{query.isError ? "Очередь не загрузилась" : "Загружаю очередь…"}</p>}>
        {(page) => (
          <div class="flex h-full flex-col">
            <QueueTabs scope={scope()} counts={page().counts} onSelect={(next) => setParams({ scope: next })} />
            <Show when={serverNow() !== null && ingestStale(page(), serverNow()!)}>
              <p class="border-b border-border-warning bg-background-warning px-3 py-1.5 text-xs text-text-warning">
                Данные могли устареть: события из ITSM не приходили дольше пяти минут.
              </p>
            </Show>
            <Show
              when={page().rows.length > 0}
              fallback={<p class="p-4 text-sm text-text-muted">{scope() === "mine" ? "На вас ничего не назначено" : "В очереди пусто"}</p>}
            >
              <div class="min-h-0 flex-1 overflow-y-auto">
                <For each={page().rows}>
                  {(incident) => (
                    <QueueRow
                      incident={incident}
                      clock={slaClockView({ snapshot: incident.sla, serverNowMs: serverNow() })}
                      onOpen={(number) => navigate(`/queue/${number}`)}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
        )}
      </Show>
    </OperatorShell>
  )
}
```

- [ ] **Step 3: Register the routes**

In `packages/app/src/app.tsx`, add the lazy import beside the existing `HomeRoute` and `Session` declarations near line 52:

```tsx
const QueueRoute = lazy(() => import("@/pages/operator/queue"))
```

And add the route immediately after `<Route path="/" component={HomeRoute} />` at line 329:

```tsx
<Route path="/queue" component={QueueRoute} />
```

It sits at the top level, outside `<Route path="/:dir" component={DirectoryLayout}>`, so no developer layout wraps it. The `/queue/:number` route arrives in Task 8 — registering it here would point at a file that does not exist yet and break the build.

- [ ] **Step 4: Verify it runs**

Run from `packages/app`: `bun run dev`, then open `/queue`. Expect eight fixture rows under the "Все" tab, countdowns advancing once a second, `INC0048755` showing its age instead of a ticking number, `INC0048701` counting up in the negative, and `INC0048688` reading "SLA не задан".

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/pages/operator/shell.tsx packages/app/src/pages/operator/queue.tsx packages/app/src/app.tsx
git commit -m "feat(operator): mount the queue at /queue, outside the developer shell"
```

---

### Task 8: The incident detail

**Files:**
- Create: `packages/app/src/pages/operator/triage-fields.tsx`
- Create: `packages/app/src/pages/operator/triage-fields.stories.tsx`
- Create: `packages/app/src/pages/operator/incident.tsx`

**Interfaces:**
- Consumes: `IncidentDetail`, `TriageFieldSet` (Task 1); `slaClockView` (Task 2); `createTicker` (Task 3); `readIncident`, `serverOffsetMs` (Task 6); `OperatorShell` (Task 7).
- Produces: `TriageFields(props: { fields: TriageFieldSet })`, `Incident()` (default export of `incident.tsx`).

- [ ] **Step 1: Implement the fields**

Structured, because the operator will verify the analysis regardless and fields can be checked piecewise where prose cannot.

```tsx
// packages/app/src/pages/operator/triage-fields.tsx
import { For, Show, type JSX } from "solid-js"
import type { TriageFieldSet } from "./types"

const CONFIDENCE: Record<TriageFieldSet["confidence"], string> = {
  high: "Уверенность высокая",
  medium: "Уверенность средняя",
  low: "Уверенность низкая",
}

function Row(props: { label: string; children: JSX.Element }) {
  return (
    <div class="flex border-b border-border last:border-b-0">
      <div class="w-40 shrink-0 bg-background-subtle px-3 py-2 text-xs text-text-muted">{props.label}</div>
      <div class="flex-1 px-3 py-2 text-sm">{props.children}</div>
    </div>
  )
}

export function TriageFields(props: { fields: TriageFieldSet }) {
  return (
    <div>
      <div class="rounded border border-border">
        <Row label="Предполагаемая причина">{props.fields.cause}</Row>
        <Row label="На чём основано">{props.fields.basedOn}</Row>
        <Show when={props.fields.related.length > 0}>
          <Row label="Связанные">
            <For each={props.fields.related}>{(n) => <span class="mr-2 font-mono text-xs">{n}</span>}</For>
          </Row>
        </Show>
        <Row label="Что уже проверено">
          <For each={props.fields.checked}>
            {(item) => <div class="font-mono text-xs">{item}</div>}
          </For>
        </Row>
        <Row label="Что не проверено">
          <For each={props.fields.notChecked}>{(item) => <div>{item}</div>}</For>
        </Row>
      </div>
      <p class="mt-3 border-l-[3px] border-border-warning bg-background-subtle px-3 py-2 text-sm">
        <strong>{CONFIDENCE[props.fields.confidence]}.</strong> {props.fields.confidenceNote}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Write the stories**

```tsx
// packages/app/src/pages/operator/triage-fields.stories.tsx
import { TriageFields } from "./triage-fields"
import { fixtureIncidentDetail } from "./fixtures"

export default { title: "Operator/TriageFields" }

export const Ready = () => {
  const detail = fixtureIncidentDetail("INC0048812", Date.parse("2026-09-05T10:00:00.000Z"))
  return <div class="max-w-2xl p-4">{detail.fields ? <TriageFields fields={detail.fields} /> : null}</div>
}
```

- [ ] **Step 3: Implement the incident page**

```tsx
// packages/app/src/pages/operator/incident.tsx
import { createSignal, Show } from "solid-js"
import { useParams } from "@solidjs/router"
import { useQuery } from "@tanstack/solid-query"
import { Link } from "@/components/link"
import { OperatorShell } from "./shell"
import { TriageFields } from "./triage-fields"
import { readIncident, serverOffsetMs } from "./queue-data"
import { slaClockView } from "./sla-clock"
import { createTicker } from "./ticker"
import { triageLabel } from "./queue-row"

export default function Incident() {
  const params = useParams<{ number: string }>()
  const tick = createTicker()
  const [offset, setOffset] = createSignal<number | null>(null)

  const query = useQuery(() => ({
    queryKey: ["operator", "incident", params.number],
    queryFn: async () => {
      const detail = await readIncident(params.number)
      setOffset(serverOffsetMs(detail.serverTime, Date.now()))
      return detail
    },
  }))

  const serverNow = () => {
    tick()
    const o = offset()
    return o === null ? null : Date.now() + o
  }

  return (
    <OperatorShell>
      <Show when={query.data} fallback={<p class="p-4 text-sm text-text-muted">{query.isError ? "Инцидент не загрузился" : "Загружаю…"}</p>}>
        {(detail) => {
          const clock = () => slaClockView({ snapshot: detail().row.sla, serverNowMs: serverNow() })
          return (
            <div class="flex h-full flex-col">
              <div class="flex items-start gap-4 border-b border-border px-4 py-3">
                <div class="min-w-0 flex-1">
                  <h2 class="text-base font-semibold">{detail().row.description}</h2>
                  <div class="mt-0.5 flex gap-2.5 text-xs text-text-muted">
                    <span class="font-mono">{detail().row.number}</span>
                    <span>P{detail().row.priority}</span>
                    <span>{detail().row.group}</span>
                    <span>{triageLabel(detail().row.triage)}</span>
                  </div>
                </div>
                <div class="shrink-0 text-right font-mono tabular-nums">
                  <span class="block text-2xl font-semibold">{clock().display}</span>
                  <span class="block text-[9px] uppercase tracking-wider text-text-muted">{clock().caption}</span>
                </div>
              </div>
              <Show when={detail().fromSnapshot}>
                <p class="border-b border-border-warning bg-background-warning px-4 py-1.5 text-xs text-text-warning">
                  Дочитать не удалось — показан снимок.
                </p>
              </Show>
              <div class="min-h-0 flex-1 overflow-y-auto p-4">
                <Show
                  when={detail().fields}
                  fallback={<p class="text-sm text-text-muted">Разбора нет: {triageLabel(detail().row.triage)}.</p>}
                >
                  {(fields) => <TriageFields fields={fields()} />}
                </Show>
              </div>
              <div class="border-t border-border bg-background-subtle px-4 py-2 text-xs text-text-muted">
                <Link href={`https://itsm.example/incident/${detail().row.number}`}>Открыть тикет в ITSM</Link>
              </div>
            </div>
          )
        }}
      </Show>
    </OperatorShell>
  )
}
```

- [ ] **Step 4: Verify it runs**

Run from `packages/app`: `bun run dev`, open `/queue`, click `INC0048812`. Expect the structured fields including "Что не проверено" and the confidence note, a large countdown in the header, and the ITSM link in the footer. Click `INC0048764` and expect "Разбора нет: разбор не начат."

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/pages/operator/triage-fields.tsx packages/app/src/pages/operator/triage-fields.stories.tsx packages/app/src/pages/operator/incident.tsx
git commit -m "feat(operator): show the analysis as fields a person can check"
```

---

### Task 9: The analysis transcript

The spec puts the full transcript below the structured fields. It also records that
`message-timeline.tsx` cannot be reused — it is a container bound to session context and
write mutations. The reuse point is one level down, and this task proves it works.

**A note on this task's fixture, and why it is the one literal this plan does not spell
out:** `Message` and `Part` are SDK types owned by `@opencode-ai/sdk/v2`. Writing their
field values from memory would be inventing an API. Step 1 reads the real shapes; Step 3
writes a fixture against them and the typechecker proves it correct.

**Files:**
- Create: `packages/app/src/pages/operator/triage-timeline.tsx`
- Modify: `packages/app/src/pages/operator/fixtures.ts` — add `fixtureTranscript()`
- Modify: `packages/app/src/pages/operator/shell.tsx` — mount `DataProvider`
- Modify: `packages/app/src/pages/operator/incident.tsx` — render the transcript under the fields

**Interfaces:**
- Consumes: `Message`, `Part` from `@opencode-ai/sdk/v2`; `Message` component and
  `MessageProps` from `@opencode-ai/ui/message-part`; `DataProvider` from
  `@opencode-ai/ui/context/data`.
- Produces: `TriageTimeline(props: { sessionId: string; messages: Message[]; parts: Record<string, Part[]> })`,
  and `fixtureTranscript(sessionId: string): { messages: Message[]; parts: Record<string, Part[]> }`.

- [ ] **Step 1: Read the real message shapes before writing anything**

```bash
grep -rn "export type Message\b\|export type Part\b" packages/sdk/src/v2/ | head
sed -n '158,166p' packages/ui/src/components/message-part.tsx   # MessageProps
sed -n '13,40p' packages/ui/src/context/data.tsx                # the Data shape DataProvider needs
```

Note the required fields of `Message` and `Part`, and note that `MessageProps` is
`{ message, parts, actions?, showAssistantCopyPartID?, showReasoningSummaries? }` —
**omitting `actions` is what makes the rendering read-only.**

- [ ] **Step 2: Mount `DataProvider` in the operator shell**

`Message` calls `useData()`, so the shell must provide it. This is the correction to the
spec's reuse claim: the presentational component is reusable, but it is not context-free.

```tsx
// packages/app/src/pages/operator/shell.tsx — replace the whole file
import type { ParentProps } from "solid-js"
import { DataProvider } from "@opencode-ai/ui/context/data"

/**
 * Deliberately NOT `Layout`. The operator shell mounts inside the base providers only —
 * no terminals, models, permissions or prompt. Task 10 tests that this stays true.
 *
 * DataProvider is required by @opencode-ai/ui/message-part's Message component. It is fed
 * a read-only store: no session list, no diffs, no status — only what the transcript reads.
 */
export function OperatorShell(props: ParentProps) {
  return (
    <DataProvider data={{ session: [], session_status: {}, session_diff: {}, message: {}, part: {} }} directory="">
      <div class="flex h-full flex-col bg-background text-text">
        <header class="flex items-baseline gap-3 border-b border-border px-4 py-3">
          <h1 class="text-sm font-semibold">Инциденты</h1>
          <span class="text-xs text-text-muted">разбор и очередь</span>
        </header>
        <div class="min-h-0 flex-1">{props.children}</div>
      </div>
    </DataProvider>
  )
}
```

- [ ] **Step 3: Write the transcript fixture from the shapes read in Step 1**

Append to `packages/app/src/pages/operator/fixtures.ts`. Build two messages — one user, one
assistant — each with a single text part, filling **every required field the SDK types
declare** as read in Step 1. Type the export explicitly so the compiler checks it:

```ts
import type { Message, Part } from "@opencode-ai/sdk/v2"

export function fixtureTranscript(sessionId: string): { messages: Message[]; parts: Record<string, Part[]> } {
  // Fill each object against the SDK's required fields from Step 1.
  // `bun run typecheck` is the proof this is correct — do not cast with `as`.
  ...
}
```

If a required field has no sensible fixture value, that is a finding worth reporting, not a
reason to cast.

- [ ] **Step 4: Implement the transcript**

No virtualisation: a triage session is a handful of messages, and `virtua` here would be
complexity with no load behind it. Add it when a real transcript proves long.

```tsx
// packages/app/src/pages/operator/triage-timeline.tsx
import { For } from "solid-js"
import { Message as MessageView } from "@opencode-ai/ui/message-part"
import type { Message, Part } from "@opencode-ai/sdk/v2"

/**
 * Read-only transcript. `actions` is deliberately not passed: without it the message
 * renders with no fork or revert affordance, which is what read-only means here.
 */
export function TriageTimeline(props: { sessionId: string; messages: Message[]; parts: Record<string, Part[]> }) {
  return (
    <div class="flex flex-col gap-3">
      <For each={props.messages}>{(message) => <MessageView message={message} parts={props.parts[message.id] ?? []} />}</For>
    </div>
  )
}
```

- [ ] **Step 5: Render it under the fields**

In `packages/app/src/pages/operator/incident.tsx`, inside the scrolling body and directly
after the `<Show when={detail().fields}>` block, add a collapsed section:

```tsx
<Show when={detail().row.sessionId}>
  {(sessionId) => {
    const transcript = fixtureTranscript(sessionId())
    return (
      <details class="mt-4 rounded border border-border">
        <summary class="cursor-pointer px-3 py-2 text-xs uppercase tracking-wide text-text-muted">
          Лента разбора — {transcript.messages.length} сообщений
        </summary>
        <div class="border-t border-border p-3">
          <TriageTimeline sessionId={sessionId()} messages={transcript.messages} parts={transcript.parts} />
        </div>
      </details>
    )
  }}
</Show>
```

Add the imports `import { TriageTimeline } from "./triage-timeline"` and
`import { fixtureTranscript } from "./fixtures"` at the top of the file.

- [ ] **Step 6: Typecheck, test and look at it**

Run from `packages/app`: `bun run typecheck` — expected PASS, which is what proves the
fixture matches the SDK types.
Run from `packages/app`: `bun test --preload ./happydom.ts ./src` — expected PASS.
Run `bun run dev`, open `/queue/INC0048812`, expand "Лента разбора", and confirm the
messages render with no fork or revert control.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/pages/operator/triage-timeline.tsx packages/app/src/pages/operator/shell.tsx packages/app/src/pages/operator/fixtures.ts packages/app/src/pages/operator/incident.tsx
git commit -m "feat(operator): show the analysis transcript, read-only, without the session container"
```

---

### Task 10: The architecture guards

Two tests that defend decisions rather than behaviour. Without them the separate shell erodes on the first convenient import.

**Files:**
- Create: `packages/app/src/pages/operator/guards.test.ts`

**Interfaces:**
- Consumes: the operator source tree on disk.
- Produces: nothing importable.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/app/src/pages/operator/guards.test.ts
import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const DIR = join(import.meta.dir)

function sources(): { file: string; text: string }[] {
  return readdirSync(DIR)
    .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.endsWith(".test.ts") && !f.endsWith(".stories.tsx"))
    .map((file) => ({ file, text: readFileSync(join(DIR, file), "utf8") }))
}

describe("the operator surface is read-only", () => {
  test("imports no mutation primitive", () => {
    const offenders = sources().filter(({ text }) => /useMutation|createMutation/.test(text))
    expect(offenders.map((o) => o.file)).toEqual([])
  })
})

describe("the operator surface stays out of the developer stack", () => {
  test("imports no developer-only context", () => {
    const banned = /context\/(terminal|models|permission|prompt)|useTerminal|useModels|usePermission|usePrompt/
    const offenders = sources().filter(({ text }) => banned.test(text))
    expect(offenders.map((o) => o.file)).toEqual([])
  })

  test("does not import the session Layout", () => {
    const offenders = sources().filter(({ text }) => /from "@\/pages\/layout"/.test(text))
    expect(offenders.map((o) => o.file)).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests**

Run from `packages/app`: `bun test --preload ./happydom.ts ./src`
Expected: PASS on the code written in Tasks 1–9. If any fails, the offending import is the bug — remove it rather than relaxing the guard.

- [ ] **Step 3: Prove the guard actually bites**

Temporarily add `import { useMutation } from "@tanstack/solid-query"` to `packages/app/src/pages/operator/queue.tsx`, re-run the tests, and confirm the read-only test FAILS naming `queue.tsx`. Then remove the import and confirm it passes again. A guard that cannot fail is not a guard.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/pages/operator/guards.test.ts
git commit -m "test(operator): keep the surface read-only and out of the developer stack"
```

---

### Task 11: The end-to-end path

One scenario, the one worth having. Everything else is cheaper and steadier as a unit test.

**Files:**
- Create: `packages/app/e2e/operator-queue.spec.ts`

**Interfaces:**
- Consumes: the running dev server and the fixture data.
- Produces: nothing importable.

- [ ] **Step 1: Write the scenario**

```ts
// packages/app/e2e/operator-queue.spec.ts
import { expect, test } from "@playwright/test"

test("an operator opens the queue, switches tab and reads a ready analysis", async ({ page }) => {
  await page.goto("/queue")

  // The default tab is what is assigned to the operator.
  await expect(page.getByRole("tab", { name: /На мне/ })).toHaveAttribute("aria-selected", "true")

  // The group tab announces what it hides.
  const groupTab = page.getByRole("tab", { name: /Очередь группы/ })
  await expect(groupTab).toContainText("готово")
  await groupTab.click()

  // A breached SLA counts up rather than resting at zero.
  await expect(page.getByText("−", { exact: false }).first()).toBeVisible()

  // Open an incident with a ready analysis.
  await page.goto("/queue/INC0048812")
  await expect(page.getByText("Предполагаемая причина")).toBeVisible()
  await expect(page.getByText("Что не проверено")).toBeVisible()
  await expect(page.getByText(/Уверенность средняя/)).toBeVisible()
  await expect(page.getByText("Открыть тикет в ITSM")).toBeVisible()
})
```

- [ ] **Step 2: Run it**

Run from `packages/app`: `bun run test:e2e`
Expected: PASS. If the selectors miss, fix the test against the rendered markup — do not add test-only attributes to the components unless a role or visible text genuinely cannot address the element.

- [ ] **Step 3: Run the whole unit suite once more**

Run from `packages/app`: `bun test --preload ./happydom.ts ./src`
Expected: PASS, with no pre-existing test broken by the new routes.

- [ ] **Step 4: Commit**

```bash
git add packages/app/e2e/operator-queue.spec.ts
git commit -m "test(operator): walk the queue, the tabs and a ready analysis end to end"
```

---

## What this plan deliberately does not build

- **The projection and the live ITSM read.** `readQueue` and `readIncident` are the seam; Plan 2 replaces their bodies.
- **Triage state from the real AI service.** Plan 3. Until then `TriageState` arrives from fixtures, and `"unknown"` already renders correctly — which is the state the real integration will produce most often at first.
- **Any write path.** Out of scope for v1 by design, and enforced by Task 10.

## Dependencies this plan does not resolve

Carried from the spec, still open, and none of them block Tasks 1–10:

1. Whether the target ITSM exposes calendar-aware remaining time and clock state, or only a raw deadline. The `SlaSnapshot` contract absorbs either — if only a deadline arrives, the adapter in Plan 2 fills `remainingMs` and `clockState`, and `slaClockView` is untouched.
2. Operator identity mapping between the app's SSO identity and the ITSM user.
3. The target instance's real rate-limit rules.
4. Whether an incident can carry several concurrent resolution SLAs.
