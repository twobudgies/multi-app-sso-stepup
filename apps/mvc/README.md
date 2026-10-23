# apps/mvc: Back Office

- What: Acme Bank Back Office (ASP.NET Core MVC, server-rendered). Limits, approvals, users. "Change limit" and "Approve transfer" need step-up.
- Auth: confidential client, Authorization Code + PKCE, state/nonce verified by the OIDC handler. Tokens stay on the server (in-memory ticket store); the browser only has an HttpOnly, SameSite=Lax cookie. Dev exception: cookie is not `Secure` on http://localhost (Always in non-Development).
- Run: from the repo root `npm run dev:mvc` (needs `npm run up` and `npm run dev:api`).
- Port: 5200 (`MVC_PORT`). Open http://localhost:5200. Login: `alice` / `alice-dev-only`.
- Step-up: the pending action is kept in the server session, the return URL is checked with `Url.IsLocalUrl`, and the API re-checks `acr`/`auth_time` on the retry.
