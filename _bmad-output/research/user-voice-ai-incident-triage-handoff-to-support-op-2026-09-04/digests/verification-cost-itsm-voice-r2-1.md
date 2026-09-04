# Digest: user-voice r2 — cost of verification, ITSM operator voice, trust properties

Run date 2026-09-04. Round 2. 15-call / 8-source budget spent.

## Question 1 — what does verification cost?

**There is no public measurement of verification cost in IT service-desk AI triage. None was found in this run, and I do not believe one exists in the open literature.** The team must measure it themselves.

What I searched: AI incident triage verification time/cost; AI assistant effect on average handle time; time-to-verify AI output vs doing it yourself; technicians ignoring AI ticket summaries; ServiceNow and Spiceworks practitioner venues; vendor and university deployment pages. Every ITSM number retrieved is a **gross** figure — "saves 4-7 minutes per ticket", "40-90% faster resolution", "10-20 seconds per ticket" — published by a vendor or a practitioner citing a vendor, with **no separation of AI-reading time, verification time, and work time**, no control arm, and no baseline. Not one ITSM source in this run measured how long an operator spends checking an AI note, and not one reported an assist abandoned because checking cost too much.

**However, the question has a strong measured answer in an adjacent domain, and that answer is negative.** The METR randomized trial (retrieved this run) is the closest thing that exists to the experiment this team is contemplating: expert practitioners, working in a system they already know well, given AI assistance on real tasks. They were **19% slower**, while believing they had been ~20% faster. The transfer to L2 incident triage is genuinely tight — same three conditions: expert operator, familiar system, AI output that must be checked before it can be used. Treat it as the prior, not as proof.

The second measured signal is the review-cost displacement: AI raises output volume and moves the cost into review. Retrieved second-hand (search-result text, primary not opened): Faros AI monitoring of >10,000 developers on 1,255 teams, July 2025 — 98% more PRs, 154% larger PRs, and **review time up 91%**. Same shape as an incident queue: the AI produces more, faster, and the reviewing human becomes the bottleneck.

The practical conclusion for the decision: **the gross ITSM time-saved figures in circulation are unusable for this decision** because they measure the wrong thing. If the team builds this loop, the single metric that decides whether it survives contact with L2 is *time from opening the AI handoff to the operator committing to it or discarding it*, compared against a control arm with no handoff. Nobody has published that number. Measuring it is the cheapest way to be first to know.

## Findings

- **claim:** No public study measures how long an IT service-desk operator spends verifying an AI-generated triage, summary or root-cause suggestion.
  - source: absence across this run's searches (ServiceNow Community, university IT documentation, vendor pages, general web) / n/a / accessed 2026-09-04 / confidence: medium-high / class: measured-effect (absence)

- **claim:** Expert practitioners working on familiar systems were measurably *slower* with AI assistance, while believing they were faster — the closest measured analog to an L2 engineer checking an AI triage.
  - source: METR, metr.org blog / METR / pub 2025-07-10 / accessed 2026-09-04 / confidence: high / class: measured-effect
  - detail: 16 experienced developers, 246 completed issues averaging ~2 hours each, large familiar open-source codebases. Result: "19% longer" with AI allowed. METR examined 20 candidate explanations and found evidence 5 contribute; the blog page does not break the extra time down into prompting vs reviewing vs cleanup, so **the verification share is not isolated even here**.
  - perception gap (retrieved via search summaries, second-hand): predicted 24% faster, self-assessed 20% faster after the fact — meaning **operator self-report will not tell this team whether the handoff is working.** Instrument it; do not survey it.

- **claim:** AI raises produced volume and shifts the cost onto the reviewer, roughly doubling review effort.
  - source: Faros AI monitoring, quoted in search-result text / Faros AI / pub ~2025-07 / accessed 2026-09-04 / confidence: low-medium (second-hand, primary not opened) / class: measured-effect
  - quote: "98% more PRs, 154% larger PR sizes. However, the time it takes to conduct reviews increased by 91%."

- **claim:** Time saved generating is largely absorbed by time spent trusting — net weekly saving close to zero.
  - source: TechRadar Pro headline and search-result text / TechRadar / pub date not established / accessed 2026-09-04 / confidence: LOW — **the article body would not render on fetch; the underlying study, sample and date were not established** / class: measured-effect (unverified)
  - quote (second-hand): "execs have only been gaining 16 minutes per week, and workers just 14 minutes... Execs were spending four hours and 20 minutes validating outputs, with workers spending an equally-significant three hours and 50 minutes checking generated content."
  - **Do not cite this without opening the primary.** It is directionally aligned with METR and is listed as a lead, not as evidence.

- **claim:** A service-desk practitioner running Now Assist in production reports the realistic gain as seconds, not minutes, per ticket — an order of magnitude below vendor claims.
  - source: ServiceNow Community, Community Central forum thread on Now Assist for a service desk / ServiceNow / pub 2025-11-27 / accessed 2026-09-04 / confidence: medium (single practitioner) / class: measured-effect (self-reported)
  - quote: "Even shaving off 10–20 seconds per ticket adds up quickly in high-volume queues."
  - **This is the most honest ITSM number found in the run, and it is 20x smaller than the vendor "4-7 minutes per ticket" figure.** If the real gross gain is 10-20 seconds, a verification step costing even 30 seconds inverts the sign.

