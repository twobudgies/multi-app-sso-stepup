# ADR-0005: Authorization Code flow with PKCE for every client

Status: accepted

## Context
Three clients (two public SPAs, one server-rendered app) sign users in through an external IdP.

## Decision
Authorization Code flow with PKCE (S256) everywhere; no implicit flow. The MVC app is a confidential client (secret + PKCE); the SPAs are public clients. `state` and `nonce` are always sent and checked (by `oidc-client-ts`, `angular-oauth2-oidc` and the ASP.NET OIDC handler). Keycloak clients carry `pkce.code.challenge.method=S256`.

## Why
Tokens never travel in the URL, a stolen code is useless without the verifier, and it is what current OAuth guidance (OAuth 2.0 Security BCP, OAuth 2.1) recommends for browser apps.

## Consequences
Needs one redirect round trip per login (this is also what makes SSO work). Keycloak still advertises the `plain` method; we do not use it.
