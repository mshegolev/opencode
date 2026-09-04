# Digest: competitive r1 — AI triage write-back and handoff artifact

Scope note: 14 tool calls, 5 pages actually fetched. Two vendor pages returned nothing
usable (Zendesk handoff doc, Intercom "view Fin's conversations"); G2 blocked (HTTP 403).
Several claims below rest on search-result snippets that *quote* vendor help pages but
that I did not open myself — those are marked confidence: low and must be re-verified
before any decision rests on them.

## Findings

- **claim:** ServiceNow ships AI agents that triage an incident automatically *before any human is assigned* — the workflow fires when the incident is New with "Assigned to" empty (priority 3-5), or when it moves to In progress while still unassigned.
  - source: https://www.servicenow.com/docs/r/it-service-management/now-assist-for-it-service-management-itsm/now-assist-itsm-aiagents-catincidents-usecase.html
  - publisher: ServiceNow product documentation (Australia release)
  - pub_date: 2026-03-12 (page "Updated")
  - accessed: 2026-09-04
  - confidence: high
  - class: capability

- **claim:** ServiceNow's triage chain is three sequential agents that write structured fields back onto the incident: Categorize ITSM incident agent → Category/Sub-category; Classify Service and CI agent → Service, Service offering, Configuration item; Link major incident or problem agent → Parent incident or Problem.
  - source: https://www.servicenow.com/docs/r/it-service-management/now-assist-for-it-service-management-itsm/now-assist-itsm-aiagents-catincidents-usecase.html
  - publisher: ServiceNow product documentation
  - pub_date: 2026-03-12
  - accessed: 2026-09-04
  - confidence: high
  - class: capability

- **claim:** ServiceNow's handoff artifact is inline — all three agents append their reasoning to the incident's Work notes and Additional comments; the documentation describes no separate AI session or conversation record linked from the incident.
  - source: https://www.servicenow.com/docs/r/it-service-management/now-assist-for-it-service-management-itsm/now-assist-itsm-aiagents-catincidents-usecase.html
  - publisher: ServiceNow product documentation
  - pub_date: 2026-03-12
  - accessed: 2026-09-04
  - confidence: high (for what the page says); medium (as a claim that no such linked record exists anywhere in the platform — one page cannot prove absence)
  - class: handoff-artifact

- **claim:** Atlassian's Jira Service Management "AI triage" is human-initiated, not pre-human: the agent suggests request types and fields for work items an agent has *selected in the queue*, i.e. after a human is already looking at them.
  - source: https://support.atlassian.com/organization-administration/docs/atlassian-intelligence-features-in-jira-service-management/
  - publisher: Atlassian Support
  - pub_date: undated (page carries no version or date markers — flagged as unverifiable freshness)
  - accessed: 2026-09-04
  - confidence: medium
  - class: capability

- **claim:** In JSM the pre-human work is done by the virtual agent (knowledge search, turn-by-turn flows, routing to request types, taking actions); the Atlassian docs page does not state where the AI's output lands in the request — inline summary, panel, or linked object is unspecified.
  - source: https://support.atlassian.com/organization-administration/docs/atlassian-intelligence-features-in-jira-service-management/
  - publisher: Atlassian Support
  - pub_date: undated
  - accessed: 2026-09-04
  - confidence: medium
  - class: handoff-artifact

- **claim:** Zendesk's own "Managing conversation handoff and handback" documentation describes *when* handoff happens and how routing notifies the agent, but says nothing about what context the agent receives — no summary, transcript, or link is documented on that page.
  - source: https://support.zendesk.com/hc/en-us/articles/4408824482586-Managing-conversation-handoff-and-handback
  - publisher: Zendesk Support (vendor docs)
  - pub_date: undated
  - accessed: 2026-09-04
  - confidence: high (that the page is silent); this is an absence-of-evidence finding, not evidence of absence
  - class: handoff-artifact

- **claim:** Intercom exposes an explicit "Add summary note" workflow action so Fin leaves an internal-note summary at the point of handoff, and on the Intercom Helpdesk Fin summarises the conversation and opens a *new* Helpdesk conversation carrying that summary as an internal note.
  - source: https://www.intercom.com/help/en/articles/12396892-manage-fin-ai-agent-s-escalation-guidance-and-rules (and adjacent Intercom Help articles surfaced in the same search)
  - publisher: Intercom Help (reached via search snippet, NOT opened directly)
  - pub_date: undated
  - accessed: 2026-09-04
  - confidence: low — snippet-level only; my direct fetch of the related Intercom article failed to confirm
  - class: handoff-artifact

- **claim:** Salesforce Agentforce escalates via an Omni-Channel flow (Escalation subagent / utils.escalate), and the rep who picks up the escalated conversation sees the full transcript, a summary, and any case created during the AI conversation.
  - source: https://help.salesforce.com/s/articleView?language=en_US&id=ai.service_agent_escalation.htm&type=5
  - publisher: Salesforce Help (reached via domain-restricted search snippet, NOT opened directly)
  - pub_date: undated
  - accessed: 2026-09-04
  - confidence: low — snippet-level; the "full transcript + summary + case" phrasing may be marketing register rather than doc text
  - class: handoff-artifact

