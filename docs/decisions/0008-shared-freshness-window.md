# ADR-0008: One shared step-up window for all apps

Status: accepted

## Decision (owner decision #3, #9)
Because all apps share one IdP session and the API judges `auth_time`, a successful MFA in any app counts for all actions in all apps for `STEPUP_MAX_AGE_SECONDS` (default 60 s). Each action may have its own value in `api/policy.json`.

## Consequences
Smooth demo (MFA once, then Payments and Back Office need no prompt, run) but a weaker model than per-action MFA. A 5 s clock-skew leeway makes the effective window up to 65 s. Refresh tokens keep the old `auth_time` (verified in Keycloak), so they cannot extend the window.
