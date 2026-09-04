# Digest: competitive r2 — does any AIOps tool link an AI investigation from the ticket?

Run date: 2026-09-04. Budget spent: 6 distinct sources read, 15 tool calls.

## Verdict on Lead 1 (Datadog Bits)

**UNCONFIRMED — leaning "not documented".** Datadog's own documentation, read in this run, does
**not** state that a Bits investigation's URL is written into a Jira or ServiceNow ticket.

Evidence actually retrieved:

1. The Bits docs have been **renamed and moved** since the round-1 impression: the live tree is
   `docs.datadoghq.com/bits_ai/bits_investigation/` ("Bits Investigation"), and the older
   `docs.datadoghq.com/bits_ai/bits_ai_sre/*` paths still resolve. Do not cite "Bits AI SRE" as the
   current product name without checking.
2. The only sentence anywhere near the claim is the **"prefill"** sentence, which appears in
   Datadog's own blog and is echoed in the docs: Bits "automatically pulls relevant context from the
   investigation and your integrations to **prefill messages, incident details, and ticket
   metadata**." That describes copying *content* out of the investigation into the ticket — i.e. the
   INLINE pattern round 1 already documented for ServiceNow. It says nothing about a URL pointing
   back at the investigation.
3. The take-action / remediation page enumerates the triage actions (Slack, Microsoft Teams,
   PagerDuty, Datadog On-Call, Datadog Work Management / Case Management, Jira, creating a Datadog
   incident, generating code fixes via Bits Code). Retrieved page text contains **no field list, no
   payload spec, and no mention of a link or URL to the investigation** for any of these targets.
4. On whether an investigation is separately addressable at all: the "Investigate Issues" page says,
   for the Synthetic-test entry point, that "the investigation **opens in a new page**". That is the
   only retrieved evidence that an investigation is a distinct, openable object. **No documented
   permalink, share button, or URL shape was found.** I did not find, and therefore do not assert,
   an investigation URL format.

So: the round-1 gap is **not closed by Datadog**, and it is not closed *against* Datadog either.
The honest statement to the team is: Datadog has a separate investigation record (a page), it feeds
its content into tickets, and Datadog's public docs do not describe writing a link to that page into
the ticket. A screenshot-level or hands-on check of a real Bits-created Jira issue would be needed to
settle it; docs alone cannot.

Freshness caveat: all Datadog doc pages read here are **undated**. The only dated Datadog artifact is
the blog "Meet the new Bits Investigation: Deeper reasoning, twice as fast", **published 2026-03-05**
— six months old, outside the 3-month freshness bar.

## Findings

- **claim:** Datadog Bits Investigation prefills ticket *metadata* from the investigation, which is
  content transfer, not a link.
  - source: https://docs.datadoghq.com/bits_ai/bits_investigation/ and
    https://docs.datadoghq.com/bits_ai/bits_ai_sre/take_action/ / publisher: Datadog /
    pub_date: undated / accessed 2026-09-04 / confidence: high on the wording, high that no link is
    documented / class: handoff-artifact

- **claim:** A Bits investigation is a distinct object that "opens in a new page", but Datadog docs
  document no shareable permalink for it.
  - source: https://docs.datadoghq.com/bits_ai/bits_ai_sre/investigate_issues/ / publisher: Datadog /
    pub_date: undated / accessed 2026-09-04 / confidence: medium (page exists: high; absence of
    documented permalink: medium — absence of evidence) / class: capability

- **claim:** Datadog's Bits documentation was reorganized from "Bits AI SRE" to "Bits Investigation";
  round-1 URLs may be stale.
  - source: Datadog search index + live doc tree at
    https://docs.datadoghq.com/bits_ai/bits_investigation/ / publisher: Datadog / pub_date: undated /
    accessed 2026-09-04 / confidence: high / class: failure-mode (for citation hygiene)

- **claim:** PagerDuty's ServiceNow integration documents the link in the **PagerDuty→ServiceNow**
  direction only: the PagerDuty incident's "Linked Records" field holds the ServiceNow Incident
  Number/link. The ServiceNow-side form fields are not described as carrying a PagerDuty URL.
  - source: https://support.pagerduty.com/main/docs/servicenow-user-guide / publisher: PagerDuty /
    pub_date: page updated 2026-03-19 / accessed 2026-09-04 / confidence: high on what is stated,
    medium on the negative (the integration-details and custom-field-mapping pages were not read) /
    class: link-direction

- **claim:** incident.io creates a ServiceNow incident record and keeps name/summary fields in sync
  as the incident evolves — i.e. field sync, described as content, not as a link to an AI record.
  - source: search-result snippet for https://docs.incident.io/integrations/servicenow /
    publisher: incident.io / pub_date: undated / accessed 2026-09-04 / confidence: LOW — **the doc
    page itself was not fetched in this run**; treat as unverified / class: link-direction

