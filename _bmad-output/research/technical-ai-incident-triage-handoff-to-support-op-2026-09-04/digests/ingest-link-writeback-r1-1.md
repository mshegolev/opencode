# Digest: technical r1 — ingestion, session deep-linking, ticket write-back

Run note: budget-capped at 13 research tool calls / 5 pages fetched in full plus 8 search-result
surfaces. Items marked **(search-summary)** were read as a search engine's extracted quotations of
the named source, not as a full page fetch — their confidence is capped at medium for that reason.

## Findings

### Dimension A — ingestion

- **claim:** Jira Cloud webhooks are explicitly at-least-once: "some webhooks might be delivered more than once (if the delivery acknowledgment fails)".
  - source: https://developer.atlassian.com/cloud/jira/platform/webhooks/
  - publisher: Atlassian (vendor primary)
  - pub_date: undated (living doc)
  - accessed: 2026-09-04
  - confidence: high
  - class: delivery-guarantee

- **claim:** Jira Cloud retries a failed webhook up to five times, each attempt delayed by a randomized back-off of 5–15 minutes; retries fire on connection failure/timeout or HTTP 408, 409, 425, 429, 5xx.
  - source: https://developer.atlassian.com/cloud/jira/platform/webhooks/
  - publisher: Atlassian (vendor primary)
  - pub_date: undated (living doc)
  - accessed: 2026-09-04
  - confidence: high — vendor doc plus independent confirmation of the same "five times / 5–15 min / 408,409,425,429,5xx" figures in the Atlassian developer community announcement of the retry policy (https://community.developer.atlassian.com/t/new-jira-cloud-webhook-retry-policy/30554)
  - class: delivery-guarantee

- **claim:** After 30 minutes without a successful response, Jira degrades to a single delivery attempt per webhook until a success is recorded — i.e. an endpoint outage longer than ~30 min silently loses the retry safety net.
  - source: https://developer.atlassian.com/cloud/jira/platform/webhooks/
  - publisher: Atlassian
  - pub_date: undated
  - accessed: 2026-09-04
  - confidence: medium (single-sourced to the vendor)
  - class: failure-mode

- **claim:** Jira sends `X-Atlassian-Webhook-Identifier` — unique per webhook within a tenant and **stable across retries** — plus `X-Atlassian-Webhook-Retry` carrying the retry count; the identifier is the documented dedupe key.
  - source: https://developer.atlassian.com/cloud/jira/platform/webhooks/
  - publisher: Atlassian
  - pub_date: undated
  - accessed: 2026-09-04
  - confidence: high (vendor doc + community announcement thread)
  - class: idempotency-pattern

- **claim:** Jira Cloud states latency targets, not ordering: Primary webhooks "should be delivered within 30 seconds", Secondary (bulk-operation) webhooks up to 15 minutes; there is a concurrency cap of 20 in-flight requests per tenant+webhook-URL-host for Primary and 10 for Secondary. No ordering guarantee is documented anywhere on the page.
  - source: https://developer.atlassian.com/cloud/jira/platform/webhooks/
  - publisher: Atlassian
  - pub_date: undated
  - accessed: 2026-09-04
  - confidence: medium (single-sourced; and the 30s figure is an intent/SLO statement, not measured behaviour)
  - class: delivery-guarantee

- **claim:** Jira Cloud *dynamic* webhooks (the ones registered via REST by an app) expire 30 days after creation or last refresh — an unrefreshed subscription stops delivering with no error at the consumer.
  - source: https://developer.atlassian.com/cloud/jira/platform/webhooks/
  - publisher: Atlassian
  - pub_date: undated
  - accessed: 2026-09-04
  - confidence: medium (single-sourced)
  - class: failure-mode

- **claim:** Zendesk explicitly refuses a delivery guarantee: "Zendesk makes a best effort to deliver actions to webhooks a single time. However, we can't guarantee it." Consumers are told to "ensure actions resulting from your webhooks are idempotent" and to use webhook signatures to detect duplicate invocations.
  - source: https://developer.zendesk.com/documentation/webhooks/creating-and-monitoring-webhooks/
  - publisher: Zendesk (vendor primary)
  - pub_date: undated (living doc)
  - accessed: 2026-09-04
  - confidence: high
  - class: delivery-guarantee

- **claim:** Zendesk webhook requests have a 12-second timeout; timed-out requests are retried up to five times, HTTP 409 up to three times, and 429/503 only when a `retry-after` header is under 60 seconds.
  - source: https://developer.zendesk.com/documentation/webhooks/creating-and-monitoring-webhooks/
  - publisher: Zendesk
  - pub_date: undated
  - accessed: 2026-09-04
  - confidence: medium — vendor doc only; the identical numbers echoed by third-party guides (hookdeck, svix) trace back to this same page, so treat as single-sourced
  - class: delivery-guarantee

- **claim:** Zendesk has a circuit breaker: it trips when, within a five-minute window, ≥70% of a webhook's requests error **or** >1,000 error responses occur (and never below 100 requests in the window); tripped webhooks pause five seconds before retrying. An activity log of every invocation is retained for seven days and is queryable via the invocations API.
  - source: https://developer.zendesk.com/documentation/webhooks/creating-and-monitoring-webhooks/
  - publisher: Zendesk
  - pub_date: undated
  - accessed: 2026-09-04
  - confidence: medium (single-sourced to vendor)
  - class: delivery-guarantee

- **claim:** ServiceNow has no externally-registerable native outbound webhook for incidents: real-time push is built by hand as a Business Rule on the table firing an Outbound REST Message, and the documented fallback is delta polling `incident` filtered on `sys_updated_on>`.
  - source: https://rollout.com/integration-guides/servicenow/quick-guide-to-implementing-webhooks-in-servicenow **(search-summary)**
  - publisher: Rollout (integration vendor, second tier)
  - pub_date: undated
  - accessed: 2026-09-04
  - confidence: medium — architecturally consistent with ServiceNow's own model, but NOT confirmed against docs.servicenow.com in this run. Verify before relying on it.
  - class: api-capability

- **claim:** ServiceNow inbound REST rate limiting is rule-driven via the `sys_rate_limit_rules` table (per user, per role, or all users, counted per node, per hour), returns HTTP 429 when the semaphore queue is full, and there is no quota on *outbound* REST calls (except via IntegrationHub licensing).
  - source: https://www.servicenow.com/community/developer-articles/understanding-servicenow-rest-api-rate-limits-key-concepts-amp/ta-p/3407367
  - publisher: ServiceNow Community developer article (community-contributed, NOT vendor doc)
  - pub_date: 2025-10-17, edited 2026-04-14
  - confidence: medium for the mechanism (`sys_rate_limit_rules`, 429, per-node counting — corroborated across several ServiceNow Community forum threads), **low for every number in it**
  - class: rate-limit

- **claim:** The specific ServiceNow figures in that article — ~25,000 req/hour per integration user, ~100,000 req/hour per instance, 50–100 req/sec burst, 16 semaphores + 150 queue depth = 166 concurrent transactions — are hedged ("approximately", "typical default") and I found no ServiceNow product-documentation confirmation.
  - source: same as above
  - publisher: ServiceNow Community (community-contributed)
  - pub_date: 2026-04-14 (last edit)
  - confidence: low — **single-sourced, unconfirmed, treat as folklore until checked against your own instance's `sys_rate_limit_rules_list.do`**
  - class: rate-limit

- **claim:** Zendesk trial accounts cap webhooks at 10 and 60 invocations per minute (production tiers not established in this run).
  - source: https://support.zendesk.com/hc/en-us/articles/4408836101146-Managing-webhooks **(search-summary)**
  - publisher: Zendesk
  - pub_date: undated
  - accessed: 2026-09-04
  - confidence: low (search-summary, single-sourced, and only about trials)
  - class: rate-limit

- **claim:** The webhook-plus-reconciliation-sweep pattern is real and recommended by integration vendors: run webhooks for latency and a periodic poll (commonly every 15–60 minutes) that compares recent events/IDs against stored records and backfills gaps left by outages, misconfigured subscriptions, or dropped events.
  - source: https://docs.payabli.com/guides/pay-ops-notifications-webhooks-vs-polling and https://hookdeck.com/outpost/guides/common-outbound-webhook-mistakes **(both search-summary)**
  - publisher: Payabli (vendor docs) and Hookdeck (webhook-infrastructure vendor)
  - pub_date: undated
  - accessed: 2026-09-04
  - confidence: medium — the pattern is consistently stated by two independent publishers, but **neither is an ITSM vendor and neither is a standards body**. The "15–60 minutes" interval is a rule of thumb, not a specification. I did not find ServiceNow/Atlassian/Zendesk documentation that *recommends* the reconciliation sweep by name.
  - class: guidance

### Dimension B — deep-linking a machine session to a human reader

- **claim:** The W3C TAG's "Good Practices for Capability URLs" is the standing reference for the share-a-secret-link pattern: URLs must be HTTPS, unique and unguessable (a v4 UUID is the named recommendation), revocable by the authenticated user, and ideally issued per recipient so one leak does not invalidate everyone's link.
  - source: https://w3ctag.github.io/capability-urls/ **(search-summary)**
  - publisher: W3C Technical Architecture Group
  - pub_date: 2014 draft lineage — **old**, and I still trust it because it is the only widely-cited normative-ish treatment of the pattern, the leakage vectors it names are structural to HTTP/browsers rather than version-dependent, and nothing has superseded it
  - accessed: 2026-09-04
  - confidence: medium (search-summary of a primary source)
  - class: auth-pattern

- **claim:** The documented leak vectors for capability URLs are exactly the ones an incident-ticket link would hit: URLs pasted into shorteners, typed into browser address bars and shipped to search/phishing-detection services, and — most relevant — leaked via the HTTP `Referer` header from links on the capability-protected page itself, for which the TAG recommends `rel="noreferrer"` on outbound links.
  - source: https://w3ctag.github.io/capability-urls/ **(search-summary)**
  - publisher: W3C TAG
  - pub_date: 2014 lineage
  - accessed: 2026-09-04
  - confidence: medium
  - class: failure-mode

- **claim:** Grafana's externally-shared ("public") dashboards are the closest mature analogue to "here is the run, read it" for a reader with no account, and its safety design is instructive: the shared view is read-only, arbitrary queries cannot be run through it, only the queries already stored on the dashboard execute on the backend — and Grafana states plainly that "anyone with the URL can access the dashboard", i.e. security rests on link secrecy.
  - source: https://grafana.com/docs/grafana/latest/visualizations/dashboards/share-dashboards-panels/shared-dashboards/ **(search-summary)**
  - publisher: Grafana Labs (vendor primary)
  - pub_date: undated (latest docs)
  - accessed: 2026-09-04
  - confidence: medium
  - class: linking-pattern

- **claim:** A named operational cost of external share links: they can drive a large volume of queries against the underlying data sources, mitigated in Grafana by caching and rate limiting. A session link posted into every incident inherits this — the link's traffic is unauthenticated and unbounded.
  - source: same Grafana doc **(search-summary)**
  - publisher: Grafana Labs
  - pub_date: undated
  - accessed: 2026-09-04
  - confidence: medium
  - class: failure-mode

### Dimension C — write-back into the ticket, and noise

- **claim:** ServiceNow's two journal fields carry different notification semantics by design: Work notes are restricted to `itil`-role users and are invisible to the caller; Additional comments are customer-visible and are the field notifications are conventionally wired to. Internal-only bot output therefore belongs in `work_notes`, not `comments`.
  - source: https://www.servicenow.com/community/itsm-forum/service-desk-incident-work-notes-vs-additional-comments-customer/td-p/732601 and https://www.servicenow.com/community/servicenow-ai-platform-articles/work-notes-additional-comments-behavior-with-activity-or-always/ta-p/2327824 **(both search-summary)**
  - publisher: ServiceNow Community (community-contributed; the role restriction is also stated in O'Reilly's *Learning ServiceNow*)
  - pub_date: undated / older
  - accessed: 2026-09-04
  - confidence: medium for the field semantics (multi-source, long-standing, stable platform behaviour); low for "notifications fire on comments but not work notes" as a universal — **that is per-instance notification-scheme configuration, not a platform guarantee**
  - class: guidance

- **claim:** Jira Service Management exposes an explicit internal/public switch on comment creation: `POST /rest/servicedeskapi/request/{issueIdOrKey}/comment` with `{"public": false}`; via the platform API the equivalent is the comment property `sd.public.comment` = `{"internal": true}`.
  - source: https://community.atlassian.com/forums/Jira-Service-Management/How-to-send-Internal-comments-to-Jira-from-API/qaq-p/2905993 and https://github.com/atlassian/atlassian-mcp-server/issues/139 **(both search-summary)**
  - publisher: Atlassian Community; Atlassian's own MCP server issue tracker
  - pub_date: undated / recent (the MCP issue is a live feature request)
  - accessed: 2026-09-04
  - confidence: medium — two independent surfaces agree on both mechanisms, but I did NOT fetch the servicedeskapi reference page itself; verify the exact field name before coding
  - class: api-capability

- **claim:** Marking a comment internal is not sufficient to prevent a customer notification, and Atlassian documents two concrete ways it fails: (1) a comment first posted as public and later edited to internal has already dispatched the customer notification — detectable only by finding PUT requests in Tomcat access logs / the "edited" flag; (2) bug JSDSERVER-6269, where a customer who is both watcher and request participant and is @-mentioned in an internal comment receives a Jira *core* user-mention notification instead.
  - source: https://support.atlassian.com/jira/kb/a-customer-notification-was-sent-from-an-internal-comment-added-to-a-jsm-ticket/
  - publisher: Atlassian Support KB (vendor primary)
  - pub_date: updated 2025-09-26
  - accessed: 2026-09-04
  - confidence: high (vendor KB, names a specific bug ID and affected versions: JSM Server/DC 3.0.0+)
  - class: failure-mode

- **claim:** Bot comment noise is a recognised, under-solved problem rather than a hypothetical: a long-running GitHub community discussion asks for the ability to mute bots because "their automatic comments add noise to notifications/emails and there seems to be no way to configure that", with the explicit observation that as teams add more bots, notifications only get noisier.
  - source: https://github.com/orgs/community/discussions/5793 **(search-summary)**
  - publisher: GitHub community discussions (user-reported, not vendor guidance)
  - pub_date: undated (long-running thread)
  - accessed: 2026-09-04
  - confidence: medium as evidence that the failure mode is real and widely felt; low as evidence of any particular remedy
  - class: failure-mode

- **claim:** In Jira, work done by automation is attributed to the automation actor, not the triggering human — "Jira doesn't see you as the 'change agent', it sees the Automation bot" — which is what makes bot writes both auditable (distinct authorship) and noisy (they notify like any other actor), and suppressing them is an admin-level notification-scheme change, not a per-rule setting.
  - source: https://community.atlassian.com/forums/Jira-questions/Can-I-stop-receiving-JIRA-automation-notifications-when-I-ve/qaq-p/2877593 **(search-summary)**
  - publisher: Atlassian Community (community answer)
  - pub_date: undated
  - accessed: 2026-09-04
  - confidence: low-medium (community, single-sourced)
  - class: guidance

- **claim:** ITSM tools do ship a per-ticket notification kill switch, and its limits matter: a "Suppress notifications" checkbox on the ticket header stops client-facing notifications only — internal-facing notifications to assigned ITIL users and the internal watch list keep firing.
  - source: https://www.bu.edu/tech/about/service/incident-management/managing-tickets/how-to-basics/suppress-notifications **(search-summary)**
  - publisher: Boston University IT (an operator running a real ServiceNow-style instance — second tier but an actual practitioner)
  - pub_date: undated
  - accessed: 2026-09-04
  - confidence: low-medium (one operator's instance; behaviour may be instance-specific)
  - class: guidance

## Failure modes catalogue

1. **Duplicate session per incident from webhook redelivery.** Both Jira (at-least-once, explicit) and Zendesk (no guarantee, explicit) will re-deliver. Mitigation is a dedupe key: Jira's `X-Atlassian-Webhook-Identifier` is stable across retries; Zendesk points at webhook signatures instead and tells you to make your handler idempotent. Ref: Atlassian webhooks doc; Zendesk webhooks doc.
2. **Duplicate session from the reconciliation sweep racing the webhook.** Implied by the belt-and-braces pattern itself: the sweep re-reads the same incident the webhook already delivered. The dedupe key must therefore be the *incident number*, not the delivery id — a delivery-id dedupe does nothing against a poller. Ref: Payabli/Hookdeck reconciliation guidance.
3. **Silent gap during an endpoint outage > 30 minutes (Jira).** Retries degrade to one attempt per webhook until a success is recorded. Ref: Atlassian webhooks doc.
4. **Silent gap from an expired dynamic webhook (Jira, 30 days).** Delivery just stops; the consumer sees no error. Ref: Atlassian webhooks doc.
5. **Silent gap from a tripped circuit breaker (Zendesk).** ≥70% errors or >1,000 errors in five minutes pauses delivery; only the seven-day invocations log reveals it. A slow consumer (>12s) trips this on its own. Ref: Zendesk webhooks doc.
6. **Self-inflicted 429 from an aggressive poller (ServiceNow).** Inbound REST is rule-limited per user/role via `sys_rate_limit_rules` with per-node hourly counting; a tight `sys_updated_on>` poll burns the same integration user's budget every cycle. Ref: ServiceNow Community rate-limit article (numbers unconfirmed).
7. **Out-of-order processing.** No ITSM vendor read in this run documents an ordering guarantee. Jira documents Primary (~30s) and Secondary (~15 min) *flows* with different latencies, which by itself means a bulk-triggered event can land long after a later single event. Ref: Atlassian webhooks doc.
8. **The link leaks and exposes diagnostic content.** Capability URLs escape via shorteners, address-bar-to-search, and the `Referer` header from outbound links on the session page itself. A triage session containing customer data behind a bare unguessable URL inherits every one of these. Ref: W3C TAG.
9. **Unauthenticated share link becomes an unmetered query source.** Grafana names the load problem for public dashboards and answers it with caching and rate limiting; a session-replay link posted into every ticket has the same shape. Ref: Grafana shared-dashboards doc.
10. **"Internal" comment notifies the customer anyway.** Vendor-documented in JSM: a public-then-edited-to-internal comment has already sent the notification, and JSDSERVER-6269 leaks internal-comment @-mentions as Jira core notifications. For a bot, the analogous trap is any write path that posts first and re-classifies second. Ref: Atlassian KB, updated 2025-09.
11. **Notification storm from writing to every ticket.** Widely reported and structurally unsolved: bot comments notify like human comments, attribution to the bot actor does not exempt them, and the remedies available are blunt (admin notification-scheme changes; a per-ticket suppress switch that only silences the client side). Ref: GitHub community discussion 5793; Atlassian Community; BU IT.

## Leads worth chasing

- **Contradiction — Jira's advice vs the reconciliation pattern.** Atlassian's webhook page frames webhooks as removing the need to "periodically poll Jira (via the REST APIs) to determine whether changes have occurred", while the same page documents at-least-once delivery, 30-day expiry, and post-30-minute degraded retry. The vendor's stated design intent and its own documented guarantees point in opposite directions; the independent guidance (Payabli, Hookdeck) sides with keeping the poll.
- **Contradiction — Zendesk retry counts.** The doc gives three different retry ceilings for three failure classes (timeout: 5, HTTP 409: 3, 429/503: conditional on `retry-after` < 60s) while third parties summarise it flatly as "retried up to five times". Chase the exact per-status matrix before sizing a dead-letter queue.
- **ServiceNow numbers are unverified.** The only figures I found live in a community-contributed article and are hedged. The authoritative check is cheap and local: read `sys_rate_limit_rules_list.do` on the target instance. Do that before designing any poll interval.
- **New entity — Zendesk invocations API + 7-day activity log.** A vendor-provided, queryable delivery ledger. That is the natural data source for a "did we miss an incident?" reconciliation check on Zendesk specifically, and possibly cheaper than a ticket-table sweep.
- **New entity — JSDSERVER-6269.** A live Atlassian bug ID; worth checking its current status and whether a Cloud-side equivalent exists.
- **Unexpected connection — Grafana's read-only, stored-queries-only external share.** Its design (no arbitrary queries reachable through the shared view) is a directly transferable constraint for a read-only agent-session view: render from a frozen snapshot, never let the link reach a live query surface.
- **Unchased — ServiceNow's own webhook/event story.** ServiceNow has moved on things like Event Management, Flow Designer and the Now Platform's outbound eventing; I only established the Business-Rule-plus-Outbound-REST pattern through a second-tier source. docs.servicenow.com is the next stop.

## Looked for and could not find

- **Ivanti, BMC Helix, and Freshservice: nothing at all.** Budget ran out before any of the three was queried. Their ingestion capabilities, rate limits, and delivery guarantees are entirely unestablished in this run.
- **ServiceNow product documentation (docs.servicenow.com) on rate limits or outbound eventing.** Everything I have for ServiceNow comes from community articles and forum threads. Every ServiceNow claim in this digest should be treated as provisional.
- **Any ITSM vendor documenting an ordering guarantee for webhook delivery.** Not "found none guaranteed" — found the question unaddressed in Atlassian's and Zendesk's docs. Absence of a statement is not a guarantee of disorder, but you must design as if unordered.
- **Any ITSM vendor recommending the polling-alongside-webhooks reconciliation sweep by name.** The pattern is endorsed only by payments/webhook-infrastructure vendors. The brief asked specifically whether it is recommended and by whom: the honest answer is "by webhook-infrastructure and fintech vendors, not by the ITSM platforms themselves, at least not in what I read".
- **Production (non-trial) Zendesk webhook rate limits.** Only the trial figures surfaced.
- **AI-agent platform practice for read-only shareable session links.** I found the CI/observability analogue (Grafana) but no primary documentation from an agent platform on stable run permalinks, expiring signed tokens for session replay, or SSO-vs-capability-URL trade-offs for agent transcripts. This is the thinnest part of Dimension B and it is thin because the public material is thin, not merely because I ran out of calls.
- **Reported case studies of ITSM bot-comment noise with named remediation.** What exists is a GitHub-side complaint thread and generic admin guidance. I found no engineering writeup from a team that ran an automation-writes-to-every-ticket integration and described how they controlled the resulting noise. That is a genuine gap in the public record.
