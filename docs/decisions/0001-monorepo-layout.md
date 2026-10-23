# ADR-0001: Monorepo layout

Status: accepted (owner instruction, 2026-10-23)

## Context
Three client apps, one API, an IdP config and shared code must be easy to track, run and present.

## Decision
One git repo, one PR flow:
- `apps/react`, `apps/angular`, `apps/mvc`: self-contained apps, each with a short README (what, how to run, port).
- `api/`: shared ASP.NET Core API.
- `packages/`: code shared between apps (`idp-profile`, `ui-tokens`) instead of copies.
- `idp/` Keycloak and profiles; `tools/` idp-check; `demo/` demo scripts.
- `docs/`: all documentation in one place (no per-app doc folders), index in `docs/README.md`, journal in `docs/progress-log.md`.
- Root README has a repo map; root scripts (npm scripts) start each part with one command and work on Windows.

## Consequences
One place to review and search; shared code cannot drift between apps. Cost: tooling must handle both npm and .NET in one repo.
