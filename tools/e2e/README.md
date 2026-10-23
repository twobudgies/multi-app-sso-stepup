# tools/e2e: manual end-to-end run (not a test suite)

A script that drives a real headless browser through the whole demo (SSO, step-up, shared window, expiry, cancel, sign-out) and prints PASS/FAIL per check. It exists to record evidence for `docs/manual-checks.md` and to capture screenshots; the project has no automated test suites by decision (BRIEF #6).

Prerequisites: everything running (`npm run up`, `npm run dev:api`, `npm run dev:react`, `npm run dev:angular`, `npm run dev:mvc`).
Run: `cd tools/e2e && npm install && npm run setup && npm run run` (takes about 90 s: it waits for the 60 s window to expire). Screenshots go to `tools/e2e/out/` (git-ignored).
Note: Keycloak rejects reusing a TOTP code within 30 s, so wait half a minute between runs. The script computes TOTP codes from the public fake demo seed.

`negative.mjs` simulates a misbehaving IdP (error on return, IdP ignoring `acr_values`) by rewriting the browser's authorize request. It needs a fresh API (`npm run dev:api` restarted) so a pending transfer exists. Same TOTP note applies.

`gif.mjs` (`npm run gif`) records the README animation `docs/img/how-it-works.gif` (login, step-up, SSO, timer, expiry, step-up again, with captions). It samples the countdown about every 8 s, so the timer segment is sped up. Takes about 2 minutes; `GIF_FRAMES=dir` also saves each frame as a PNG. Same TOTP note applies.