- **claim:** The same practitioner names log/stack-trace tickets — i.e. exactly the L2 incident-triage case — as where the AI misreads the evidence.
  - source: same ServiceNow Community thread / ServiceNow / pub 2025-11-27 / accessed 2026-09-04 / confidence: medium / class: distrust-signal
  - quote: "Now Assist sometimes misinterprets system logs or stack traces" — listed under the limitation "Tickets With Heavy Technical Logs"
  - second limitation, verbatim: "Unclear or Poorly Written Tickets" — "Garbage in → garbage out"
  - **Directly load-bearing.** The two named failure modes are the two dominant inputs to incident triage: raw diagnostic output, and a badly-written user report. The AI is reported as reliable on the easy middle and unreliable at both ends.

- **claim:** Out-of-the-box AI skills delivered little value to a Tier 1 service desk pilot; value only appeared after workflow-specific customisation.
  - source: same ServiceNow Community thread, reply from a second practitioner (redacted) / ServiceNow / pub after 2025-11-27 / accessed 2026-09-04 / confidence: medium / class: complaint
  - two distinct voices in the thread (original poster plus one replier); the original poster agreed that custom skills and Agent Assist, not stock configuration, were what produced impact for Tier 1.
  - counting note: **this is 2 distinct voices, not a prevalence claim.**

- **claim:** Human checkpoints are treated by ServiceNow practitioners as a governance requirement rather than an efficiency trade-off — the cost is assumed, never measured.
  - source: ServiceNow Community, "Practical AI in ServiceNow" thread / ServiceNow / pub 2026-02-26 / accessed 2026-09-04 / confidence: medium / class: trust-signal
  - quote: "I've learned that not everything should be automated. Governance, traceability, and human checkpoints remain critical."
  - the thread is architectural, not operational: **no practitioner in it reported a concrete verification experience, hallucination incident, or a case of ignoring AI output.** Fresh (2026) but thin.

- **claim:** A large university IT department instructs its technicians in writing that AI ticket summaries hallucinate and must be reviewed before use.
  - source: Cornell IT, TeamDynamix AI Ticket Summaries page / Cornell University / pub date not shown on page / accessed 2026-09-04 / confidence: high / class: distrust-signal
  - quote: "AI hallucination is when the machine learning model produces incorrect or misleading content in a seemingly confident and factual tone."
  - quote: "As when using any AI-generated content, carefully review all materials for accuracy and appropriateness before sharing."
  - note: the warning sits under a **Security** heading — the deployer has classified AI inaccuracy as a risk control, not a UX caveat.

- **claim:** A second university IT department tells technicians to rely on their own judgement over the AI, but does not name hallucination or mandate verification.
  - source: Northwestern IT news, "TDX agents get ticket assistance from AI" / Northwestern University / pub 2025-05-27 / accessed 2026-09-04 / confidence: high / class: trust-signal (weak)
  - quote: "As with all generative AI tools, TDX agents are encouraged to use the new features to streamline their work for efficiency but to remain confident in their own expertise and best judgment to resolve tickets and support clients across the University."
  - this is materially weaker than Cornell: encouragement to keep using judgement, no accuracy warning, no review obligation.

- **claim:** A third university documents the identical feature with **no** accuracy or verification guidance at all — only a data-privacy statement.
  - source: University of Florida IT, TeamDynamix AI Enhancements documentation / University of Florida / pub date not shown / accessed 2026-09-04 / confidence: high / class: trust-signal (absent)
  - the only AI caveat on the page concerns data handling: "Using Revise with AI and AI ticket summaries leverages AI which does not store your data or use your data for training new models."
  - **This is the finding that breaks the expected pattern — see below.**

- **claim:** G2 review pages remain unreadable to the crawler, as in round 1.
  - source: g2.com ServiceNow ITSM low-score review filter / G2 / accessed 2026-09-04 / confidence: high / class: n/a
  - result: **HTTP 403 Forbidden.** Round 1's failure reproduces. Reddit was not attempted per instruction. Direct star-rated review mining is not achievable with this toolchain; if the team needs 1-star ITSM AI reviews, it needs a browser session or a human.

## Multi-institution signal

**Three institutions were checked; the signal is real but weaker and less uniform than round 1's framing anticipated.** All three deploy the *same* product feature (TeamDynamix AI Ticket Summaries), which makes them a good controlled comparison of deployer posture:

| Institution | Publishes operator guidance? | Names hallucination? | Mandates review? |
|---|---|---|---|
| Cornell | yes | **yes**, under a Security heading | **yes** — "carefully review all materials for accuracy... before sharing" |
| Northwestern | yes | no | no — only "remain confident in their own expertise and best judgment" |
| University of Florida | yes (feature docs) | no | no — privacy statement only |

