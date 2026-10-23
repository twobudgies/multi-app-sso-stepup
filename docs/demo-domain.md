# Demo domain: Acme Bank

A fictional bank (no real brand, fake data). The three apps are parts of one bank so the demo tells one story: **log in once, move between the parts, and pay the price of extra proof only for risky actions.**

| App | Port | Role | Sensitive action(s) |
|-----|------|------|---------------------|
| React | 5300 | **Customer Portal**: accounts, balances, profile | Change e-mail address |
| Angular | 5400 | **Payments and Transfers**: send money, add payee | Add payee; send money **over 1000** (small transfers need no step-up) |
| MVC | 5200 | **Back Office / Admin**: limits, approvals | Change transfer limit; approve a pending transfer |

User: `alice` / `alice-dev-only`; TOTP seed in [idp-keycloak.md](idp-keycloak.md).

## Shared look
`packages/ui-tokens/acme.css`: same palette, header and nav bar (links across all three apps, current app highlighted), big text for a projector.

## Session panel (on every page)
Shows: app, user, assurance level badge (`LoA1` password / `LoA2` password + TOTP, read from `acr`), time of last authentication (`auth_time`), and a **countdown** of the 60 s step-up window (bar turns amber in the last 15 s and empties at zero). Values come from the API's `/me` (which reads the validated access token), not from client flags. Time uses the API's clock offset to avoid laptop clock drift.

## Step-up modal
When the API answers `401 insufficient_user_authentication`, each app shows a modal that says why (this action needs password + authenticator code, done within 60 s), then sends the user to the IdP. After returning, the action is retried once automatically; on failure a clear message is shown.

## Demo story (about 12 min)
1. Open Customer Portal, sign in (password). Panel shows LoA1.
2. Click "Payments" in the nav: no login prompt (SSO).
3. Send 50: works. Send 5000: modal, authenticator code, then it goes through; panel shows LoA2 and the countdown.
4. Within 60 s open Back Office and approve a transfer: no prompt (shared window).
5. Wait for the countdown to hit zero, approve again: step-up again.
6. Sign out in one app: the IdP session ends, the others ask to sign in on next load.
