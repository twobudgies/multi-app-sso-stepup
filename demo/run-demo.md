# Live demo script (about 12 minutes)

Story: **Acme Bank**. One login, three apps, and extra proof only for risky actions. Fake data only.

> Status: written and rehearsed on macOS with a headless browser (`tools/e2e`). **Not run on Windows.** Backup screenshots of every step are in `demo/screenshots/`.

## Read this first: three facts that surprise people
1. **The window is 60 s, effectively up to 65 s.** There is a 5 s clock-skew leeway. If you act at second 63 it can still pass. Say "about a minute".
2. **TOTP codes cannot be reused.** Keycloak rejects a code it already accepted, so after one step-up **wait for the next code (up to 30 s)** before the next one. Keep the authenticator app visible and wait for the ring to refresh.
3. **Clocks must be in sync.** Laptop and phone on automatic time, or valid codes are rejected (`docs/windows-setup.md`).

## Before you start (T minus 15 min) checklist
- [ ] Docker Desktop running; `npm run install:all` done once; ports 8180, 5100, 5200, 5300, 5400 free.
- [ ] `npm run reset` (clean Keycloak), wait about 30 s.
- [ ] Five terminals: `npm run dev:api`, `dev:react`, `dev:angular`, `dev:mvc` (the fifth is spare).
- [ ] Open http://localhost:5300 in a **fresh private/incognito window** (no old Keycloak session). Zoom the browser to 125 percent for the projector.
- [ ] Phone authenticator has the demo secret (`GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ`, from `docs/idp-keycloak.md`); the 6-digit code changes every 30 s.
- [ ] Phone clock and laptop clock automatic. Backup screenshots open in another window.
- [ ] Restart `npm run dev:api` right before the demo: it resets the fake bank data (pending transfers T-1001 and T-1002 come back).

## The demo
| # | Do | Say | Expect | Backup |
|---|----|-----|--------|--------|
| 1 | Open Customer Portal, sign in `alice` / `alice-dev-only` | "I type my password once, on the bank's secure login page, not in the app." | Portal, panel shows **LoA1 password**, "no step-up active" | 01, 02 |
| 2 | Profile, change the e-mail, Save | "Changing contact details is risky, so being logged in is not enough." | Popup "Extra verification needed" | 03 |
| 3 | Verify, enter the 6-digit code | "Now the bank knows it is really me." | Back in portal, "done", **LoA2**, countdown 1:00 | 04, 05 |
| 4 | Click **Payments and Transfers** in the nav | "No login screen: that is single sign-on." | Payments opens signed in, LoA2, countdown running | 06 |
| 5 | Send 2500 (inside the minute) | "Still inside the minute, so no second prompt, even though this is a different app." | "Send money: done." | 07 |
| 6 | Click **Back Office**, Approve a transfer | "Third app, same story." | Approved, no prompt | 08, 09 |
| 7 | **Wait until the countdown reaches 0** (talk about tokens while you wait) | "The proof expires. That is a setting, not code." | Bar empty, "expired: next sensitive action asks again" | 10 |
| 8 | Back in Payments send 2500 again | "Same action, now it asks again." | Popup again. Click **Not now** | 11, 12 |
| 9 | (Optional) Show the API refusing: `npm run probe -- --token` then `curl` (see below) | "Even if someone edits the web page, the API decides." | 401 with the challenge | n/a |
| 10 | Sign out in the portal, reload Payments | "Signing out ends the shared session." | Keycloak login page | 13, 14 |

Optional tamper demo (step 9), in a terminal:
```text
set T=<token printed by npm run probe -- --token>      (PowerShell: $T="...")
curl -i -X POST -H "Authorization: Bearer %T%" -H "Content-Type: application/json" -d "{\"email\":\"x@y.test\"}" http://localhost:5100/sensitive/change-email
```
Expect `401` and `WWW-Authenticate: Bearer error="insufficient_user_authentication", acr_values="2", max_age="60"`.

## If something goes wrong
| Symptom | Fix |
|---------|-----|
| TOTP code rejected | Wait for the next code (replay protection), check clocks. Keep going with screenshots 04 and 05 if needed |
| Login loops or stale session | Use a new private window, or `npm run reset` and re-open |
| A port is busy | Change it in `.env`, but the Keycloak realm redirect URIs expect the defaults: easier to stop the other program |
| Popup never appears | The window was still open: wait for 0:00 plus 5 s |
| Nothing works | Switch to `demo/screenshots/` (numbered 01 to 14) and narrate |

## Reset between runs
`npm run reset` (wipes Keycloak and starts it again), then restart `npm run dev:api` (resets bank data). Close and reopen the private window.

## Time plan inside the demo
Steps 1 to 3: 3 min; 4 to 6: 3 min; 7 to 8: 3 min (the wait is useful talking time); 9 to 10: 3 min.
