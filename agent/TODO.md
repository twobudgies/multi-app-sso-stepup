# TODO list (edit this file; the agent works top to bottom)

Markers: `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` blocked
Context, decisions and rules live in `BRIEF.md`. `GATE-*` tasks mean: write the phase report, mark done, END THE RUN.
Keep `T-FINAL` last (the presentation, Phase 7, comes right before it). New tasks go above it.

## Phase 0: Repo hygiene
- [x] P0-1: Add `.gitattributes` (LF for scripts/json/config); extend `.gitignore` (also `docs/presentation/private/` for the company template), add `.env.example`, README stub
  - `.gitignore` additionally covers `*.pem`, `*.key`, IdP exports (`*-export.json`, but NOT the checked-in realm file), `*.log`, `node_modules/`, `bin/`, `obj/`, `dist/`
  - `.env.example` with placeholders only; README marked "PoC, not production-hardened"
  - done when: files exist, `git check-ignore` confirms `.env` and `*.pem` are ignored
- [x] P0-2: gitleaks pre-commit hook and CI
  - `.pre-commit-config.yaml` with gitleaks; `.github/workflows/gitleaks.yml` running `gitleaks detect` over full history (`fetch-depth: 0`)
  - done when: if gitleaks is installed locally, a fake secret in a temp file is rejected by `gitleaks protect --staged`; otherwise say it was not run
- [x] P0-3: Update `SECURITY.md` on how test credentials are handled (fake dev-only values, documented, allowlisted)
- [x] P0-4: `docs/windows-setup.md` for the Windows demo laptop (Docker Desktop + WSL2, .NET SDK, Node, free ports, clock sync, git line endings); mark steps only reviewed, not run, since dev is on macOS
- [x] GATE-P0: Phase 0 report, then stop

## Phase R: retrofit (architect review of Phase 0)
- [x] R-1..R-6: README repo map, docs index and progress-log, ADR-0001/0002, Acme Bank and 60 s consistency in design docs, narrowed gitleaks allowlist, progress-log noted in agent/README.md

## Phase 1: Keycloak IdP (reproducible)
- [x] P1-1: `docker-compose.yml` for Keycloak with an imported realm JSON in `idp/keycloak/`
  - test users only, no real data; secrets via `${ENV}` placeholders from `.env`
  - done when: `docker compose up` yields a working realm with no manual clicks (run it if Docker is available)
- [x] P1-2: Clients `app-react` and `app-angular` (public, PKCE S256), `app-mvc` (confidential), and an audience for the API
- [x] P1-3: TOTP second factor; pre-seed a documented fake TOTP secret for the test user so no manual enrolment is needed (flag if Keycloak import cannot do this)
- [x] P1-4: Authentication flow with levels of assurance: LoA1 = password, LoA2 = password + TOTP, mapped to `acr`
- [x] P1-5: `acr` and `auth_time` in ID **and access** tokens; decide on `amr`; document the mappers in `docs/idp-keycloak.md`
- [x] GATE-P1: Phase 1 report, then stop

