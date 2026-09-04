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

/**
 * Seam. Where the operator goes to act, since this surface never writes. Plan 2 replaces the
 * body with the deployment's configured ITSM base URL; until then the host is a deliberately
 * reserved, non-resolving placeholder, named here rather than inlined into the detail view so
 * there is one place to change and one place to look.
 */
export function itsmIncidentUrl(number: string): string {
  return `https://itsm.example/incident/${number}`
}
