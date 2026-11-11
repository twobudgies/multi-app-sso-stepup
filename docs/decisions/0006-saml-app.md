# ADR-0006: A fourth app that uses SAML 2.0

Status: accepted (owner request, 2026-11-02)

## Context
The PoC was OIDC only. The owner wants to see what changes for a SAML app, including step-up.

## Decision
- Add `apps/saml` (ASP.NET Core MVC) using the `ITfoxtec.Identity.Saml2.MvcCore` library, same Keycloak realm.
- SAML gives no access token, so the shared API cannot be used. The app enforces step-up itself, server-side, from the verified assertion.
- Keycloak 26.0 ignored `RequestedAuthnContext` in our run, so step-up uses a second SAML client (`urn:acme:treasury:stepup`) bound to an always-password+TOTP flow, which adds a signed `loa=2` attribute. `ForceAuthn` is always sent on step-up.

## Consequences
- Works and is verified against Keycloak (see `docs/saml-vs-oidc.md`).
- The step-up window is not shared between SAML and OIDC apps.
- Another IdP that honours `RequestedAuthnContext` would not need the second client.
