# Engineering Constitution — Python + Spec Kit + Agent Tooling

**Version:** 1.0.0  
**Ratified:** 2026-09-02

## 1. Purpose

This document is the durable engineering contract for the repository. It defines
how requirements, implementation evidence, external documentation, memory, and
agent tooling are used. Tools may assist the process; they do not replace
approved requirements, executable tests, or human decisions.

## 2. Authority and conflict resolution

Use this order when sources disagree:

1. the user's current explicit request and approvals;
2. this constitution;
3. the approved feature specification, plan, and tasks;
4. repository contracts, tests, and observed current behavior;
5. version-specific official documentation for external dependencies;
6. Graphify output and agent memory, which are advisory evidence only.

Do not silently choose between conflicting sources. Record the conflict, its
impact, and the decision needed before changing affected behavior.

## 3. Roles of the frameworks

| Capability | Role | Canonical status |
|---|---|---|
| Spec Kit | Requirements, plan, tasks, acceptance criteria | Required source of truth for approved feature scope |
| BMAD | Optional discovery and product/architecture exploration | Input to Spec Kit, never a parallel authority |
| Graphify | Code navigation and change-impact evidence | Advisory; verify against current code |
| Claude native memory / claude-mem | Prior decisions and session continuity | Advisory; verify before use |
| Context7 | Version-aware library/API documentation | Evidence; verify version and source |
| Superpowers | Design, worktree, TDD, execution, review | Preferred implementation discipline when installed |

Approved BMAD findings must be reconciled into the Spec Kit specification or
plan before implementation. Do not maintain duplicate competing task systems.

## 4. Canonical artifacts

- Constitution: `.specify/memory/constitution.md`.
- Feature artifacts: `specs/<feature>/spec.md`, `plan.md`, and `tasks.md`.
- Optional supporting artifacts stay under the same feature directory.
- Graphify output, when generated: `graphify-out/`; exclusions:
  `.graphifyignore` and `.gitignore`.
- Agent entry points: `CLAUDE.md` and `AGENTS.md`.
- Reusable agent roles: `.claude/agents/` and `.opencode/agents/`.

Do not treat a local claude-mem database or configuration as a repository
artifact. Never commit secrets, credentials, private prompts, or raw personal
data to specifications, graphs, memory, logs, or fixtures.

## 5. Select the delivery lane

### Full lane

Use for new features, public contract changes, architecture or data model
changes, security-sensitive work, migrations, or changes spanning multiple
modules:

1. discover the current repository and available agent capabilities;
2. create or update the feature specification and acceptance criteria;
3. clarify material ambiguity;
4. create the technical plan;
5. create ordered, testable tasks;
6. analyze cross-artifact consistency;
7. implement in small vertical slices with TDD;
8. run verification and independent review;
9. reconcile implementation evidence with the specification.

Use the installed Spec Kit command names reported by the active integration.
Common commands include `/speckit.specify`, `/speckit.plan`,
`/speckit.tasks`, `/speckit.analyze`, and `/speckit.implement`; do not invent a
command when the integration exposes a different skill or name.

### Fast lane

Allowed for an estimated change under 30 minutes and at most three files only
when it does not alter a public API, persisted data, security boundary, or
architecture. Record the goal and acceptance check, add or update a regression
test, implement the smallest change, run focused verification, and review the
diff. If scope grows, switch to the full lane.

An emergency hotfix may use the fast lane, but requires a regression test and a
follow-up update to any affected specification or decision record.

## 6. Tool preflight and graceful degradation

At session start, inspect the repository before acting. Spec Kit CLI and its
active-harness integration are mandatory; stop and install/configure them when
missing. Detect whether BMAD, Graphify, Context7, claude-mem, and Superpowers are
installed, and use only capabilities that exist in the current harness.

Missing tooling other than Spec Kit is not by itself a blocker. Use these
fallbacks and report them:

- Graphify unavailable: use repository search, imports, tests, and `git diff`.
- Memory unavailable: use committed decisions, specs, and current conversation.
- Context7 unavailable: use installed package metadata and official docs/source.
- Superpowers unavailable: apply the same design, TDD, review, and handoff stages
  manually.

Missing Spec Kit, unclear acceptance criteria, unsafe migration conditions,
missing authority, or an unreconciled contract conflict are blockers.

## 7. Evidence rules

### Graph

Refresh Graphify before architecture or multi-module impact analysis when its
output is absent or stale. Use `/graphify .` when the installed integration
provides it, otherwise use the documented `graphify update .` CLI. Confirm
important nodes and edges in source code. Use code-only mode or exclusions when
non-code content must not be sent to a model provider.

### Memory

Search memory only when prior decisions can materially affect the task. Summarize
only the observations actually used and verify them against current files.
Memory cannot override a specification or current request. Exclude secrets and
sensitive content; prefer local providers when local-only processing is required.

### External libraries and APIs

Read the installed or locked dependency version first. Query Context7 with the
exact library and version when available, then record the library, version,
source, and decision supported. Community-contributed snippets are not proof by
themselves; reconcile them with official documentation, source, and the installed
package. Never fabricate an API from model memory.

## 8. Implementation discipline

- Approve the design before creating an implementation worktree.
- Use one worktree/branch per feature or coherent change, not per micro-task.
- Preserve unrelated user changes and begin from a known baseline.
- Follow red → green → refactor for behavior changes.
- Keep tasks atomic and independently verifiable; 2–5 minute steps are a useful
  Superpowers planning granularity, not a universal compliance metric.
- Prefer existing architecture and dependencies; justify additions.
- Keep external I/O behind explicit boundaries with timeouts and test doubles.
- Never hide failures with blanket exceptions, unbounded retries, arbitrary
  sleeps, empty tests, or unjustified `xfail`.

## 9. Python quality gate

Use project-provided commands first. For changed scope, run as applicable:

1. formatter/linter (`ruff format --check`, `ruff check`, or project equivalent);
2. configured type checker (`mypy` or `pyright`);
3. focused tests, then the broader relevant suite;
4. security/secret scanning when configured;
5. smoke or end-to-end verification of the changed user outcome.

Do not install missing tooling merely to satisfy a generic command. Report each
check as `PASS`, `FAIL`, or `NOT RUN` with the reason.

## 10. Review and completion

Review requirement coverage, correctness, tests, security, compatibility,
operability, and accidental files. Critical and high-severity findings block
completion. Lower-severity findings must be fixed or explicitly accepted with a
rationale and owner.

Maintain traceability:

`requirement → acceptance criterion → implementation → test → evidence`

Completion requires satisfied acceptance criteria, passing applicable checks,
reviewed diff, updated affected documentation/specification, and a handoff that
lists changes, decisions, verification, residual risks, and the next action.

## 11. Agent-specific operating rules

For smaller Qwen deployments, send one bounded task at a time with exact files,
constraints, acceptance criteria, and verification commands. Keep the context
focused; retrieve graph and memory fragments on demand. Use a separate reviewer
role, but require the primary agent to verify all delegated output.

Instruction files guide behavior but are not security enforcement. Put hard
command/file restrictions in Claude Code hooks/settings or OpenCode permissions,
and keep destructive or external side effects approval-gated.
