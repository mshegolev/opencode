# Claude Code and OpenCode/Qwen Setup

This repository uses one constitution with thin harness-specific entry points:

- `.specify/memory/constitution.md` — canonical engineering rules;
- `CLAUDE.md` — Claude Code entry point;
- `AGENTS.md` — OpenCode/Qwen entry point;
- `.claude/agents/python-reviewer.md` — Claude review subagent;
- `.opencode/agents/python-builder.md` and `python-reviewer.md` — bounded OpenCode
  roles;
- `opencode.example.jsonc` — model indirection and Context7 MCP example.

## One-command project installation

The repository is also an NPX-compatible package. Preview and install all
managed files into an existing Python project:

```bash
npx --package=. specguard-init --target /path/to/python-project --dry-run
npx --package=. specguard-init --target /path/to/python-project
npx --package=. specguard-init doctor --target /path/to/python-project
```

When the package is published, replace `.` with
`@bqa-os/specguard-init@latest` and omit the explicit binary name. A downloaded
tarball can be run with
`npx --package=./bqa-os-specguard-init-0.1.1.tgz specguard-init`. Use
`--profile claude` or
`--profile opencode` for one harness. A conflicting file is preserved by
default; `--force` creates a timestamped `.specguard-backups/` copy before
replacement. `--no-backup` is available only as an explicit opt-out.

External tool installation is a separate approval boundary. The following
prints the exact plan and changes nothing:

```bash
npx --package=. specguard-init tools --profile opencode \
  --include spec-kit,graphify,context7
```

Only `--apply --yes` executes supported commands. Superpowers remains manual
because its supported installation mechanism differs between harnesses.

Copy `opencode.example.jsonc` to `opencode.jsonc` only after reviewing any
existing project configuration. Do not overwrite an existing config blindly.

## Why the original constitution needed correction

| Original assumption | Corrected rule |
|---|---|
| BMAD and Spec Kit jointly own specifications | Spec Kit is canonical; BMAD is optional upstream discovery |
| Specifications live in `.specify/specs/` | Constitution lives in `.specify/memory/`; features live in `specs/<feature>/` |
| Graphify state lives in `.graphify/` | Current Graphify output is `graphify-out/` |
| claude-mem is a repository artifact | It is external/local memory and only advisory |
| One worktree/branch for every 2–5 minute task | One worktree per feature/coherent change; micro-steps stay in the plan |
| Every code edit must update a specification | Update specs when behavior/contracts change; use the fast lane for bounded fixes |
| Prompt rules enforce prohibitions | Hard restrictions require Claude hooks/settings or OpenCode permissions |
| Context7 snippets are automatically authoritative | Lock the version and reconcile Context7 with official docs/source |

## Installation and capability discovery

Install only the tools the team has approved. Versions and install flows can
change, so review the linked official documentation first.

### Spec Kit

Spec Kit CLI is mandatory for this workflow. `specguard-init doctor` reports a
failure until the `specify` command is available. Install it with:

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
```

Use `specify integration list` to see the current Claude Code/OpenCode
integration names. Initialize an existing project in a reviewable branch and
inspect every generated file; use force/overwrite options only after checking the
diff. The current core flow is constitution → specify → clarify → plan → tasks →
analyze → implement → converge. Command spelling may differ between slash-command
and skill-based integrations.

Official sources: [Spec Kit repository](https://github.com/github/spec-kit),
[existing-project guide](https://github.com/github/spec-kit/blob/main/docs/guides/existing-projects.md/).

### BMAD

Install with:

```bash
npx bmad-method install
```

Use `bmad-help` to discover the installed workflow. `bmad-project-context` can
capture existing-project conventions, `bmad-spec` suits larger scoped changes,
and `bmad-build` is the direct path for a small well-defined change. If BMAD is
used, move approved requirements and decisions into the Spec Kit artifacts before
coding.

Official sources: [BMAD Method repository](https://github.com/bmad-code-org/bmad-method),
[BMAD documentation](https://docs.bmad-method.org/).

### Graphify

```bash
uv tool install graphifyy
graphify install                         # Claude Code
graphify install --platform opencode     # OpenCode
graphify update .                        # CLI refresh
```

The installed agent integration may also expose `/graphify .`. Graph code for
architecture-impact work, not as a mandatory tax on every tiny edit. Graphify
parses code locally, while supported documents or images may use a configured
model backend; exclude sensitive content or select code-only operation.

Official source: [Graphify repository](https://github.com/Graphify-Labs/graphify).

### Memory

Claude Code already supports project instructions and native auto-memory. Add
claude-mem only if searchable cross-session observations justify the extra local
worker, database, privacy, and maintenance surface.

```bash
npx claude-mem install
npx claude-mem install --ide opencode
```

Use memory progressively: search → timeline → specific observations. Verify each
reused decision against current source and specs. Exclude sensitive content with
the tool's privacy controls and configure a local provider when data must remain
local.

Official sources: [Claude Code memory](https://code.claude.com/docs/en/memory),
[claude-mem repository](https://github.com/thedotmack/claude-mem).

### Context7

The example OpenCode config uses the current remote MCP endpoint:
`https://mcp.context7.com/mcp`. The setup helper can configure a supported
harness:

```bash
npx ctx7 setup --claude
npx ctx7 setup --opencode
```

Query with the exact library and locked version. Record the source and the
decision it supports; do not paste large documentation dumps into the permanent
agent context.

Official sources: [Context7 repository](https://github.com/upstash/context7),
[OpenCode MCP configuration](https://opencode.ai/docs/mcp-servers/).

### Superpowers

For Claude Code, the official repository documents:

```text
/plugin install superpowers@claude-plugins-official
```

For OpenCode, follow the current `.opencode/INSTALL.md` from the official
repository. Use its workflow after design approval: feature worktree, small plan
steps, red–green–refactor, bounded execution, review, then branch completion.

Official source: [Superpowers repository](https://github.com/obra/superpowers).

## OpenCode with Qwen

OpenCode model IDs use `provider/model`. Because available Qwen variants and
provider IDs change, select the exact ID with `/models` and keep it outside the
repository:

```bash
export OPENCODE_MODEL='provider/current-qwen-coder-id'
opencode
```

The supplied agents intentionally omit a `model` field, so the primary uses the
selected model and the reviewer inherits it. Temperatures are conservative for
coding and review. Start with one builder and one reviewer; smaller/local models
usually perform more reliably with one bounded task and a compact evidence pack.

For Ollama, follow OpenCode's provider configuration and use an OpenAI-compatible
base URL such as `http://localhost:11434/v1`. If tool calls fail because context
is truncated, increase the model context window according to the provider guide
rather than repeatedly expanding prompts.

Official sources: [OpenCode rules](https://opencode.ai/docs/rules/),
[agents](https://opencode.ai/docs/agents/),
[models](https://opencode.ai/docs/models/), and
[providers](https://opencode.ai/docs/providers/).

## Enforcement boundary

`CLAUDE.md`, `AGENTS.md`, and the constitution provide context, not a sandbox. In
Claude Code, use permissions and `PreToolUse` hooks for actions that must be
blocked. In OpenCode, keep explicit per-agent `permission` policies and retain
approval for unmatched shell commands. Secrets and destructive operations should
remain outside autonomous agent authority.

Official sources: [Claude Code hooks](https://code.claude.com/docs/en/hooks),
[Claude Code subagents](https://code.claude.com/docs/en/sub-agents/).
