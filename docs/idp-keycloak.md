# Keycloak setup (the tested IdP)

Start: `docker compose up -d` (or `npm run up` from the repo root). Wait about 30 s, then open http://localhost:8180 (admin login from `.env`). The realm `stepup` is imported from `idp/keycloak/realm.json` with no manual clicks. Reset to a clean state: `docker compose down -v` then `up`.

## What is in the realm
| Item | Value |
|------|-------|
| Test user | `alice` / `alice-dev-only` (fake, dev only) |
| TOTP | Pre-seeded so no enrolment is needed. Raw secret `12345678901234567890` (the RFC 6238 test seed), Base32 for an authenticator app: `GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ`, 6 digits, 30 s, SHA-1 |
| Clients | `app-react`, `app-angular` (public, PKCE S256); `app-mvc` (confidential, secret from `APP_MVC_CLIENT_SECRET`) |
| Redirect URIs | `http://localhost:5300/*`, `:5400/*`, `:5200/*` |
| API audience | scope `api-audience` adds `aud=stepup-api` to access tokens |
| Access token life | 300 s |

## Levels of assurance (LoA)
Browser flow `browser-stepup`: LoA1 = username + password, LoA2 = LoA1 + TOTP (conditional sub-flows using "Condition - Level of Authentication"). Realm attribute `acr.loa.map` maps `acr` value `1` to level 1 and `2` to level 2. A request with `acr_values=2` makes Keycloak ask for TOTP.

## Mappers (what ends up in tokens)
| Claim | Mapper | In ID token | In access token |
|-------|--------|-------------|-----------------|
| `acr` | scope `acr`, mapper "acr loa level" | yes | yes |
| `auth_time` | scope `auth-time`, user-session-note mapper on `AUTH_TIME` | yes | yes |
| `aud` | scope `api-audience`, audience mapper | no | yes |
| `amr` | not emitted by Keycloak. **Decision: the apps rely on `acr` only** | no | no |

## Verified by running (2026-10-23, Keycloak 26.0)
`node tools/login-probe.mjs` logs in headlessly (also with `--acr 2 --max-age 60 --cookies file`): access token carries `acr`, `auth_time` and `aud=stepup-api`; a step-up request returns `acr=2` with a new `auth_time`; a second request with the same cookies gets no prompt (SSO).

## Weaknesses
Dev mode, plain HTTP, H2 database. The TOTP seed is public in this repo, so never use this realm anywhere real.
