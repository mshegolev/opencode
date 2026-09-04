# Operator workspace — design

**Date:** 2026-09-05
**Status:** design approved in conversation; not yet planned or implemented
**Decision it serves:** give a support operator one screen that answers "what is
assigned to me" and "what is in the queue" while showing the one thing no ITSM
shows — the state of the AI's triage of each incident.

Research behind several decisions below lives in
`_bmad-output/research/{user-voice,competitive,technical}-ai-incident-triage-handoff-to-support-op-2026-09-04/`,
with a consolidated briefing at `_bmad-output/research/research-briefing.html`.
Where this document cites a research finding it says so; those findings carry
their own confidence levels and most are marked unverified.

## Problem

An AI service triages ITSM incidents before a human picks them up. Its work
currently has no operator-facing surface: the operator cannot see which
incidents have been analysed, how far the analysis got, or what it concluded,
without opening tickets one at a time.

Every ITSM already ships "my incidents" and a prioritised queue. This workspace
does not compete with that and must not try to. Its reason to exist is the
triage-state column, and the queue around it is the frame that makes the column
legible.

## Scope

**In scope for v1:**

- A read-only queue of incidents: assigned to the operator, in their group's
  queue, and all.
- Per incident: priority, number, short description, assignment, SLA countdown
  to resolution, and AI triage state.
- An incident detail view showing the AI's triage as structured fields, with the
  full analysis transcript available below it.
- A link out to the incident in the ITSM, where all action happens.

**Explicitly out of scope for v1:**

- Any write path. No taking an incident, no verdict on the analysis, no
  comments, no reassignment, no closure. The operator acts in the ITSM.
- Any ordering of our own. Queue order mirrors the ITSM exactly.
- Response SLAs. Only the resolution SLA is shown.
- Notifications, digests, and mobile layouts.

## Decisions

Each was made explicitly during design; the rationale matters more than the
choice, because a later reader will otherwise re-open them.

**The queue's purpose is the triage-state column.** Not a better queue, not a
faster queue. This keeps the product honest and bounds the scope: anything the
ITSM already does well, we mirror rather than improve.

**Read-only in v1.** It removes write permissions, operator-action auditing and
all of the ITSM's business logic from scope, and it is the cheapest way to test
the load-bearing hypothesis — that operators will read an AI handoff at all.
Research found zero public evidence about that behaviour, so it has to be
observed rather than assumed.

**Queue order mirrors the ITSM exactly.** SLA urgency changes a row's colour,
never its position. An order the operator cannot predict is an order they stop
trusting, and we have no evidence that would justify asking for that trust.

**Hybrid data: list from a local projection, open incident read live.** One
request when an incident is opened, not one per list render. Research
established that ServiceNow publishes no default rate limits at all, so a
list-render-per-request design would be sizing against an unknown budget.

**Tabs, not sections or a single list.** Chosen by the product owner over the
recommendation of two sections. The known risk — what is hidden does not get
checked — is mitigated by putting the hidden content on the tab labels
themselves: count, how many analyses are ready, how many SLAs are breached.

**Two-line rows with the triage state as a bordered chip.** Chosen over a denser
table. The chip (rather than a quieter dot) reflects an expectation that
operators will hunt for ready analyses rather than read the queue in order — the
triage state is therefore an object, not an attribute.

**The analysis is presented as structured fields, not prose.** Research found
that verification is the price of an AI handoff rather than a veto on it: the
operator will check the work regardless, so the presentation that wins is the
one that is cheapest to check. Prose cannot be checked piecewise. Fields carry
"what it is based on", "what was not checked", and an explicit confidence level.
ServiceNow's shipped design — three narrow agents each owning named fields
rather than one agent writing prose — points the same way.

## Architecture

### Data ownership

Three owners, no duplication.

- **The ITSM owns** assignment, priority, description, status, and SLA.
- **The AI service owns** triage state, the triage fields, and the session
  transcript.
- **The workspace owns nothing.** It reads and joins. It holds no business logic
  of its own.

### The projection

**Prerequisite, stated plainly: the AI triage service does not exist yet.** It
was the subject of the research cited above, not of an implementation. This
design assumes an ingest that watches the ITSM for incidents and a reconciliation
sweep that backfills events the webhook dropped — both are *planned* parts of
that service, not existing infrastructure. If the service is built differently,
or after this workspace, the projection becomes a subsystem of its own and this
document's effort estimate is wrong.

