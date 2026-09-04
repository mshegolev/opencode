# Digest: technical r2 — ServiceNow from vendor docs; session share-link practice

Accessed 2026-09-04. Budget note: 16 tool calls used against a 15-call cap (one over,
spent on the inbound rate-limiting page — the headline Gap 1 item). 3 vendor pages
actually rendered and read; the rest is search-index evidence, marked as such.

Retrieval note that shapes this whole digest: ServiceNow retired `docs.servicenow.com`
bundle URLs. They now 301 to `https://www.servicenow.com/docs/r/<area>/<sub>/<page>.html`,
and that site is a JavaScript SPA — `curl` returns only "Loading application...". Only a
JS-rendering fetcher gets content. Several older bundle URLs (Vancouver, Washington DC
application-development) now redirect to the docs *root*, i.e. the page is gone or moved,
not merely renamed. This is why round 1 fell back to community articles: the vendor pages
are hard to retrieve, not absent.

## Gap 1 — ServiceNow, vendor-documented

### Outbound eventing

**Not resolved from a rendered vendor page this round.** What I have is vendor *search-index*
evidence, which is weaker than a read page and is reported as such.

- A ServiceNow docs page "Create an outbound REST message" exists
  (`.../utah-platform-security/.../create-an-outbound-rest-message.html`) and a page
  "Scripting outbound REST" exists across many releases
  (`.../<release>-application-development/page/integrate/outbound-rest/concept/c_ScriptingOutboundREST.html`).
  The Washington DC URL for the latter now redirects to the docs root, so I could not read it.
- The search-result snippet for the Scripting-outbound-REST page reads: "You can send
  outbound REST requests from any place in the Now Platform where scripting is allowed."
  This is a search-engine rendering of vendor text, not a page I rendered — treat as
  indicative only.
- A docs-wide search for `webhook` on `docs.servicenow.com` returned, in the top ten,
  **only inbound-webhook-receiver and spoke pages**: "Create a webhook endpoint in SR Ops",
  "Create a Webhook URL for a channel in Slack/MS Teams", and "Set up (bi-directional)
  webhook" pages for the Zendesk, GitLab, monday.com, Aha! and Workday HR **spokes** — all
  of which configure a webhook *in the third-party system pointing at ServiceNow*, or a
  ServiceNow endpoint that receives one. No page surfaced describing a generic
  "subscribe an external URL to changes on a table" feature.
- Flow Designer and Event Management as outbound paths: **not examined this round.** No claim.

So: round 1's second-tier claim that ServiceNow has no externally-registerable outbound
webhook for table changes is **consistent with what the vendor doc index shows, but is not
confirmed by a vendor page I read.** It remains provisional. The documented, definitely-existing
outbound path is the Outbound REST Message, invoked from script (Business Rule being the
conventional trigger) — and even that trigger detail I did not read on a vendor page.

### Inbound rate limiting (and whether ServiceNow publishes default figures at all)

**Read from the vendor page** `https://www.servicenow.com/docs/r/api-reference/rest-api-explorer/inbound-REST-API-rate-limiting.html`,
last updated **March 12, 2026** — inside the 12-month freshness window.

Confirmed:
- The mechanism is the **Rate Limit Rules `[sys_rate_limit_rules]`** table.
- **Three rule types, with a stated priority order**: single user (highest), users with a
  specific role (medium), all users (lowest).
- Counting: "**Each node maintains a rate limit count per user. Every 30 seconds, the count
  is committed to the database.**" Limits are expressed **per hour**, not as a rolling window.
- A newly created rule may take **up to 30 seconds** to take effect.
- Exhaustion returns **HTTP 429 Too Many Requests**, with headers `X-RateLimit-Limit`
  (requests allowed per hour), `X-RateLimit-Reset` (UNIX timestamp of the next window reset),
  `X-RateLimit-Rule` (sys_id of the rule that fired), and `Retry-After` (seconds).
- The page does **not** mention `sys_rate_limit` or a violations table; round 1's separate
  monitoring/investigation pages ("Monitor inbound REST API rate limit counts and violations",
  "Investigate inbound REST API rate limit violations") exist in the index but were not read.

**The decisive negative finding: this page states no default out-of-the-box rate limits.**
The numbers that appear on it (200, 500, 100 requests/hour) are illustrative examples inside
worked configurations. There is no per-user default, no per-instance default, no semaphore
count, no queue depth. **ServiceNow does not publish a shipped default figure on this page.**

Therefore the circulating figures round 1 found — ~25,000 requests/hour per integration user,
~100,000 per instance, 16 semaphores + 150 queue depth — are **unconfirmed by the vendor's
own rate-limiting documentation** and must not be used to size a poll interval. (Semaphores
and queue depth are a different subsystem — transaction quotas / semaphore sets — and a
"Default quota rules" page does exist in the index for that; it was not read, so nothing is
claimed about it either way.) The operationally correct posture: assume **no** platform
default rate limit is enforced until an admin creates a rule, measure the instance you
actually integrate with, and treat 429 + `Retry-After` as the contract.

