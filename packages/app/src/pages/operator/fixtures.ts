import type { Message, Part } from "@opencode-ai/sdk/v2"
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
