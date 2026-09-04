import type { Message, Part } from "@opencode-ai/sdk/v2"
import type { IncidentDetail, IncidentRow, QueuePage, QueueScope } from "./types"

const iso = (ms: number) => new Date(ms).toISOString()

// Captured once, when this module first loads (effectively "the moment the app opened").
// Breach deadlines and the last-ingest-event instant are expressed relative to this fixed
// point rather than to the `nowMs` argument each call receives. `readQueue` passes a fresh
// `Date.now()` on every 30s refetch — anchoring to that would make every deadline (and the
// ingest clock) hop back to its starting distance twice a minute, which is why the countdown
// used to look dead and the staleness banner could never engage. Anchoring here instead means
// a breach instant is a fixed point in real time, so `remainingMs = breachInstant - nowMs`
// genuinely shrinks as real seconds pass, and `lastEventAt` genuinely ages past the ingest
// threshold once the app has been open long enough — instead of resetting every refetch.
const FIXTURE_ANCHOR_MS = Date.now()

/** A fixed instant `offsetMs` away from the module-load anchor — negative is already past. */
function anchoredAt(offsetMs: number): number {
  return FIXTURE_ANCHOR_MS + offsetMs
}

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
      sla: {
        clockState: "running",
        remainingMs: anchoredAt(41 * 60_000) - nowMs,
        breachAt: iso(anchoredAt(41 * 60_000)),
        capturedAt: captured,
      },
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
      sla: {
        clockState: "running",
        remainingMs: anchoredAt(67 * 60_000) - nowMs,
        breachAt: iso(anchoredAt(67 * 60_000)),
        capturedAt: captured,
      },
      triage: "running",
    },
    {
      number: "INC0048790",
      priority: 2,
      description: "Не открывается отчёт по остаткам",
      assignedToMe: true,
      group: "Отчётность",
      status: "In progress",
      sla: {
        clockState: "running",
        remainingMs: anchoredAt(192 * 60_000) - nowMs,
        breachAt: iso(anchoredAt(192 * 60_000)),
        capturedAt: captured,
      },
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
      // Paused: the clock does not run, so remaining time is a flat constant — not anchored.
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
      sla: {
        clockState: "running",
        remainingMs: anchoredAt(52 * 3_600_000) - nowMs,
        breachAt: iso(anchoredAt(52 * 3_600_000)),
        capturedAt: captured,
      },
      triage: "not-started",
    },
    {
      number: "INC0048755",
      priority: 3,
      description: "Не приходит СМС с кодом подтверждения",
      assignedToMe: false,
      group: "Аутентификация",
      status: "New",
      // Deliberately stale: exercises the age treatment. capturedAt stays live off nowMs so it
      // is always ~4 minutes old, regardless of how long the module has been loaded.
      sla: {
        clockState: "running",
        remainingMs: anchoredAt(348 * 60_000) - nowMs,
        breachAt: iso(anchoredAt(348 * 60_000)),
        capturedAt: iso(nowMs - 240_000),
      },
      triage: "unknown",
    },
    {
      number: "INC0048701",
      priority: 4,
      description: "Опечатка в тексте письма",
      assignedToMe: false,
      group: "Контент",
      status: "In progress",
      // Deliberately breached: the deadline is anchored in the past and stays there.
      sla: { clockState: "breached", breachAt: iso(anchoredAt(-34 * 60_000)), capturedAt: captured },
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
    // Anchored to module load, not nowMs: the last ingest event is a fixed instant, so the
    // silence since it arrived genuinely grows with real elapsed time instead of resetting to
    // "12 seconds ago" on every 30s refetch — which is what made the staleness banner
    // unreachable before.
    lastEventAt: iso(anchoredAt(-12_000)),
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
    // INC0048771 (paused) is the one incident whose detail is deliberately served from the
    // projection snapshot, so the "показан снимок" banner on the incident screen is a state a
    // person can actually open rather than dead code no fixture ever reaches.
    fromSnapshot: number === "INC0048771",
    serverTime: iso(nowMs),
  }
}

export function fixtureTranscript(sessionId: string): { messages: Message[]; parts: Record<string, Part[]> } {
  const userMessageId = "msg_triage_user"
  const assistantMessageId = "msg_triage_assistant"
  const userPartId = "prt_triage_user_text"
  const assistantPartId = "prt_triage_assistant_text"
  const createdAt = 1_757_000_000_000

  const messages: Message[] = [
    {
      id: userMessageId,
      sessionID: sessionId,
      role: "user",
      time: { created: createdAt },
      agent: "triage",
      model: { providerID: "anthropic", modelID: "claude-sonnet-4-5" },
    },
    {
      id: assistantMessageId,
      sessionID: sessionId,
      role: "assistant",
      time: { created: createdAt + 1_000, completed: createdAt + 42_000 },
      parentID: userMessageId,
      modelID: "claude-sonnet-4-5",
      providerID: "anthropic",
      mode: "triage",
      agent: "triage",
      path: { cwd: "/incident", root: "/incident" },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    },
  ]

  const parts: Record<string, Part[]> = {
    [userMessageId]: [
      {
        id: userPartId,
        sessionID: sessionId,
        messageID: userMessageId,
        type: "text",
        text: "Разбери причину сбоя оплаты на кассе.",
      },
    ],
    [assistantMessageId]: [
      {
        id: assistantPartId,
        sessionID: sessionId,
        messageID: assistantMessageId,
        type: "text",
        text: "Причина — таймауты шлюза эквайринга на узле pay-gw-03.",
      },
    ],
  }

  return { messages, parts }
}
