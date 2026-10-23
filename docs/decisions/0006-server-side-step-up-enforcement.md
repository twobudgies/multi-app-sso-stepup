# ADR-0006: Step-up is enforced in the API from signed token claims

Status: accepted

## Context
A browser app can be edited by its user, so anything it decides ("the user did MFA") is bypassable.

## Decision
The shared ASP.NET Core API is the only judge. It validates the token (signature, issuer, audience, expiry) and evaluates `acr` and `auth_time` against `api/policy.json` through the IdP profile evaluator. If not enough it answers `401` with an RFC 9470 `insufficient_user_authentication` challenge (`acr_values`, `max_age`) and does not perform the action. Clients only react to the challenge and re-check the returned level so they can show a clear error; the API re-checks on retry.

## Consequences
Tamper-proof against client changes (run: LoA1 and stale tokens rejected by the API). Costs one extra round trip and requires the API to be the single entry point for sensitive actions. The policy is data, not code.
