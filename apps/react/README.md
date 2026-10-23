# apps/react: Customer Portal

- What: Acme Bank Customer Portal (React + Vite SPA). Accounts, balances, profile; "Change e-mail" needs step-up.
- Auth: Authorization Code + PKCE via `oidc-client-ts`, tokens in memory only.
- Run: from the repo root `npm install` then `npm run dev:react` (needs `npm run up` and `npm run dev:api` running).
- Port: 5300 (`REACT_PORT`). Open http://localhost:5300. Login: `alice` / `alice-dev-only`.
- Docs: `docs/demo-domain.md`, `docs/architecture.md`.