Read honestly: **one institution of three instructs verification; a second gestures at human judgement; a third says nothing about accuracy.** This is not three independent communities converging on the same instruction. It is one institution taking a strong documented position and two others declining to. The correct conclusion is that hallucination in AI ticket summaries is a **real observed phenomenon** — Cornell says its IT staff *observed instances of it*, which is first-hand deployer evidence, not speculation — but that **verification discipline is not yet an industry norm among deployers**, and is left to each operator's discretion at two of three sites.

That gap is itself decision-relevant: if the team ships an AI triage handoff without an explicit verification instruction, two of three comparable deployers suggest none will be written.

## Leads worth chasing

**Contradictions first.**

1. **The gross-gain figures differ by 20x and nobody reconciles them.** Vendor and vendor-adjacent material claims "4-7 minutes per ticket" and "40-90% faster resolution"; the one production practitioner who put a number on it said "10-20 seconds per ticket". Both describe the same product category, both are 2025-2026. At 4-7 minutes, a verification step is affordable. At 10-20 seconds, it is not. **This single unresolved factor decides the project.** Chase: the practitioner's own follow-ups; any deployment with a control arm.

2. **METR says slower, every ITSM vendor says faster, and no ITSM study has a control arm.** The disagreement may be entirely explained by methodology: METR randomised and measured; ITSM figures are uncontrolled before/after or vendor telemetry. Until an ITSM study with a control group exists, assume the ITSM numbers measure enthusiasm.

3. **Self-report is disqualified as an instrument.** METR's participants were wrong about their own speed by ~39 percentage points. Any plan to evaluate this loop by asking operators whether it helped is pre-broken. This also **retroactively weakens round 1's survey numbers** (93% / 35% / 47%) — those instruments asked agents to self-report verification behaviour, which the same evidence says they cannot do accurately.

4. **Cornell's phrasing implies an internal incident log.** The page states IT staff *observed* hallucination instances. Somebody at Cornell has a list. Worth a direct approach — a named deployer with first-hand failure cases in exactly this workflow is worth more than another survey.

5. **The GitLab support-team-meta tracker was not reached** in this run's budget (one GitLab result surfaced was an unrelated 2021 FOSS issue about service-desk feature gaps). A public support org deliberating AI summarisation in the open remains the single best unexplored venue for operator voice with dates and named trade-offs.

6. **Unverified: TechRadar's "16 minutes saved / 4 hours validating"** — open the primary before using it anywhere.

## Question 3 — what makes an AI note trustworthy enough to read

Thin, and honestly so. Only fragments were retrieved this run:

- **Show the evidence, not just the conclusion.** From a security-operations vendor playbook surfaced in search: AI systems should show the enrichments and evidence behind their recommendations so analysts can verify conclusions, under an "AI drafts, human validates" model. Class: trust-signal. Confidence: low — vendor marketing, not operator voice.
- **Grounding in retrieved institutional data is the deployer's chosen answer to hallucination.** Cornell's AI Innovation Hub describes a multi-agent TeamDynamix approach using RAG over verified institutional data — past tickets and KB articles — explicitly to reduce hallucination and keep answers grounded. Class: trust-signal. Confidence: medium; retrieved via search summary, page not opened. Notable that the *same institution* that warns its technicians about hallucination is building retrieval-grounding as the fix.
- **Structured, state-aware fields over free prose.** ServiceNow's own CSM summarization design uses fixed sections (Issue and SLA, related parties with type and responsibility) and adapts by case state. Class: trust-signal. Confidence: low — vendor product documentation, tells you what a vendor believes operators want, not what operators reported.
- **What kills trust, from the one operator voice found:** misread logs and stack traces, and vague input producing vague output. Class: distrust-signal, medium confidence, single voice, 2025-11-27.

**Round 1's "vendors are converging on source attribution" signal is neither confirmed nor refuted here.** What this run supports is the weaker and more defensible claim: vendors and deployers are converging on *grounding* — RAG over real tickets, structured fields, showing enrichments — of which citation is one instance. No operator in this run said "I trust it because it cites its sources." That evidence does not exist yet in what I could reach.

## Looked for and could not find

- **Any time-motion or before/after study of AI-assisted ITSM ticket handling with a control arm.** Does not appear to exist publicly.
- **Any published measurement of AI-output review or verification time in a service desk.** None.
- **Any deployment report of an AI assist abandoned because verification cost too much.** None found — note this is a hard thing to find, because organisations rarely publish abandonments; absence here is weak evidence.
- **NOC/SRE operator voice specifically.** Not reached within budget. Question 2 was answered only for the IT service desk, and only from **two distinct ServiceNow Community practitioners plus three university IT departments' written policy.** That is a legitimately thin base and must not be reported as prevalence.
- **G2 / Capterra / TrustRadius direct review pages: BLOCKED.** g2.com returned **HTTP 403 Forbidden**. Round 1's failure is confirmed reproducible, not a fluke. Capterra and TrustRadius were not attempted (budget).
- **Reddit: not attempted**, per instruction.
- **Spiceworks Community: no results returned** when the search was domain-restricted to it. Either the crawler's index does not cover it or the topic is absent there.
- **GitLab support-team-meta issue tracker: not reached** within budget.
- **TechRadar article body: would not render** — headline and search-snippet only.