Given that ingest, the same event stream writes an incident projection and the
same sweep backfills it, making the projection a by-product rather than a new
subsystem.

The key everywhere is the **incident number**, never a delivery identifier — a
delivery-scoped key defeats webhook redelivery and nothing else, and is useless
against the sweep, which re-reads incidents the webhook already delivered.

A projection row holds: number, priority, description, assignee, group, status,
SLA snapshot, snapshot timestamp, triage state, session reference.

### The SLA snapshot

**Remaining time is never computed locally.** SLA clocks run on a service
calendar and pause on hold states, so `deadline − now` is wrong in the common
case: a ticket raised at 17:00 Friday under a four-hour 8×5 SLA breaches on
Monday, not Friday night.

The snapshot holds four things: breach timestamp, remaining time per the service
calendar as of the snapshot, clock state (`running` / `paused` / `breached` /
`none`), and when it was captured.

The client interpolates seconds **only while the clock state is `running`**,
counting from the capture time. A paused clock renders as a frozen value with
its state named — not as a number that has silently stopped, which reads as a
hung interface.

**Staleness thresholds**, both configurable, with these defaults: a snapshot
older than **60 seconds** while the clock is running stops the row from
interpolating and makes it show the data's age instead; **five minutes** without
an ingest event raises the queue-level banner. The second default assumes a
queue with steady traffic and should be tuned to the observed inter-arrival time
once real volume is known — set too low it cries wolf, set too high it hides the
silent-failure modes it exists to catch.

### Clocks

Every response carries the server's time. The client computes the offset once
and uses it. The browser clock never enters the calculation: the operator is
shown a time with contractual meaning, and a few minutes of drift on their
machine must not affect it.

### Surface in the app

The operator route mounts **inside** the base providers — theme, language,
Query, `MarkedProvider`, `FileComponentProvider` — and **outside** `Layout` and
everything developer-facing: terminals, models, permissions, prompt, projects
and their drag-and-drop. The shell is not "hide the buttons with CSS"; those
contexts are not raised at all.

Routes: `/queue` with the tab in a parameter, and `/queue/:incident`. Both sit
beside `home` and `session` in the router, under a different parent layout.

**`message-timeline.tsx` cannot be reused.** It is a container, not a
presentation: it calls `useServerSDK`, `useSDK`, `useSync`, `useSettings`,
`useDialog`, `useSessionKey` and `usePlatform`, and holds share, unshare and
rename mutations. Mounting it would drag in exactly the stack the shell exists
to avoid. The reuse point is one level down — `@opencode-ai/ui/message-part`
(`Message`, `Part`, `MessageDivider`, `ContextToolGroup`) plus `virtua` — under
a thin read-only container written for this surface.

New files live in `packages/app/src/pages/operator/`. The row, timer and triage
chip are candidates for `@opencode-ai/ui` later; they start local, because one
consumer is not yet a shared component.

## Components

**Queue read API (server).** Two endpoints: a list by scope (mine / group / all)
served from the projection, and a single incident read live. Responses carry
server time. No write endpoints exist — read-only is enforced by the interface,
not by convention.

**`createSlaClock`.** The only place with time arithmetic. Takes the snapshot,
the server clock offset and a tick; returns a display string, a tone (calm /
warm / hot / breached / paused), the clock-state caption, a staleness flag and
the data's age. Pure given its inputs.

The rule that holds the design together: **no component computes time.** A row
does not know what a deadline is. It renders what it was given.

**`ticker`.** One signal for the whole surface, ticking once per second, stopped
while the tab is hidden. Not an interval per row: the list is virtualised, and a
hundred intervals produce a stuttering scroll for no reason.

**`createQueueQuery`.** TanStack Query wrapper: refresh cadence, keys by scope,
server clock offset extraction, freshness stamp.

**Presentational, all context-free:** `QueueTabs` (counts in, selection out),
`QueueRow` (incident plus a `createSlaClock` result in, click out),
`TriageFields`, `TriageTimeline` (thin read-only container over
`@opencode-ai/ui/message-part`), `OperatorShell`.

## Degradation

The governing rule, and the reason it matters: **never show something plausible
in place of something unknown.** One confidently wrong number teaches the
operator to distrust the whole screen, and after that the correct rows do not
work either.

