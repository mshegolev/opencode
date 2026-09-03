# Claude Code Project Instructions

@.specify/memory/constitution.md

Apply the imported constitution to every task in this repository.

- Identify the delivery lane, relevant artifacts, git state, and available
  integrations; never claim use of a tool whose result was not inspected.
- Use Plan Mode for non-trivial design and at most one worktree per approved
  feature or coherent change.
- Retrieve only relevant Graphify, memory, and documentation evidence.
- Treat claude-mem as optional advisory context; native auto-memory may be
  sufficient, and neither store may contain secrets.
- Delegate bounded work only; the main agent must inspect the diff and verify it.
- Use `.claude/agents/python-reviewer.md` for an independent review after tests.
Use permissions and `PreToolUse` hooks—not prose—for hard restrictions.
