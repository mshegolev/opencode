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