## Phase 2: SSO for three clients and a shared API
- [x] P2-0: IdP adapter foundation (before any app code), per `docs/idp-adapter.md`
  - define the profile JSON schema and `idp/profiles/keycloak.json` + `generic.json`; env vars `IDP_PROFILE`, `IDP_ISSUER` in `.env.example`
  - profile loader with fail-fast validation (TypeScript for SPAs, C# for API/MVC, same profile file)
  - request builder and evaluator interfaces; no app code may name Keycloak
  - done when: swapping `IDP_PROFILE` is the only change needed to select a profile; schema documented
- [x] P2-1: Scaffold `apps/react`, `apps/angular`, `apps/mvc`, `api/` (ASP.NET Core); minimal home, profile, one sensitive action each
  - shared-API architecture is confirmed by the owner
- [x] P2-1a: Shared demo domain and design: fictional "Acme Bank" (no real brands or logos), fake data only. `apps/react` = Customer Portal (accounts, balances, profile), `apps/angular` = Payments and Transfers (send money, add payee), `apps/mvc` = Back Office / Admin (limits, approvals, user management)
  - shared look: same palette, header and a nav bar linking across all three apps (visible SSO: click through with no login prompt); shared CSS tokens in one place (e.g. `shared/acme.css`) used by all three
  - "session panel" on every page: app name, user, `acr` level, `auth_time`, and a countdown for the 1-minute step-up window (values read from validated token data via the adapter, not hard-coded)
  - sensitive actions map to the table in `docs/step-up-actions.md` (e.g. transfer over a limit, add payee, change limits, approve); update that doc if names differ
  - simple, big text, readable on a projector; no heavy UI frameworks beyond what each app needs
  - done when: `docs/demo-domain.md` documents the story, nav, panel fields and action mapping
- [x] P2-1b: Customer Portal UI in `apps/react` per P2-1a (accounts, balances, profile, nav bar, session panel)
- [x] P2-1c: Payments and Transfers UI in `apps/angular` per P2-1a (send money, add payee, nav bar, session panel)
- [x] P2-1d: Back Office UI in `apps/mvc` per P2-1a (limits, approvals, user management, nav bar, session panel)
- [x] P2-2: API: JWT bearer validation (JWKS with caching/rotation, `iss`, `aud`, `exp`); `GET /me`, `POST /sensitive/{app}` (no policy yet)
- [x] P2-3: MVC: Authorization Code + PKCE, `state` and `nonce` verified, server-side session, cookie flags, dev-mode exception documented
- [x] P2-4: React: Authorization Code + PKCE (`oidc-client-ts`), in-memory token storage, `state`/`nonce` verified
- [x] P2-5: Angular: Authorization Code + PKCE (`angular-oauth2-oidc` or equivalent), in-memory token storage, `state`/`nonce` verified
- [x] P2-6: Logout: local + RP-initiated at the IdP in all three; document what happens to the other apps' sessions (back/front-channel out of scope)
- [x] P2-7: Manual SSO verification steps in `docs/manual-checks.md` (log in to one client, open another, no prompt)
- [x] GATE-P2: Phase 2 report, then stop

## Phase 3: Step-up MFA
- [x] P3-1: Policy per sensitive action (use the table in `docs/step-up-actions.md`; owner confirmed the actions and set **1 minute for all**; read the value from config/env `STEPUP_MAX_AGE_SECONDS`, default 60; use a small clock-skew leeway such as 5 s because the window is short) (required `acr`, max age, e.g. LoA2 and 5 min) in one config file the API reads
- [x] P3-2: API enforcement via the adapter evaluator (level + auth time from the profile, not hard-coded `acr`/`auth_time`); on failure return the RFC 9470 `401` challenge and do NOT perform the action
- [x] P3-3: Clients (via the adapter request builder) handle the challenge: new authorization request with `acr_values`, `max_age`, `prompt=login` where needed; originating action and return URL kept server-side (MVC session) or in memory keyed by `state` (SPAs); return URL allow-listed, no open redirect
- [x] P3-4: On return, re-validate the new token and let the API re-check `acr`/`auth_time` before the action resumes (never assume the IdP honored the request)
- [x] P3-5: Failure paths: user cancels MFA, IdP ignores `acr_values`, token `acr` lower than requested, clock skew
- [x] P3-6: Document shared-freshness behavior explicitly (MFA in one client satisfies the others inside the window)
- [x] P3-7: End-to-end run against live Keycloak: full SSO and step-up flow across all three apps and the API (SSO click-through, each sensitive action, shared window, expiry after 1 minute, failure paths from P3-5)
  - record exactly what was actually run vs only reviewed (with evidence) in `docs/manual-checks.md`; do not claim anything unrun
- [x] GATE-P3: Phase 3 report, then stop

## Phase 4: Code-review verification (no automated tests, per owner)
- [x] P4-1: Write `docs/review-checklist.md` listing the security-critical code paths (token validation, nonce/state, acr/auth_time checks, cookie flags, redirect allow-list, client tamper resistance) with file:line pointers and the manual check for each
- [x] P4-2: Self-review every item against the code; fix or log gaps. Report which items were only read and which were actually run
- [x] GATE-P4: Phase 4 report, then stop

## Phase 5: More IdP profiles and tooling (adapter foundation was built in P2-0)
- [x] P5-1: `tools/idp-check` capability probe (discovery vs profile expectations, flags mismatches)
- [x] P5-2: Profile templates for Entra ID (authentication context + claims challenge), Okta, Amazon Cognito (owner confirmed Cognito); verify every claim and parameter name against the provider's current documentation and cite the doc URL in the profile comments
- [x] P5-3: Handle IdPs without `auth_time` or without `acr_values` support per the "freshness problem" section; reject unsafe profiles at startup
- [x] P5-4: Extend `docs/idp-adapter.md` with a "how to add an IdP" walkthrough validated against the generic profile
- [x] P5-5: README states exactly which IdPs were tested (Keycloak only unless the owner provides a tenant); templates are labelled untested
- [x] GATE-P5: Phase 5 report, then stop

## Phase 6: Docs and pre-publish
- [x] P6-1: Reconcile `docs/architecture.md`, `docs/token-lifecycle.md`, `docs/step-up-actions.md` (written as design before the code existed) with the real code and lifetimes; fix anything that differs and remove their "design" status banner. README: architecture diagram, SSO flow, step-up sequence diagram, claims relied on, known limitations, how to run
- [x] P6-2: ADRs in `docs/decisions/`: PKCE code flow, server-side enforcement (API), freshness policy (shared), SPA tokens in memory vs BFF
- [x] P6-3: Pre-publish checklist doc: full-history `gitleaks` + `trufflehog`, then flip visibility OR publish a fresh squashed repo (owner prefers a fresh repo)
- [x] GATE-P6: Phase 6 report, then stop

## Phase 7: Presentation for the office team (after everything else is done)
- [x] P7-0: Presentation requirements (owner answered 2026-10-23): audience **mixed** (developers + managers), **45 min** total, **live demo** included. Owner has a company PPT template: ask them to place it in the git-ignored `docs/presentation/private/` folder (never commit it)
  - Time plan: ~5 min problem + SSO basics, ~8 min architecture/tokens/step-up concepts, **~12 min live demo**, ~5 min IdP flexibility, ~5 min security/trade-offs/what was verified, ~10 min Q&A and buffer
  - Mixed audience: each technical slide has a one-line plain-language takeaway for managers; deep detail goes to the appendix, not the main flow
  - Live demo needs a safety net: `demo/run-demo.md` with exact steps, a reset command that restores the clean state (`docker compose down -v` then `up`), runnable on Windows too; demo tested on Windows if the owner can run it, else clearly marked untested, a pre-demo checklist (ports, TOTP app or documented test code, clock sync), and **backup screenshots or a short screen recording** of every demo step in case it fails live
- [x] P7-1: Write `docs/presentation/outline.md`: story arc, one message per slide, speaker notes. Suggested arc: the problem (many logins, risky actions) -> SSO explained simply -> architecture (IdP, 3 apps, shared API) -> token journey and refresh -> step-up MFA with a live-style walkthrough -> IdP-agnostic adapter (Keycloak tested; Entra/Okta/Cognito as templates) -> security decisions and trade-offs (PKCE, API-side enforcement, tokens in memory vs BFF) -> what was verified vs only reviewed -> limitations and next steps -> Q&A
- [x] P7-2: Build the deck as a `.pptx` (use the pptx skill): about 16-18 main slides (fits 45 min with a 12-min live demo) plus appendix, clean visual design, diagrams reused from `docs/` (redrawn for slides), speaker notes on every slide, a demo-script slide with exact steps, an appendix with glossary and FAQ
  - content must come from the real, finished code and docs; no invented results, metrics or claims about untested IdPs
  - no real secrets, tenant IDs or IdP URLs on any slide
  - commit the deck under `docs/presentation/`
- [x] P7-3: Render the slides to images and check them visually (overflow, readability, contrast); fix issues; report any slide that could not be checked
- [x] P7-4: Write a one-page rehearsal guide: timing per slide, the 10 questions the team is most likely to ask with short answers
- [x] GATE-P7: Phase 7 report, then stop

## Phase 8: SAML 2.0 app (owner request 2026-11-02)
Goal: a 4th app, ASP.NET Core MVC (C#), that signs in with **SAML 2.0** against the same Keycloak realm, with step-up, so the owner can see exactly what changes between OIDC and SAML.
- [x] P8-1: Record the decision: BRIEF.md "SAML (OIDC only)" non-goal is lifted for this one app; add ADR-0006 (SAML app: library, why no shared-API tokens, step-up via RequestedAuthnContext + ForceAuthn)
- [x] P8-2: Keycloak: add SAML client `app-saml` to `idp/keycloak/realm.json` (signed assertions, ACS + SLO URLs on port 5500, attribute mappers); no secrets
- [x] P8-3: `apps/saml` ASP.NET Core MVC: SP-initiated SSO (ITfoxtec.Identity.Saml2), signature + audience + time checks, InResponseTo, server-side session, cookie flags
- [x] P8-4: (done with a second SAML client, because Keycloak 26.0 ignores RequestedAuthnContext; window not shared with OIDC apps) Step-up in SAML: AuthnRequest with RequestedAuthnContext (LoA2) + ForceAuthn; read AuthnContextClassRef and AuthnInstant from the NEW assertion; enforce the 1-minute window server-side per action; failure paths (cancel, IdP ignores the request)
- [x] P8-5: SAML logout (SP-initiated SLO) plus session panel, nav link from the three existing apps
- [x] P8-6: Run it against live Keycloak (SSO from an OIDC app with no prompt, step-up, expiry, logout); record run vs only reviewed in `docs/manual-checks.md`
- [x] P8-7: `docs/saml-vs-oidc.md`: plain-language "what changes" guide (terms map, flow diagram, step-up difference, files to read); README, repo map, `.env.example`, npm script `dev:saml`
- [x] GATE-P8: Phase 8 report

## Phase 9: Federated SSO by e-mail domain (owner request 2026-11-02, planned after Phase 8)
Goal: users from specific partner/company domains (for example `@corp-a.example`) sign in at THEIR OWN identity provider; our Keycloak acts as the broker, so the apps still see one token/assertion from one IdP. Use placeholder domains in the repo (the repo will be public).
- [ ] P9-0: Owner decision (2026-11-02): the real company IdP (Barco) is DROPPED; the partner IdP is an **Amazon Cognito user pool** with test users (owner-controlled, works from localhost, no outside approval). Any real partner can be added later by config only. Write `docs/partner-idp-onboarding.md`: (a) Cognito walkthrough step by step (user pool, app client with secret, hosted-UI domain, callback URL = our Keycloak broker endpoint, test users on a placeholder domain such as `@corp-a.example`, optional TOTP), (b) a short generic checklist and e-mail template for any future real partner (OIDC or SAML, metadata URL, client id/secret, URLs to register, claims, MFA signaling). Placeholders only, no real domains or pool ids
- [ ] P9-1: Confirm with the owner: Cognito is OIDC; which placeholder domains map to it; unknown domains stay on local password login (recommended)
- [ ] P9-2: Keycloak identity brokering: add one external IdP per domain (Cognito is the partner IdP; if the owner has no AWS account at hand, a second local Keycloak realm is the fallback); first-login user mapping and attribute mappers
- [ ] P9-3: Home realm discovery: ask for the e-mail first, route by domain to the matching IdP (domain-to-IdP map in config, not hard-coded); unknown domains use the local login
- [ ] P9-4: Step-up with a federated user: what `acr`/`auth_time`/AuthnContext does the partner IdP return, does the broker keep the level, what if the partner cannot do MFA (the "freshness problem" in `docs/idp-adapter.md`); reject unsafe combinations instead of skipping the check
- [ ] P9-5: Verify with all four apps (React, Angular, MVC, SAML) and write `docs/federation.md` (plain-language, trust model, what the partner must provide: metadata, claims, MFA); record run vs reviewed
- [ ] GATE-P9: Phase 9 report

<!-- Keep this task LAST. New tasks go above it. -->
- [!] T-FINAL: REMIND THE USER to make this repo public (currently private)
  - blocked: waiting for user (visibility is the owner's action; reminder delivered in the final report and docs/pre-publish-checklist.md)
  - Do NOT change the visibility or create a new repo yourself. Only tell the user, then mark this `[!]` with `blocked: waiting for user`.
  - Pre-flight checklist to show them: no secrets in code or git history (gitleaks + trufflehog, full history), LICENSE name correct, SECURITY.md contact filled in, private vulnerability reporting enabled, git author email OK to be public, README up to date.
  - Owner prefers a fresh squashed repo. If flipping instead: `gh repo edit twobudgies/multi-app-sso-stepup --visibility public --accept-visibility-change-consequences`