- **claim:** Zendesk gates AI ticket summarization behind Suite Professional/Enterprise with group-level permissions, giving the agent a one-paragraph summary when the handoff lands.
  - source: search aggregation of eesel.ai / Kustomer teardowns citing Zendesk help
  - publisher: third-party aggregators (eesel AI, Kustomer) — both are competitors of Zendesk
  - pub_date: 2026 (undated within page)
  - accessed: 2026-09-04
  - confidence: low — competitor-published, unverified against Zendesk's own docs, and pricing gates change
  - class: pricing-gate

## Handoff artifact comparison

| vendor | AI works the ticket pre-human? | what the human receives | separate session link or inline? | evidence ref |
|---|---|---|---|---|
| ServiceNow (Now Assist ITSM AI agents) | Yes — fires on New + unassigned | Populated Category/Sub-category, Service, Service offering, CI, Parent incident/Problem, plus agent notes | **Inline** — Work notes + Additional comments; no linked AI session documented | ServiceNow docs, Australia release, 2026-03-12 |
| Atlassian JSM | Partly — virtual agent pre-human; "AI triage" is agent-initiated from the queue | Request-type and field suggestions; summaries | Unspecified in vendor docs | Atlassian Support, undated |
| Zendesk | Yes (AI agent answers before handoff) | Vendor doc silent; third parties describe a one-paragraph summary | Presumed **inline**, unverified | Zendesk help doc, undated |
| Intercom (Fin) | Yes | Internal-note summary at handoff; on Intercom Helpdesk a *new* conversation is opened carrying that note | Closest thing found to a **separate object**, but it is a new conversation, not a link back to an AI session — LOW confidence | Intercom Help snippets |
| Salesforce (Agentforce) | Yes | Transcript + summary + case created during the AI conversation | Session/transcript is a Salesforce record; whether the human gets a *link* is unverified | Salesforce Help snippet |
| Freshworks/Freddy | not covered | — | — | budget exhausted |
| Front, Help Scout | not covered | — | — | budget exhausted |
| Omnidesk, Usedesk, Naumen | not covered | — | — | budget exhausted |

## Leads worth chasing

- **Contradiction / the sharpest finding for the decision:** ServiceNow — the most mature ITSM AI triage found — deliberately writes *into the record* (fields + work notes) rather than handing the human a link to an AI session. If the shipped state of the art is inline write-back, the team's "link to a separate AI session keyed by incident number" is either a genuine differentiator or a pattern the incumbents evaluated and rejected. Both readings are live; nothing retrieved settles it.
- ServiceNow's model is *three narrow sequential agents each owning specific fields*, not one general triage agent. That is a design lesson available for free.
- Intercom's "opens a new Helpdesk conversation carrying the summary" is the only retrieved pattern where the AI's work becomes its own object. Worth a proper primary-doc pass — it is the nearest published analogue to the proposed loop.
- ServiceNow community articles (Jan 2026) on "Build Auto-Generated Incident Notes / AI-Powered Incident Logger with Now Assist Agents" suggest customers are building this loop themselves on top of Now Assist — i.e. the platform ships the primitives, not the finished loop.
- Atlassian "Rovo Service" is named as the newest agentic offering in JSM; its release notes were not reached and are the obvious next target.
- New entity encountered repeatedly: eesel AI and Kustomer publish aggressive Zendesk/ServiceNow "teardowns" — competitors, treat as adversarial, but their claims point at real help-centre URLs worth opening.

## Looked for and could not find

- **Dimension B is essentially unretrieved.** G2 returned HTTP 403; no 1-3 star review text, no forum complaint threads, no admin "we turned it off" reports, and **no measured effect on handle time** for any vendor. The single sentiment fragment retrieved (Zendesk's dialogue builder described as "the most annoying interface in the world" on Reddit) came through a competitor's blog, not the original post, and is not about summaries or handoffs. Report this dimension as an open gap, not as a null result.
- No evidence found, for any vendor, of a **link to a separate AI working session** written back into a ticket. That is the precise capability the team wants to differentiate on and I could not confirm it exists anywhere.
- Zendesk's own documentation of the handoff payload — could not locate; the handoff/handback article does not cover it.
- Vendors not covered at all within budget: Freshworks/Freddy, Front, Help Scout, Omnidesk, Usedesk, Naumen Service Desk.
- Job postings: not attempted (budget).
- Freshness: only the ServiceNow page carries a date inside the 3-month bar (2026-03-12 is 6 months old — **already outside the stated 3-month freshness bar and flagged as such**). Every other vendor page retrieved was undated, so freshness could not be established for Atlassian, Zendesk, Intercom, or Salesforce.
