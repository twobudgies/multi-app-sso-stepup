# Security review checklist

Self-review of the security-critical code paths (2026-10-23, commit of this PR). Pointers are file:line at the time of writing. "Run" means executed against live Keycloak; "Read" means only code review. Nothing here is a penetration test.

| # | Control | Where | Manual check | Status |
|---|---------|-------|--------------|--------|
| 1 | API validates signature (RS256 only, JWKS from discovery, cached and refreshed on unknown `kid`), issuer, audience, expiry | `api/Program.cs:27-36` | `curl` with no token and with a token with one character changed: both 401 | Run (401 in both). Wrong-audience and expired tokens: Read only |
| 2 | Claim names are not remapped (`acr`, `auth_time` read as issued) | `api/Program.cs:30` | Call `/me` | Run |
| 3 | Step-up decision is server-side from signed claims (level + age) | `api/Program.cs:82-92`, `packages/dotnet/IdpProfile/IdpProfile.cs:108-123` | LoA1 token on `change-email` gives 401 and the action is not performed; fresh LoA2 gives 200; the same LoA2 token after 66 s gives 401 `auth_too_old` | Run |
| 4 | Skew and edge cases of the evaluator | `IdpProfile.cs:108-123` | `npm run check:evaluator` | Run (9 cases: exact limit, +5 s leeway, 66 s denied, IdP clock 6 s ahead denied, LoA1, no `auth_time`, unknown `acr`) |
| 5 | Policy cannot silently skip age check (refuse to start if profile has no `auth_time`) | `IdpProfile.cs:84-90`, `api/Program.cs:23` | Set a profile with `emitsAuthTime=false` and start the API | Read only |
| 6 | PKCE + state + nonce on all clients | React `apps/react/src/auth.ts` (library defaults, S256), Angular `apps/angular/src/app/auth.service.ts:30-36`, MVC `apps/mvc/Program.cs:50` (handler verifies state/nonce) | Inspect the authorize URL: `code_challenge_method=S256`, `state`, `nonce` present | Run (flows work end to end, URL inspected in Keycloak requests); not tampered with |
| 7 | Tokens not in browser storage | React `auth.ts:13` (in memory), Angular `auth.service.ts:7-14` (memory + only PKCE/nonce in sessionStorage); MVC tokens in server ticket store `apps/mvc/Program.cs` `MemoryTicketStore` | After login: `localStorage`/`sessionStorage` contain no token | Run for React (storage keys empty, no token string); Angular and MVC Read only |
| 8 | MVC cookie flags | `apps/mvc/Program.cs:36-40` | Browser cookies after login | Run: `bo.auth` HttpOnly, SameSite=Lax, Secure (the app runs in Production mode; browsers accept Secure cookies on http://localhost). The Development exception (not Secure) is Read only |
| 9 | Return URL allow-list (no open redirect) | `packages/idp-profile/index.ts:50`, MVC `StepUpController.cs:37,66` | Read: only internal paths pass | Read only |
| 10 | Pending action is never trusted for authorization | React `App.tsx:9,28`, Angular `auth.service.ts:16`, MVC session `StepUpController.cs` | The API re-checks on retry (check 3) | Read; API side Run |
| 11 | Client checks the level of the new token and does not continue if the IdP ignored `acr_values` | React `App.tsx` (`levelFromClaims`), Angular `app.ts:146`, MVC `StepUpController.cs:41` | `tools/e2e/negative.mjs` B: authorize request rewritten to drop `acr_values`/`max_age` | Run for React and MVC (action NOT performed, message shown). Angular: same code pattern, Read only |
| 12 | IdP error on return (cancel, `login_required`) does not loop and does not perform the action | React `App.tsx`, Angular `app.ts:134`, MVC `OnRemoteFailure` in `Program.cs` + `StepUp/Failed.cshtml` | `tools/e2e/negative.mjs` A | Run for all three. Found and fixed a real redirect loop in Angular during this review (error was read after the library cleaned the URL) |
| 13 | Client tampering has no effect | Any client flag (the session panel, `level`) is display only | Edit the page state in dev tools, retry an action: the API decides | Run for the API side (check 3); UI tampering Read only |
| 14 | No secrets in the repo | `.gitleaks.toml`, CI | `gitleaks detect` | Run (clean) |

## Known weaknesses (honest list)
- **Window is effectively 65 s**: 60 s plus the 5 s skew leeway.
- **Structuring**: transfers up to 1000 need no step-up, so many small transfers avoid it. A real bank would need cumulative limits.
- **No `azp`/client binding**: the API accepts any client's token for audience `stepup-api`.
- **No refresh tokens**: after the 5-minute access token expires, the SPAs reload through SSO (fine for a demo).
- **IdP clock ahead of the API by more than 5 s** is denied (`auth_time_in_future`): safe but may annoy on badly synced machines.
- **No back/front-channel logout** (owner decision): other open tabs keep working until the access token expires or the page reloads.
- Tokens in browser JS are weaker than a BFF pattern (see ADR-0003 and the BRIEF).
- In-memory API data and in-memory MVC session store: restart resets them.
- Dev setup: plain HTTP, Keycloak dev mode, public fake TOTP seed.

## Not run
IdP-side cancel (Keycloak's OTP page has no cancel button; the error-return path was run instead), real clock skew between machines (evaluator run with synthetic claims instead), Windows.
