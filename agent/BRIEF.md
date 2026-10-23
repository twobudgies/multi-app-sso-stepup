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
4. IdP-specific behavior is isolated behind config/adapter so a second IdP can be added without touching app logic.

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
| 1 | Stack | React SPA + Angular SPA + C# ASP.NET Core MVC, plus one shared ASP.NET Core API (see Architecture) | Owner chose three clients; shared API is the agent's recommendation, **pending owner confirmation** |
| 2 | Second factor | TOTP | Default assumed (owner did not choose). Easy to change to WebAuthn later |
| 3 | Step-up freshness | **Shared window** across all apps | Owner |
| 4 | Front/back-channel logout | Out of scope; local + RP-initiated logout only, document the rest | Owner |
| 5 | Entra/Okta tenant | None available. Config template and docs only, untested | Default assumed |
| 6 | Tests | No E2E or automated test suites. Verify by code review and a manual checklist | Owner |

## Architecture (recommended, needs owner confirmation)
SPAs are public clients: anything they check is client-side and bypassable. To keep goal 3 true, **the sensitive actions live in a shared ASP.NET Core API** that validates the access token (signature via cached JWKS, `iss`, `aud`, `exp`) and enforces policy from `acr` and `auth_time`. If the token is not strong or fresh enough, it returns `401` with `WWW-Authenticate: Bearer error="insufficient_user_authentication", acr_values="...", max_age="..."` (RFC 9470, OAuth step-up). The client then starts a new authorization request with those parameters and retries.

- React / Angular: Authorization Code + PKCE as public clients; tokens kept in memory, not localStorage.
- MVC: confidential client, server-side session behind an `HttpOnly`, `Secure`, `SameSite=Lax` cookie (documented http-localhost dev exception).
- Shared freshness comes for free: the API judges every request from the token's `auth_time`/`acr`, and the IdP session is shared.
- Trade-off to document in an ADR: tokens in browser JS are weaker than a BFF pattern (server holds tokens, SPA gets a cookie). BFF is the production-grade alternative, left out of the PoC to keep scope small.

## Known IdP caveats to verify, not assume
- Keycloak does not emit `amr` natively; use a mapper or document that only `acr` is relied on.
- Confirm `auth_time` and `acr` appear in **access tokens** as well as ID tokens, since the API reads the access token.
- Entra uses Conditional Access authentication context / claims challenges rather than plain `acr_values`; the Phase 5 adapter may need real logic.

## Working rules
- Work phase by phase. At each `GATE` task, stop the run and report: what was done, how to verify, known weaknesses.
- Challenge the owner's design choices when you see a flaw, with reasoning and a concrete alternative.
- Prefer small commits with clear messages. Ship via PR as in `.claude/agents/todo-runner.md`.
- Because there are no automated tests, state plainly in each report what was only reviewed and what was actually run. Never claim something works unless you ran it.
