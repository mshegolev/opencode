# Verification: agent AI-trust and tool-sprawl survey claims

Source under test (single publisher, single upstream survey): No Jitter (Informa),
"Human agents double-check what AI tells them, UJET survey finds", 2026-04-22,
https://www.nojitter.com/contact-centers/human-agents-double-check-what-ai-tells-them-ujet-survey-finds
UJET is a contact-centre AI vendor surveying about a problem its product addresses; the framing is not neutral.

## Claim 1 — 93% verify AI output
status: disputed
evidence:
- https://www.prnewswire.com/news-releases/half-of-us-workers-know-they-would-be-personally-liable-for-a-wrong-ai-answer-two-thirds-still-dont-always-check-kolmogorov-law-survey-finds-302867898.html — PR Newswire / Kolmogorov Law, P.C., published 2026-09-02, fielded 2026-09-01 via Pollfish, n=500 employed US adults 18-64 who use AI at work, MoE +/-4.4pp; accessed 2026-09-04. Figures: **65% do not always verify an AI answer before acting on it or passing it along; 32% verify only sometimes, rarely or never; 42% have knowingly accepted an answer they suspected was wrong.**
- https://www.solarwinds.com/blog/2026-state-of-itsm-what-800-it-professionals-say-about-ai-automation-and-the-year-ahead — SolarWinds, "2026 State of ITSM", published 2026-08-26, n=844 IT professionals; accessed 2026-09-04. Figure: **47% spend time reviewing and validating AI-generated output.**
- Note: Kolmogorov Law is a litigation firm publishing on AI liability, and SolarWinds is an ITSM vendor; neither is disinterested, but neither is UJET-derived.
reasoning: Two independent surveys with their own samples put the verification rate far below 93% — 35% always verify (Kolmogorov) and 47% do any AI-output review (SolarWinds) — the opposite direction and a different order of magnitude from the UJET figure. The populations are not identical (general US knowledge workers and IT professionals, versus UJET's 250 US contact-centre agents), and "feel compelled to double-check" is a softer question than "always verify", so this is a material disagreement rather than a clean refutation; report both figures, never a blend.

## Claim 2 — ~70% report reduced after-call work
status: unverified
evidence: No independent survey found that asks agents whether AI reduced after-call work. Closest partial, directional material:
- https://www.verint.com/blog/state-of-agent-experience-2026-ai-in-contact-centers-part-2/ — Verint, published 2026-05-05, n=1,000 frontline agents (State of Agent Experience 2026); accessed 2026-09-04. Confirms ACW is a large burden — **54% of calls require after-call work, ~3 minutes per call** — and asserts that automating ACW "can unlock significant capacity", but publishes **no agent-reported reduction percentage**. Verint is a workforce-engagement vendor.
- SolarWinds 2026 State of ITSM (as above): **2.8 hours of weekly time saved on documenting and summarizing incidents**, but **52% report their workload has increased since AI adoption** — savings on the task did not translate to less work overall.
reasoning: The underlying problem (heavy wrap-up/documentation load, plausible AI relief) is independently corroborated, but the specific quantity — roughly seven in ten agents crediting AI with reduced ACW — has no second source, and the ITSM data cuts against the implied net-relief reading. Treat the 70% as single-sourced.

## Claim 3 — 81% use 4+ tools per interaction
status: unverified
evidence: No independent survey found. The commonly repeated figures — "4 to 10 different applications" and "5-7 applications during a single customer interaction, adding 2-3 minutes of handling time" — appear only in vendor marketing pages (nice.com agentic-AI page, bland.ai blog) with no named survey, sample size, or fielding date behind them, so they are not usable as confirmation. Verint's n=1,000 study measures the symptom in time, not tool count: **45% of calls require agents to search for answers, ~2.7-3 minutes per interaction** (https://www.verint.com/press-room/2026-press-releases/nearly-one-third-of-contact-center-agents-plan-to-quit-as-agent-experience-falls-short/, published 2026-04-14, fielded 2025-11-18 to 2025-12-09, n=1,000 agents at orgs with 300+ agents; accessed 2026-09-04). No source found for the ">7 tools = 19%" tail at all.
reasoning: Tool sprawl as a phenomenon is widely asserted and indirectly supported by Verint's search-time data, but the specific distribution (81% over four tools, 19% over seven) traces to nothing but UJET. Anything resembling it in circulation is unsourced vendor copy, not a second measurement.

## ITSM-specific data
One relevant ITSM source found: **SolarWinds "2026 State of ITSM", n=844 IT professionals, published 2026-08-26** (https://www.solarwinds.com/blog/2026-state-of-itsm-what-800-it-professionals-say-about-ai-automation-and-the-year-ahead, accessed 2026-09-04). Usable figures: 47% spend time reviewing and validating AI-generated output; 2.8 hours/week saved on documenting and summarizing incidents; 52% say workload has increased since AI adoption. Vendor-run (SolarWinds sells ITSM software).
No ITSM survey was found that measures verification-before-use at the individual-ticket level, or the number of tools an L1/L2 operator touches per incident. The tool-count claim in particular has no ITSM analogue — carrying the contact-centre number into IT incident triage is an unsupported transfer.

## Notes on independence
- Nothing found in this run republishes or recycles the UJET survey; the disagreement above comes from genuinely separate samples, not from the same upstream press release read twice.
- Every source located is vendor- or firm-run (UJET, Verint, SolarWinds, Kolmogorov Law). No academic, Gartner, Forrester, Salesforce, Zendesk, Intercom, Genesys, NICE or Calabrio survey addressing these three specific quantities surfaced within budget.
- The nice.com and bland.ai tool-count numbers are marketing copy with no stated methodology; they were deliberately not counted as confirmation.
- Budget note: 6 sources read, 11 tool calls used. Claims 2 and 3 remain single-sourced to UJET/No Jitter after this pass.
