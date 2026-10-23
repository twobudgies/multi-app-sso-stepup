# Token lifecycle and refresh

> Status: design (not yet implemented). Lifetimes below are Keycloak-style defaults and **will be set explicitly in the realm JSON** in Phase 1.

## The three tokens

| Token | Who reads it | Lifetime (proposed) | Purpose |
|-------|--------------|---------------------|---------|
| **ID token** | the client app | short, used once at login | Proves who logged in and *how* (`acr`, `auth_time`, `nonce`). Never sent to the API |
| **Access token** | the API | **5 min** | Sent as `Authorization: Bearer ...`. Carries `acr`, `auth_time`, `aud=api` |
| **Refresh token** | the IdP token endpoint only | up to the IdP session limits (idle 30 min, max 10 h) | Gets a new access token without asking the user to log in again |

Access tokens are short on purpose: if one leaks, it dies in minutes.

## Where each app keeps tokens

| App | Stores tokens in | Why |
|-----|------------------|-----|
| React | JavaScript **memory** only (not localStorage/sessionStorage) | An XSS bug can still use them while the page is open, but nothing is left on disk |
| Angular | JavaScript **memory** only | same |
| MVC | **server-side session**; the browser only holds an `HttpOnly`, `Secure`, `SameSite=Lax` session cookie | Tokens never reach the browser |

Trade-off: SPAs holding tokens is weaker than a backend-for-frontend (server keeps tokens). Chosen for PoC simplicity; recorded as an ADR in Phase 6.

## How refresh works

### React and Angular (public clients)

1. During the app's life, a timer fires about 60 s before the access token expires.
2. The library POSTs `grant_type=refresh_token` to the `token_endpoint` (no client secret; it is a public client).
3. Keycloak returns a new access token **and a new refresh token**. The old refresh token is now invalid (**refresh token rotation**; enabled in the realm via "Revoke Refresh Token"). Rotation limits the damage of a stolen refresh token: reuse of an old one revokes the session.
4. The library swaps both in memory. API calls keep using the current access token.

Libraries (proposed): React `oidc-client-ts` (`automaticSilentRenew` with refresh tokens), Angular `angular-oauth2-oidc` (`setupAutomaticSilentRefresh`, code flow with refresh token). Both must be configured to use the refresh token, **not** a hidden-iframe `prompt=none` renew, which breaks under modern browser third-party-cookie rules.

**Page reload:** memory is wiped, so the tokens are gone. The app starts a fresh authorization request with `prompt=none`; if the Keycloak session cookie is still valid, it returns a code immediately and the user sees nothing. This is the same mechanism that gives SSO.

### MVC (confidential client)

1. Tokens (including the refresh token) sit in the server-side session, keyed by the session cookie.
2. Before each call to the API, server code checks the access token expiry. If it expires within about 60 s, it refreshes first: server-to-server POST to `token_endpoint` with `grant_type=refresh_token` + client secret.
3. New tokens replace the old ones in the session (rotation applies here too).
4. Refresh is guarded by a lock per session so two parallel requests do not both use the same refresh token (the second would trip reuse detection and kill the session).

### When refresh fails

Refresh fails if the IdP session is over (idle timeout, max lifetime, logout elsewhere, refresh token revoked). The app then treats the user as logged out and starts a normal login. No error loops: one failed refresh equals one redirect to login.

### Two tabs of an SPA

Each tab has its own memory and so its own refresh token. With rotation, the tabs do not share one token, so they do not race each other. (If we ever share tokens across tabs via storage, we must add a cross-tab lock.)

## Refresh does NOT satisfy step-up

Important and easy to get wrong:

- A refreshed access token keeps the **original** `auth_time` and `acr` of the login that created the session (to be confirmed in Keycloak during Phase 1/3; the API relies on claims, not on this assumption being true, so it stays safe either way).
- So after 1 minute, refreshing gives a *fresh token* but the *same old MFA time*. The API reads `auth_time`, sees it is stale, and demands step-up.
- The only way to get a new `auth_time` or a higher `acr` is a **new authorization request** that goes through Keycloak's login/MFA screens. See [step-up-actions.md](step-up-actions.md).

```mermaid
timeline
  title Example: access token 5 min, step-up window 1 min
  00:00 : Login with password (LoA1) : auth_time = 00:00
  00:04 : Silent refresh : new access token, auth_time still 00:00
  00:06 : User clicks sensitive action : API sees LoA1, challenges
  00:06 : MFA done at IdP : new tokens, auth_time = 00:06, LoA2
  00:06 + 30 s : Another sensitive action : 30 s old, inside window, allowed
  00:09 : Silent refresh : auth_time still 00:06, LoA2 kept
  00:10 : Another sensitive action : 4 min old, over 1 min, step-up again
```
