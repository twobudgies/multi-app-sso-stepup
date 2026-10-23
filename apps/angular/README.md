# apps/angular: Payments and Transfers

- What: Acme Bank Payments and Transfers (Angular SPA). Send money (over 1000 needs step-up) and add payee (needs step-up).
- Auth: Authorization Code + PKCE via `angular-oauth2-oidc`; tokens in memory only (only the PKCE verifier/nonce survive the redirect in sessionStorage).
- Run: from the repo root `npm run dev:angular` (needs `npm run up` and `npm run dev:api`). The script first writes `src/app/env.generated.ts` from `.env`.
- Port: 5400 (`ANGULAR_PORT` in `.env.example`; the npm script currently fixes 5400, which must match the Keycloak redirect URI). Login: `alice` / `alice-dev-only`.
