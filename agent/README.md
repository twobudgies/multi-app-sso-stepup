# Resumable task-runner agent

A Claude Code subagent that works through a to-do list you write, and can be
killed at any moment (terminal closed, crash, laptop sleep) and resumed from
exactly where it stopped.

## Quick start

1. Edit [`TODO.md`](TODO.md) and list your tasks (format below).
2. In Claude Code, run `/run-todos`.
3. If the session dies, open Claude Code in this repo and run `/run-todos` again.

Optional: `/run-todos <extra instructions>` passes extra guidance to the agent for that run.

## Files

| File | Who writes it | Purpose |
|------|---------------|---------|
| `TODO.md` | You (task text) and the agent (markers) | The instructions. Source of truth for task status. |
| `LOG.md` | Agent, only via `log.sh` | Append-only, timestamped history. Git-ignored. Created on first log. |
| `log.sh` | — | Helper that appends one line to `LOG.md`. |
| `../.claude/agents/todo-runner.md` | — | The agent's system prompt (rules and loop). |
| `../.claude/commands/run-todos.md` | — | The `/run-todos` slash command. |

## TODO.md format

```markdown
- [ ] T1: Short imperative title
  - done when: how the agent should verify it is finished
  - any other detail or constraint
```

Markers: `[ ]` pending, `[~]` in progress, `[x]` done, `[!]` blocked.
Give every task a unique ID. Tasks run top to bottom. You may edit pending
tasks or append new ones at any time, including between runs.

## How resume works

The agent keeps no memory between runs. Its state is `TODO.md` plus `LOG.md`.

1. Before a task, it sets the marker to `[~]` and logs `START`.
2. During a task, it logs a `NOTE` after each meaningful step, and before risky or long operations.
3. After verifying the result, it sets `[x]` and logs `DONE`.
4. On restart, it logs `RESUME` and picks the first `[~]` task (else the first `[ ]`).
   It then inspects the real state (`git diff`, files) and does only the remaining work.

Steps are written to be idempotent, so a repeated step does no harm.

## Log events

`INIT` first run · `RESUME` restart · `START` task begun · `NOTE` step taken ·
`DECISION` choice made and why · `DONE` task verified · `BLOCKED` needs you · `FINISH` list complete.

Example:

```
2026-10-23 18:30:40 | INIT     | first run
2026-10-23 18:31:02 | START    | T1: add login route
2026-10-23 18:33:15 | NOTE     | T1: route file written, tests next
```

## Safety rules the agent follows

- Does only what a task says. Extra work becomes a new `[ ]` task at the bottom.
- Blocked after 3 genuine attempts, or needs a decision or credential: marks `[!]`, writes `blocked: <reason>`, continues with other tasks.
- No destructive or outward-facing actions (force-push, deploys, deleting data, sending messages) unless a task explicitly says so.
- Commits only if your tasks or a `CLAUDE.md` allow it.

## Limitations

- Resume depends on the local `LOG.md`. A fresh clone starts with no history; `TODO.md` markers still show which tasks are done.
- If a crash happens between finishing work and updating a marker, the agent re-checks the real state, so the task may be re-verified rather than skipped.
- Do not put secrets in `TODO.md`. Tasks are committed.
