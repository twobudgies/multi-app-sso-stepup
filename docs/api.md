# Shared API (Acme Bank)

`api/` is an ASP.NET Core (.NET 10) minimal API on port 5100. It is the **only** place step-up is enforced.

Run: `npm run dev:api` (= `dotnet run --project api`).

## Endpoints
| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /health` | none | liveness, active profile |
| `GET /me` | token | user, level (`LoA1`/`LoA2`), `authTime`, `exp`, step-up window, server time |
| `GET /policy` | token | the step-up rules (title, level, max age) |
| `GET /accounts`, `/payees`, `/limits`, `/transfers` | token | fake bank data (in memory, resets on restart) |
| `POST /sensitive/{action}` | token + policy | `change-email`, `add-payee`, `transfer`, `change-limit`, `approve-transfer` |

## Token validation
Signature (RS256 via the IdP's JWKS, cached, refreshed when an unknown `kid` appears), `iss`, `aud=stepup-api`, `exp` (5 s leeway). Claim names are not remapped.

## Policy (`api/policy.json`)
One file, read by the API only. Each action has a required level and `maxAgeSeconds` (`"default"` = `STEPUP_MAX_AGE_SECONDS`, 60). `transfer` only needs step-up above `onlyAboveAmount` (1000). The API refuses to start if a policy has a max age but the IdP profile cannot provide an authentication time.

## Step-up challenge
Too weak or too old: `401` with
`WWW-Authenticate: Bearer error="insufficient_user_authentication", acr_values="2", max_age="60"` and a JSON body (`code` = `level_too_low`, `auth_too_old`, `auth_time_missing`). The action is NOT performed.

## Verified by running (2026-10-23)
Against live Keycloak with tokens from `tools/login-probe.mjs`: no token and bad token give 401; LoA1 token on `change-email` gives 401 + challenge; small transfer allowed at LoA1; transfer of 5000 gives 401; fresh LoA2 token allowed; the same LoA2 token after 66 s gives 401 `auth_too_old`.
