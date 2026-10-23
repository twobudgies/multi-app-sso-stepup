# ADR-0003: SPA step-up state travels in the OIDC `state` (sessionStorage via the library)

Status: accepted

## Context
`docs/step-up-actions.md` said pending actions are kept "in memory keyed by state". The step-up redirect reloads the SPA, so memory is lost.

## Decision
The OIDC library stores the request `state` object in `sessionStorage` until the callback. We put only non-sensitive data in it: action id, form values and an internal return path. Never tokens. After the callback: the return path is re-validated against an allow-list (internal paths only), the stored entry is consumed by the library, and the action id is checked against a known list. The stored action is never trusted for authorization: the API re-checks `acr` and `auth_time` on the retry. Access tokens stay in memory only.

## Consequences
Works across the redirect. sessionStorage is readable by XSS, which is why nothing sensitive is stored there.
