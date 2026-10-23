# Manual checks and evidence

Start everything (see README): `npm run up`, then in separate terminals `npm run dev:api`, `dev:react`, `dev:angular`, `dev:mvc`. Login `alice` / `alice-dev-only`; TOTP seed in [idp-keycloak.md](idp-keycloak.md). Keep the machine clock in sync.

## Checklist (do by hand, or run `tools/e2e`)
| # | Step | Expected |
|---|------|----------|
| 1 | Open http://localhost:5300, sign in with the password | Customer Portal, panel shows LoA1, "no step-up active" |
| 2 | Profile, Save e-mail | Modal "Extra verification needed"; nothing changed yet |
| 3 | Verify, enter the authenticator code | Back in the portal, "done", panel LoA2 and a 60 s countdown |
| 4 | Click "Payments and Transfers" in the nav | No login prompt (SSO); panel shows LoA2 |
| 5 | Send 50 | Works (small transfers need no step-up) |
| 6 | Send 2500 within the window | Works, no second prompt (shared window) |
| 7 | Open Back Office, change limit / approve | Works with no prompt inside the window |
| 8 | Wait until the countdown is 0 (plus 5 s skew), repeat step 6 | Modal again: step-up required |
| 9 | Click "Not now" in the modal | "Cancelled. Nothing was changed." |
| 10 | Sign out in one app, reload another | IdP login page (the SSO session ended) |
| 11 | Direct API tamper: call `POST /sensitive/change-email` with a LoA1 token (`npm run probe -- --token`) | 401 + `WWW-Authenticate: ... acr_values="2", max_age="60"` |

## Evidence: what was actually run (2026-10-23)
Environment: macOS, Keycloak 26.0 in Docker, .NET 10, Node 24, headless Chromium (Playwright) driven by `tools/e2e/e2e.mjs`; one complete run, all 13 checks PASS:

| Check | Result |
|-------|--------|
| 1 React login gives LoA1 | PASS (run) |
| 2 change-email at LoA1 shows modal, then TOTP gives LoA2 and the action completes | PASS (run) |
| 3 Angular opens with no prompt, shows LoA2; transfer of 2500 inside the window has no second prompt | PASS (run) |
| 4 MVC opens with no prompt; change-limit inside the window completes | PASS (run) |
| 5 after 72 s the same Angular action asks for step-up again | PASS (run) |
| 6 "Not now" cancels, nothing performed | PASS (run) |
| 6b error callback (`error=access_denied`) at React does not crash | WEAK (run): only proves no crash. Superseded by `tools/e2e/negative.mjs` A (see below), do not rely on 6b |
| 7 sign-out at React, then Angular shows the IdP login | PASS (run) |
| 11 API tamper cases (no token, bad token, LoA1, stale LoA2, fresh LoA2) | PASS (run with curl, see [api.md](api.md)) |

## Evidence added in Phase 4 (run 2026-10-23)
| Check | Result |
|-------|--------|
| A. IdP error on return (`login_required`) at React and Angular (authorize request rewritten with `prompt=none`), and at MVC (error delivered to `/signin-oidc`): a message is shown, one authorize request only, no loop | PASS (run, `tools/e2e/negative.mjs`). Found and fixed a redirect loop in Angular |
| B. IdP ignores `acr_values`/`max_age` (request rewritten), React and MVC: client refuses to continue, action NOT performed | PASS (run). Angular not run (same code pattern) |
| C. Evaluator with shifted clock (`npm run check:evaluator`): exact limit, +5 s leeway, 66 s denied, IdP clock 6 s ahead denied, LoA1, missing `auth_time`, unknown `acr` | PASS (run, 9 cases) |

## Only reviewed, NOT run
- The IdP ignoring `acr_values` at Angular (React and MVC were run with a rewritten request).
- Real clock skew between two machines (only the evaluator with synthetic claims was run).
- Cancelling at the IdP's own page (Keycloak's OTP page has no cancel button): the error-return path was run through a rewritten request instead.
- Windows laptop: nothing was run on Windows.
- Refresh tokens / silent renewal: not used; an expired access token (5 min) sends the user back through SSO.

## Known behaviour worth knowing
- The effective window is 60 s plus the 5 s skew leeway, so the action can still pass at about 62 s.
- Keycloak rejects a TOTP code that was already used (replay protection), so two step-ups within the same 30 s need a fresh code.
- The other apps notice a sign-out elsewhere only when they next load or call the API (no back/front-channel logout, by decision).