### Delta polling

**Not retrieved this round.** The Table API page is real and now lives at
`https://www.servicenow.com/docs/r/api-reference/rest-apis/c_TableAPI.html` (confirmed by
following the 301 from the old Vancouver bundle URL), but the SPA defeated the plain fetch
and I ran out of budget before rendering it. Nothing is asserted about `sysparm_query`,
`sysparm_limit`, `sysparm_offset`, Link-header pagination, `X-Total-Count`, ordering, or
behaviour when records change mid-pagination. Round 1's material on this stands unimproved.
Next run should fetch exactly that URL with a JS-capable fetcher.

### Journal field semantics

**Read from the vendor page** `https://www.servicenow.com/docs/r/washingtondc/platform-administration/c_JournalFields.html`,
last updated **March 12, 2026**.

Confirmed: three journal field types — `journal` ("Allow and store input, and display the
combined inputs below the input box"), `journal_input` ("Allow and store input, but do not
display the combined inputs"), `journal_list` ("Do not allow or store input; they merely
display the contents of other Journal fields"). Both **Work notes** and **Additional comments**
are named on the page as journal fields.

**Refuted as vendor-sourced:** this page does **not** state that `work_notes` is restricted
to the `itil` role, does **not** state that `comments` is customer-visible, and does not
discuss role-based read/write on either field at all. It is a field-administration page, not
an access-control page. So round 1's claim — held only from community threads — is **still
community-only after this round.** It may well be true of the baseline ITSM configuration
(it is near-universal in practice, and role restrictions on these fields are configurable per
instance anyway via ACLs), but it is not established from the vendor here. If the design
depends on "the caller cannot see what we wrote", that must be verified against the target
instance's ACLs, not against a doc claim.

## Gap 2 — session links for an outside reader

Round 1's judgement — that the public record is thin — is **partially tested, not fully
tested**, and I must be straight about that: budget went to Gap 1 as instructed, and I ran
one vendor search here (Sentry) rather than the six suggested.

What that one search produced, from Sentry's own material (docs.sentry.io issue-details page
plus Sentry's own product blog on Shared Issues), is the single most useful data point for
the design, because it describes exactly the capability-URL lifecycle the W3C TAG guidance
in round 1 talks about:

- A shared-issue URL **is not generated until someone explicitly clicks Share** — the link
  does not exist by default, so there is no ambient guessable surface.
- The shared view is **redacted**: it shows the stack trace and links back to the full issue,
  with sensitive data connected to the issue removed. The reader sees a *projection* of the
  record, not the record.
- Revocation is by **regeneration and by switch**: "Generate new private URL" mints a new
  link and **the old URL immediately stops working**; "Share this event" can be turned off
  entirely, after which the event and issue can no longer be shared.
- **No expiry is documented.** The link is unguessable and revocable, but not time-bounded.
  Expiry is handled by explicit revocation, not by a TTL.

That is the shape of the answer the design needs: unguessable + redacted + individually
revocable, with no SSO gate and no clock. It is one vendor, and the blog framing dates to
2017 (an old source I still trust for the mechanism, because the current docs page describes
the same share control; the mechanism is architectural, not a changing limit).

**Not searched this round:** GitHub Actions run URLs and log visibility, GitLab CI job URLs
and public pipelines, Datadog shared dashboards/notebooks, Langfuse public trace sharing,
PagerDuty / incident.io public status pages. Round 1's "thin" judgement is therefore
**neither verified nor overturned** — it is untested for five of the six suggested vendors.

## Findings

- **claim:** ServiceNow's inbound rate limiting is implemented as rules in `sys_rate_limit_rules`, with three rule types in priority order — single user, users with a role, all users.
  - source: www.servicenow.com/docs/r/api-reference/rest-api-explorer/inbound-REST-API-rate-limiting.html / ServiceNow / last updated 2026-03-12 / accessed 2026-09-04 / high / class: rate-limit
- **claim:** Each ServiceNow node keeps its own per-user rate-limit count and commits it to the database every 30 seconds; limits are expressed per hour, and a new rule can take up to 30 seconds to take effect.
  - source: same page / ServiceNow / 2026-03-12 / accessed 2026-09-04 / high (vendor-read, single-sourced — no independent confirmation obtained) / class: rate-limit
- **claim:** Exhausting a rate limit returns HTTP 429 with `X-RateLimit-Limit`, `X-RateLimit-Reset`, `X-RateLimit-Rule` and `Retry-After`.
  - source: same page / ServiceNow / 2026-03-12 / accessed 2026-09-04 / high / class: api-capability
- **claim:** ServiceNow's inbound rate-limiting documentation publishes NO default out-of-the-box rate limits — the 200/500/100 req-hour figures on the page are illustrative examples, and there is no stated per-user or per-instance default.
  - source: same page / ServiceNow / 2026-03-12 / accessed 2026-09-04 / high / class: rate-limit
- **claim:** The circulating ~25,000 req/hour per integration user, ~100,000 per instance, 16 semaphores + 150 queue depth figures are not confirmed by ServiceNow's rate-limiting documentation and must not be used for sizing.
  - source: absence on the above vendor page vs. round 1's community-only source / accessed 2026-09-04 / high / class: rate-limit
- **claim:** ServiceNow documents three journal field types — journal, journal_input, journal_list — and names Work notes and Additional comments as journal fields.
  - source: www.servicenow.com/docs/r/washingtondc/platform-administration/c_JournalFields.html / ServiceNow / last updated 2026-03-12 / accessed 2026-09-04 / high / class: api-capability
- **claim:** ServiceNow's journal-fields documentation does NOT state that work_notes is itil-role-restricted or that comments is customer-visible; it does not cover role-based access on these fields at all.
  - source: same page / ServiceNow / 2026-03-12 / accessed 2026-09-04 / high (a negative about that page, not about the platform) / class: guidance
- **claim:** A docs-wide search of ServiceNow documentation for "webhook" surfaces only inbound webhook endpoints and spoke integrations that register a webhook in a third-party system pointing at ServiceNow — no generic outbound table-change webhook subscription page appears.
  - source: docs.servicenow.com site-restricted search index / ServiceNow / undated index / accessed 2026-09-04 / low-medium (index evidence, no page rendered) / class: api-capability
- **claim:** ServiceNow documents an Outbound REST Message construct and a "Scripting outbound REST" concept, with outbound REST callable from anywhere in the platform where scripting is allowed.
  - source: docs.servicenow.com search index snippets for create-an-outbound-rest-message.html and c_ScriptingOutboundREST.html / ServiceNow / accessed 2026-09-04 / low-medium (snippet, page redirects to docs root) / class: api-capability
- **claim:** ServiceNow's documentation site migrated off docs.servicenow.com bundle URLs to a JavaScript-rendered SPA at www.servicenow.com/docs/r/..., and some old bundle URLs now redirect to the docs root rather than to the equivalent page.
  - source: observed 301/302 chains and rendered output, this run / accessed 2026-09-04 / high / class: failure-mode
- **claim:** A Sentry shared-issue URL is not generated until a user explicitly shares, exposes a redacted view with sensitive data removed, and is revoked either by generating a new private URL (old one stops working immediately) or by switching sharing off.
  - source: docs.sentry.io/product/issues/issue-details/ + blog.sentry.io/shared-issues-update/ / Sentry / docs current, blog 2017 / accessed 2026-09-04 / medium (retrieved via search summary, not a rendered docs page) / class: linking-pattern
- **claim:** Sentry documents no expiry or TTL for a shared-issue link; the lifecycle is explicit revocation, not time-bounded validity.
  - source: same / Sentry / accessed 2026-09-04 / medium, single-sourced / class: auth-pattern

## Corrections to round 1

- **Overturned as sourcing:** the ~25,000 req/hour-per-user and ~100,000-per-instance figures.
  ServiceNow's own rate-limiting page publishes no defaults at all. Any poll-interval or
  fan-out sizing built on those numbers rests on a community article, not the vendor.
- **Confirmed:** the `sys_rate_limit_rules` mechanism itself, its three rule types, per-node
  hourly counting, and HTTP 429 on exhaustion — all now vendor-sourced, and the vendor adds
  detail round 1 did not have (the 30-second commit interval, the 30-second rule-activation
  delay, and the four response headers including `Retry-After`).
- **Not confirmed, still community-only:** `work_notes` = itil-restricted / `comments` =
  customer-visible. The vendor journal-fields page is silent on roles. Downgrade this from
  "known" to "must be verified per instance".
- **Still provisional:** "no externally-registerable outbound webhook for table changes."
  The vendor doc index is consistent with it, but no vendor page was read that says so.
  Round 1's provisional label stands; it did not get better or worse.
- **Untouched:** delta polling semantics. Round 1's position is unchanged.
- **Neither verified nor overturned:** round 1's "public record on session share links is
  thin." Only Sentry was searched; five suggested vendors were not.

## Looked for and could not find

- A rendered vendor page for ServiceNow Table API pagination/ordering/consistency. The
  canonical URL is `https://www.servicenow.com/docs/r/api-reference/rest-apis/c_TableAPI.html`
  (resolved by following the 301 this run) — it needs a JS-rendering fetch.
- A rendered vendor page for "Scripting outbound REST" / "Create an outbound REST message" on
  a current release; the Washington DC application-development bundle URL redirects to the
  docs root.
- Any ServiceNow page describing a natively registerable outbound webhook subscription on a
  table. Absent from the top of the docs search index, but absence from a search index is not
  proof of absence from the product.
- Any ServiceNow-published default numeric inbound rate limit. Its absence from the
  rate-limiting page is, per the brief, the useful answer.
- ServiceNow's "Default quota rules" page (exists in the index, Quebec-era URL) — could be
  where semaphore/queue figures actually live, if anywhere. Unread.
- Vendor documentation on run/session permalinks and read-only external sharing for GitHub
  Actions, GitLab CI, Datadog, Langfuse, PagerDuty and incident.io. Not searched this round —
  a budget decision, not a finding of absence.
