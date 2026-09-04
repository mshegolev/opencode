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
