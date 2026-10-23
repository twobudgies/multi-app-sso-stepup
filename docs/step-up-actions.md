# Step-up actions and flow

> Status: design (not yet implemented). The action list and times below are a **proposal for owner confirmation** (task P3-1 turns them into the config file the API reads).

## Concept

Being logged in (SSO) proves *who* you are. Some actions need proof that it is really you *right now*. Those require **LoA2** (password + TOTP) **and** a recent authentication (`auth_time` within the allowed age).

| Level | `acr` (Keycloak) | Meaning |
|-------|------------------|---------|
| LoA1 | `1` | password only |
| LoA2 | `2` | password + TOTP |

## Which actions need step-up (proposed)

| App | Action | API endpoint | Required level | Max age of MFA |
|-----|--------|--------------|----------------|----------------|
| all | View home, profile, list items | `GET /me`, `GET /items` | LoA1 | none |
| React | **Change email address** | `POST /sensitive/change-email` | LoA2 | 5 min |
| Angular | **Approve a transfer** | `POST /sensitive/approve-transfer` | LoA2 | 2 min |
| MVC | **Rotate API key** | `POST /sensitive/rotate-api-key` | LoA2 | 5 min |

Different windows are deliberate, so the shared-window behavior is easy to see (example below). The policy lives in one config file on the API side, never in client code.

## Why the API decides, not the app

Anything in a browser can be edited. If the React app said "user did MFA, proceed", an attacker could change that in dev tools. So:

- The client just calls the API with its access token.
- The API reads `acr` and `auth_time` from the **signed** token and compares them with the action's policy.
- Not enough? The API does **not** perform the action. It replies with a challenge.

## The challenge (RFC 9470)

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer error="insufficient_user_authentication",
  error_description="A different authentication level is required",
  acr_values="2", max_age="120"
```

## Step-up flow

```mermaid
sequenceDiagram
  actor U as User
  participant App as Client app (React / Angular / MVC)
  participant API as Shared API
  participant KC as Keycloak

  U->>App: click "Approve transfer"
  App->>API: POST /sensitive/approve-transfer (Bearer token, LoA1)
  API->>API: acr=1 < 2 required
  API-->>App: 401 insufficient_user_authentication, acr_values=2, max_age=120
  Note over App: save the pending action + return URL<br/>(MVC: server session; SPA: memory keyed by state)
  App->>KC: redirect /authorize (acr_values=2, max_age=120, PKCE, new state+nonce)
  KC->>U: ask for TOTP (password skipped if still fresh)
  U->>KC: enter TOTP
  KC-->>App: redirect back with ?code=...
  App->>KC: POST /token (code + verifier)
  KC-->>App: new tokens (acr=2, auth_time=now)
  App->>App: validate ID token (sig, iss, aud, nonce, acr, auth_time)
  App->>API: retry original request with new access token
  API->>API: acr=2 OK, auth_time within 120 s OK
  API-->>App: 200 action performed
```

Safety details:
- The pending action and return URL are kept **server-side or in memory**, never in the URL query string, and the return URL is checked against an allow-list (no open redirect).
- After MFA the app does not assume Keycloak honored the request. The **API re-checks** `acr` and `auth_time` on the retry. If the token still is LoA1 (IdP ignored `acr_values`), the API challenges again and the app shows an error after one retry rather than looping.

## Shared freshness window (owner decision)

All apps share one IdP session and the API judges `auth_time`, so MFA in one app counts for the others, **per action window**.

Example timeline:

| Time | Event | Result |
|------|-------|--------|
| 10:00:00 | User logs in on React (password) | LoA1, `auth_time` 10:00:00 |
| 10:00:30 | Clicks **Change email** (React) | API challenges, user enters TOTP at 10:00:50 |
| 10:01:30 | Opens Angular, clicks **Approve transfer** (window 2 min) | MFA is 40 s old, **allowed, no prompt** (SSO + shared window) |
| 10:03:30 | Clicks **Approve transfer** again | MFA is 2 min 40 s old, over 2 min, **step-up again** |
| 10:03:30 | Same moment, **Rotate API key** on MVC (window 5 min) | 2 min 40 s old, within 5 min, **allowed** |

## Failure cases to handle

| Case | Expected behavior |
|------|-------------------|
| User cancels MFA | IdP returns `error=access_denied` (or user closes the page). App returns to the pending page with "Step-up cancelled", action NOT performed |
| IdP ignores `acr_values` | New token still LoA1. API challenges again, app stops after one retry with an error |
| Token `acr` lower than requested | Same as above: API is the judge |
| Clock skew between API and IdP | API allows a small leeway (proposed 30 s) on `exp`; `auth_time` window checked with the same leeway |
| Refresh instead of step-up | Refresh keeps the old `auth_time`, so it can never satisfy a stale policy (see [token-lifecycle.md](token-lifecycle.md)) |
