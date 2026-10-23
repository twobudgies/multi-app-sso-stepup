# Rehearsal guide (one page)

## Timing (45 min)
| Part | Slides | Minutes | Running total |
|------|--------|---------|---------------|
| Problem and SSO basics | 1-5 | 8 | 8 |
| Architecture, tokens, step-up concepts | 6-11 | 13 | 21 |
| Live demo | 12-14 | 12 | 33 |
| IdP flexibility | 15 | 5 | 38 |
| Security, verified vs reviewed, next steps | 16-18 | 5 | 43 |
| Questions | 19 | 2 plus buffer | 45 |

If you run late, shorten slides 7 and 11 and skip demo step 9 (tamper). If you run early, show `docs/review-checklist.md`.

## Demo safety (read before every run)
- **Effective window is 65 s**: 60 s plus a 5 s clock leeway. Say "about a minute".
- **TOTP codes cannot be reused**: after one step-up wait for the next code (up to 30 s). Show the phone ring refreshing.
- Reset before each rehearsal: `npm run reset`, restart `npm run dev:api` (resets bank data), new private window.
- Clocks of laptop and phone on automatic. Backup screenshots in `demo/screenshots/` (01 to 14).
- Full script and failure table: `demo/run-demo.md`. Not run on Windows: rehearse on the demo laptop.

## The ten questions you will most likely get
1. **Why not require MFA on every login?** It annoys people; step-up asks only for risky actions, and the level and time are checked where it counts.
2. **Where is the rule enforced?** In the shared API, from the signed token (level `acr`, login time `auth_time`). The apps cannot bypass it.
3. **What if someone edits the web page?** Nothing changes: the API decides. We ran a password-only token and an old token against it; both were refused.
4. **Does it work with our Entra / Okta?** Templates exist, built from the providers' documentation, never tested on a real tenant. Entra has no documented login-time claim, so the API refuses a time-limited policy with it.
5. **Why is the window 60 seconds?** So expiry is visible in a demo. It is a setting (`STEPUP_MAX_AGE_SECONDS`), per action if needed. Effectively up to 65 s because of a 5 s clock leeway.
6. **Are tokens safe in the browser?** React and Angular keep them in memory only, which is weaker than a backend-for-frontend (production pattern). The MVC app keeps tokens on the server.
7. **What does a refresh do?** Nothing for step-up: it keeps the old login time. The apps do not use refresh tokens in this PoC.
8. **What about logout everywhere?** Signing out ends the shared session; other open tabs notice at their next load or call. Back/front-channel logout is out of scope.
9. **What was actually tested?** Keycloak only, on macOS: 13 end-to-end checks and 7 negative-path checks passed, plus 9 evaluator cases. Windows and other IdPs: not run. Evidence in `docs/manual-checks.md`.
10. **Could a user dodge it with many small transfers?** Yes: transfers up to 1000 need no step-up and there are no cumulative limits. A known weakness, listed in `docs/review-checklist.md`.