## Link-direction table

| vendor | separate AI investigation record? | does the ITSM ticket link to it? | where the link lands | evidence ref |
|---|---|---|---|---|
| Datadog Bits Investigation | Yes — an investigation "opens in a new page"; no documented permalink | **Not documented.** Docs describe prefilling ticket metadata from the investigation, not linking to it | ticket receives *content*; no link target documented for ticket, Slack or Teams | docs.datadoghq.com/bits_ai/bits_investigation/, .../bits_ai_sre/investigate_issues/, .../bits_ai_sre/take_action/ |
| PagerDuty + ServiceNow | PagerDuty incident is a separate record (AI analysis content not verified in this run) | **No — reverse direction only.** PagerDuty holds the link to ServiceNow, in "Linked Records" | link lands in PagerDuty, i.e. the wrong way for our design | support.pagerduty.com/main/docs/servicenow-user-guide (updated 2026-03-19) |
| incident.io | unverified | unverified — search snippet describes field sync (name, summary) into ServiceNow | unverified | docs.incident.io/integrations/servicenow (NOT fetched) |
| Rootly | not reached | not reached | not reached | — |
| BigPanda | not reached | not reached | not reached | — |
| Moogsoft | not reached | not reached | not reached | — |
| Atlassian Rovo / JSM | not reached | not reached | not reached | — |
| Salesforce Agentforce / MessagingSession | not reached (Lead 3, no budget) | not reached | not reached | — |

## Leads worth chasing

**Contradiction first.** Round 1 reported that Datadog docs say a Bits investigation "prefills" ticket
metadata, and read that as possibly implying a link. This run retrieved the same sentence and it does
**not** imply a link — "prefill messages, incident details, and ticket metadata" is content transfer.
Round 1's open question should be reframed: the question is not "does prefill include a URL" but
"does the Bits-created Jira issue contain any Datadog URL at all", which the docs do not answer.

1. **The indirect chain is the most promising Datadog path and was not closed.** Bits can create a
   **Datadog Case** (Case Management / Work Management), and Case Management has a two-way Jira
   sync. If (a) the case carries the investigation and (b) the Jira issue carries a link to the case,
   then a Jira ticket transitively reaches the AI's work — a real precedent, one hop removed. The
   Case Management Jira settings doc URL I guessed returned 404; find the correct page under
   `docs.datadoghq.com/service_management/case_management/` and read what the synced Jira issue
   contains.
2. **Datadog Incident AI** (`docs.datadoghq.com/incident_response/incident_management/investigate/incident_ai/`)
   surfaced in search and was not read. Datadog incidents *are* addressable records and do sync to
   ServiceNow/Jira; if Incident AI's analysis lives on the incident, that is the same shape as our
   design with the incident standing in for the session.
3. **PagerDuty ServiceNow Integration Details / Custom Field Mappings** pages — the user guide is
   silent on ServiceNow-side fields, but a mapping page may show a `u_pagerduty_*` URL field. That
   would flip the PagerDuty row from "no" to a confirmed ticket→record link (though the record holds
   incident timeline, not necessarily AI analysis).
4. **Zendesk voice AI (round 1's counter-example) remains the only confirmed ticket→AI-record link.**
   Nothing in this run displaced it.

## Looked for and could not find

- **No vendor documentation retrieved in this run states that an ITSM ticket carries a link to an AI
  investigation record.** Not one. After reading Datadog's Bits doc tree and PagerDuty's ServiceNow
  user guide, the finding is a clean negative for those two, at documentation level.
- **Datadog: no investigation permalink documented.** No share action, no URL shape, no "copy link"
  UI element described on any page read. I will not guess one.
- **Datadog: no payload specification for any triage action.** The take-action page names the
  destinations but documents no fields written to Jira/ServiceNow/Slack. A direct WebFetch asking for
  verbatim page text returned only the remediation/guardrails framing, so the fine-grained field list
  may simply not be public.
- **Could not reach by raw HTTP.** `curl` against docs.datadoghq.com from this environment returned
  333-byte non-content responses (blocked/redirected), so all Datadog evidence is via the fetch tool's
  summarizer, not raw page text. That is a real limitation: the summarizer may under-report bullets.
  Anyone re-verifying should open the pages in a browser.
- **Not reached at all, purely for budget:** Rootly, BigPanda, Moogsoft, Atlassian Rovo in JSM, and
  all of Lead 3 (Salesforce Case → Agentforce MessagingSession). incident.io was touched only at
  search-snippet level and must not be cited as verified.
- **Freshness:** every Datadog and PagerDuty doc page read is undated except the PagerDuty user guide
  (updated 2026-03-19) and the Datadog blog (2026-03-05). No claim here is inside the 3-month bar.