| Failure | Behaviour |
|---|---|
| ITSM unavailable on open | List keeps working from the projection. Detail shows the snapshot and says "could not refresh, data as of 09:14" |
| Projection stale (degraded retries, expired subscription, tripped breaker, lost ordering — all documented in the technical research) | Detected by the age of the last event; shown as a **banner over the queue**, not per row. If ingest stopped, every row is stale at once, and an un-updated row is indistinguishable from an unchanged one |
| Snapshot older than the threshold while running | The row shows the data's age instead of a ticking number |
| Server clock offset unavailable | Falls back to the absolute breach time ("by 10:47"), never silently to the browser clock |
| Incident has no SLA | "No SLA set". Not zero, not a dash in a time column |
| AI service unavailable | Queue works; the triage chip reads **"state unknown"**, never "not started". "Not started" is a claim about the world we cannot make at that moment, and an operator who believes it will not open a ready analysis |
| Analysis interrupted | State reads "interrupted", with time and reason. Not "running" forever — a spinner that never resolves teaches operators to ignore status |
| Incident closed or reassigned while open | Stated explicitly on the next live read. Read-only helps here: there is no write conflict, only news |
| Empty states | "Nothing assigned to you" is good news and one line. "Queue failed to load" is an error. They must not render identically |

The list degrades last. It is served from the projection and survives both the
ITSM and the AI service being down — it simply ages honestly and says so.

## Testing

Repository conventions apply: tests colocated as `*.test.ts`, run with
`bun test`, Playwright for e2e, Storybook for component states.

App tests run over the whole `./src` — `bun test --preload ./happydom.ts ./src`.
A narrower path makes a passing test fail, so do not run them piecemeal.

**`createSlaClock` is the primary test surface, and it is a table.** Pure, no DOM,
no network. The table must cover: clock running; clock paused; breached with a
negative countdown; no SLA set; snapshot older than the threshold; server offset
unknown; client clock wrong by five minutes in each direction; day-scale versus
minute-scale formatting; the crossing of zero. Red-green is written here first —
this is the one node where a wrong result quietly destroys trust in the screen.

**`ticker`:** one interval, stops on a hidden tab, does not leak on unmount.

**`createQueueQuery`:** age computation, banner threshold, offset extraction.

**States live in Storybook,** not in screenshot tests: every timer tone, every
triage chip state including "state unknown", "nothing assigned" versus "queue
failed to load", and the stale-projection banner. These are the cases seen once a
month in production and never reviewed unless they are laid out side by side.

**Two tests defend the architecture rather than behaviour:**

1. **Read-only as a checked property** — the operator surface imports no
   mutations and the read API exposes no write endpoints. An unpoliced
   convention drifts within two sprints.
2. **Provider isolation** — the operator route mounts without `TerminalProvider`,
   `ModelsProvider`, `PermissionProvider` and `PromptProvider`. This is the whole
   point of the separate shell; without the test, the first "let's just pull in
   this hook" restores the developer stack.

**One Playwright scenario, the most valuable one:** open the queue, switch tab,
open an incident with a ready analysis, see the structured fields and the
countdown. Nothing more — the rest is caught more cheaply and more reliably by
unit tests.

**Deliberately not tested:** the correctness of the SLAs themselves. The ITSM
computes them, and duplicating its calendar in tests would create the second
implementation this design exists to avoid.

## Dependencies to verify before implementation

1. **Does the target ITSM expose calendar-aware remaining time and clock state
   via its API, or only a raw deadline?** Research could not establish this —
   there is no public material on the internal ITSM, and ServiceNow's Table API
   semantics were not reached in two rounds. If only a deadline is available,
   either the service calendar must be reimplemented locally with all the risk
   that carries, or the timer degrades honestly to an absolute breach time with
   no countdown. **This decides whether the headline feature of this screen is
   buildable as designed.**
2. **Operator identity mapping** between the workspace's SSO identity and the
   ITSM user. "Assigned to me" is undefined without it.
3. **The target instance's actual rate-limit rules** — on ServiceNow, readable at
   `sys_rate_limit_rules_list.do`. No vendor default exists to assume.
4. **Whether an incident can carry several concurrent resolution SLAs**, and if
   so which one the countdown shows.

## Open questions

- What does verification of an AI handoff actually cost the operator? No public
  measurement exists. This workspace is the instrument that could measure it, and
  the read-only v1 is deliberately shaped so that the question can be observed:
  time from opening a handoff to the operator's first independent action.
- Will operators use tabs, or will the group queue go unread? The tab-label
  counters are the mitigation; whether they are enough is testable in the pilot.
- Does a bordered chip actually help operators hunt for ready analyses, or does it
  add noise to a row that already carries five elements? Worth revisiting after
  the first real queue is on screen.
