# ADR-0007: SPA tokens in memory (BFF left out)

Status: accepted

## Context
SPAs that hold tokens are exposed to XSS. A backend-for-frontend (BFF) keeps tokens on a server and gives the SPA only a cookie.

## Decision
For this PoC the React and Angular apps hold tokens in JavaScript memory only (nothing in localStorage; run: storage keys empty after login for React). The MVC app shows the server-held pattern.

## Why
A BFF adds a server per SPA and obscures the OIDC flow the audience should see. The step-up enforcement does not depend on this choice because the API is the judge (ADR-0006).

## Consequences
An XSS bug can still use the token while the page is open. A production system should prefer a BFF. Documented as a known limitation.
