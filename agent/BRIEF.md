# Project brief: SSO + step-up MFA PoC

The agent reads this file at the start of every run, before `TODO.md`.

## Role and context
You are helping a senior IT architect build a proof of concept: **single sign-on across several applications using an external IdP, with step-up MFA re-authentication for sensitive actions.** The repo is private for now and will be published later. Treat it as public: no real secrets, tenant IDs or IdP URLs in any commit, ever.

State any assumption before relying on it and flag anything that needs the owner's decision. Do not silently pick.

## Goals
1. Three independent clients share one login session via the IdP (true SSO: log in once, the others do not prompt):
   - **App React**: React SPA
   - **App Angular**: Angular SPA
   - **App MVC**: ASP.NET Core MVC (C#), server-rendered
2. Each client exposes at least one **sensitive action** that requires fresh MFA even with a valid SSO session.
3. Step-up is enforced **server-side**, from validated token claims (`acr`, `auth_time`), never from a client-side flag.
4. **IdP-agnostic by design.** Anyone can connect another IdP (Entra ID, Okta, AWS Cognito, generic OIDC) by adding a profile file and environment variables, without touching app logic. IdP differences (how to request step-up, which claims carry level and auth time, how the API challenges) live in profiles under `idp/profiles/`, loaded by a small adapter. See `docs/idp-adapter.md`.

## Non-goals
- Production hardening, HA, user provisioning/SCIM.
- Building our own MFA: the IdP performs MFA, apps request and verify it.
- SAML (OIDC only).
- Automated tests (see Decisions). Verification is by code review and manual steps.

## Constraints
- OIDC Authorization Code flow with PKCE. No implicit flow.
- Local IdP: Keycloak in Docker (no cloud tenant, no secrets). Entra ID / Okta swappable via config.
- Config via environment variables. Commit `.env.example` only; `.env` is git-ignored.
- Never commit secrets, real tenant IDs or tokens. Needed values go into `.env.example` as placeholders.

## Decisions (recorded 2026-10-23)
| # | Decision | Value | Source |
|---|----------|-------|--------|
| 1 | Stack | React SPA + Angular SPA + C# ASP.NET Core MVC, plus one shared ASP.NET Core API (see Architecture) | Owner chose three clients; **shared API confirmed by owner** |
| 2 | Second factor | TOTP | **Confirmed by owner** (authenticator app on phone). WebAuthn possible later |
| 3 | Step-up freshness | **Shared window** across all apps | Owner |
| 4 | Front/back-channel logout | Out of scope; local + RP-initiated logout only, document the rest | Owner |
| 5 | Entra/Okta tenant | None available. Config template and docs only, untested | Owner (no tenant mentioned) |
| 7 | IdP flexibility | Profile-driven adapter from the start (Phase 2), not bolted on in Phase 5. Only Keycloak is tested; other profiles are templates | Owner (requirement); phase order changed by agent |
| 8 | "AWS IdP" | Amazon Cognito, as an untested profile template. **Keycloak is the primary IdP** because the demo runs locally | Owner |
| 9 | Step-up max age | **1 minute for all sensitive actions** (so it can be shown in the live demo); must be configurable, not hard-coded | Owner |
| 10 | Platforms | Built on macOS; the demo runs on a **Windows** office laptop. Everything needed to run the demo must work on both | Owner |
| 11 | Presentation | Mixed audience, 45 min, live demo, owner has a company PPT template (kept out of git) | Owner |
| 12 | Publishing | Fresh squashed repo, not flipping this one | Owner |
| 6 | Tests | No E2E or automated test suites. Verify by code review and a manual checklist | Owner |

## Architecture (recommended, needs owner confirmation)
SPAs are public clients: anything they check is client-side and bypassable. To keep goal 3 true, **the sensitive actions live in a shared ASP.NET Core API** that validates the access token (signature via cached JWKS, `iss`, `aud`, `exp`) and enforces policy from `acr` and `auth_time`. If the token is not strong or fresh enough, it returns `401` with `WWW-Authenticate: Bearer error="insufficient_user_authentication", acr_values="...", max_age="..."` (RFC 9470, OAuth step-up). The client then starts a new authorization request with those parameters and retries.

- React / Angular: Authorization Code + PKCE as public clients; tokens kept in memory, not localStorage.
- MVC: confidential client, server-side session behind an `HttpOnly`, `Secure`, `SameSite=Lax` cookie (documented http-localhost dev exception).
- Shared freshness comes for free: the API judges every request from the token's `auth_time`/`acr`, and the IdP session is shared.
- Trade-off to document in an ADR: tokens in browser JS are weaker than a BFF pattern (server holds tokens, SPA gets a cookie). BFF is the production-grade alternative, left out of the PoC to keep scope small.

## IdP adapter rules
- No app code may reference Keycloak (or any single IdP) by name, claim name or URL; go through the adapter.
- The API's evaluator is authoritative. If a profile cannot express a safe freshness check (no `auth_time`, no equivalent), refuse to start for actions with a max age instead of skipping the check.
- Never claim a provider works unless it was tested against a real tenant.

## Known IdP caveats to verify, not assume
- Keycloak does not emit `amr` natively; use a mapper or document that only `acr` is relied on.
- Confirm `auth_time` and `acr` appear in **access tokens** as well as ID tokens, since the API reads the access token.
- Entra uses Conditional Access authentication context / claims challenges rather than plain `acr_values`; the Phase 5 adapter may need real logic.

## Working rules
- **The owner is new to SSO/OIDC/MFA.** Explain in plain language, define each term on first use (what it is, why it exists, a one-line example), and prefer a small diagram or analogy over jargon. When the owner is confused, stop and explain before continuing. Phase reports include a short "what you should now understand" section and a glossary of new terms. Put lasting explanations in `docs/glossary.md`.
- Work phase by phase. At each `GATE` task, stop the run and report: what was done, how to verify, known weaknesses.
- Challenge the owner's design choices when you see a flaw, with reasoning and a concrete alternative.
- Prefer small commits with clear messages. Ship via PR as in `.claude/agents/todo-runner.md`.
- Because there are no automated tests, state plainly in each report what was only reviewed and what was actually run. Never claim something works unless you ran it.

## Cross-platform rules (macOS dev, Windows demo)
- Run everything through `docker compose`, `dotnet` and `npm` commands, which behave the same on both. Do not make the demo depend on bash scripts; if a helper script is needed, provide a PowerShell version too, or write it as an npm script.
- Add `.gitattributes` forcing LF for scripts, JSON and config, so Windows checkout does not break them.
- Use forward-slash paths in config, avoid case-only file name differences, and document Docker Desktop (WSL2) setup, free ports and the clock-sync requirement for TOTP in `docs/windows-setup.md`.
- `agent/log.sh` is bash and only used by the agent on macOS (on Windows use Git Bash or WSL).
- The company PPT template must NOT be committed (it may be confidential); keep it in a git-ignored folder.
