# multi-app-sso-stepup

Proof of concept: single sign-on across three apps (React, Angular, ASP.NET Core MVC) and one shared API using an external IdP, plus step-up MFA re-authentication for sensitive actions.

> Status: early work in progress. PoC, not production-hardened.

Configuration: copy `.env.example` to `.env` (git-ignored) and edit. The example holds placeholders only.

## Repo map (monorepo)

| Folder | Purpose | Port | Status |
|--------|---------|------|--------|
| `apps/react` | Customer Portal (React SPA) | 5300 | planned |
| `apps/angular` | Payments and Transfers (Angular SPA) | 5400 | planned |
| `apps/mvc` | Back Office (ASP.NET Core MVC) | 5200 | planned |
| `api/` | Shared ASP.NET Core API, enforces step-up | 5100 | planned |
| `packages/` | Shared code: `idp-profile` (profile loader), `ui-tokens` (Acme Bank look) | - | planned |
| `idp/` | Keycloak realm and IdP profiles | 8180 | in progress |
| `tools/` | `idp-check` capability probe | - | planned |
| `demo/` | Live-demo scripts and backups | - | planned |
| `docs/` | ALL documentation (index: `docs/README.md`, history: `docs/progress-log.md`) | - | yes |
| `agent/` | Task-runner agent files | - | yes |

## Documentation

Start at [`docs/README.md`](docs/README.md): architecture and IdP communication, token refresh, and the step-up actions.

## Development with the task-runner agent

This repo includes a resumable Claude Code agent that executes a to-do list and
survives terminal shutdowns. See [`agent/README.md`](agent/README.md).

Requirements: [Claude Code](https://claude.com/claude-code), bash.

```text
.claude/agents/todo-runner.md     agent instructions
.claude/commands/run-todos.md     /run-todos command
agent/TODO.md                     your task list
agent/LOG.md                      run history (local, git-ignored)
agent/log.sh                      log helper
```

## Contributing

Work happens in PRs into `main` using `<type>/<slug>` branches; see [CONTRIBUTING.md](CONTRIBUTING.md). Open an issue before large changes. Do not commit secrets, client secrets or
tokens, and keep real IdP credentials out of the repo. See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE).
