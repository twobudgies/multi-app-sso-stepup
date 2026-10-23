# Contributing

All changes, by people or by the task-runner agent, go through a pull request into `main`. No direct commits to `main`.

## Branch names

`<type>/<short-slug>` (agent tasks: `<type>/<task-id>-<short-slug>`)

| Type | Use for |
|------|---------|
| `feature` | new functionality |
| `fix` | bug fixes |
| `docs` | documentation only |
| `refactor` | behaviour-preserving restructuring |
| `test` | adding or fixing tests |
| `chore` | tooling, config, dependencies |

Examples: `feature/step-up-mfa-prompt`, `fix/t5-token-expiry`.

## Commits and PR titles

`<type>: <imperative subject>`, for example `fix: reject expired step-up tokens`.
The PR is squash-merged, so the PR title becomes the commit on `main`.

## Merging

Squash merge and delete the branch. Never force-push or rewrite `main`.
Never commit secrets (see [SECURITY.md](SECURITY.md)).
