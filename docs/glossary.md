# Glossary (plain language)

New terms are added here as the project introduces them.

| Term | Meaning | Example here |
|------|---------|--------------|
| **IdP** (identity provider) | The service that checks who you are (password, MFA) | Keycloak |
| **SSO** (single sign-on) | Log in once, and several apps accept you | Log in to React, open Angular, no prompt |
| **OIDC** (OpenID Connect) | The standard "language" apps use to ask an IdP to log someone in | Used by all three apps |
| **Token** | A signed digital note the IdP hands the app, proving something about you | ID token, access token |
| **ID token** | Says who logged in and how | Read by the app only |
| **Access token** | A short-lived pass the app shows the API | Valid about 5 min |
| **Refresh token** | A longer-lived ticket to get a new access token without logging in again | Rotated on every use |
| **PKCE** | A trick that stops a stolen login code from being used by someone else | Required for all apps |
| **MFA** | A second proof beyond the password | TOTP code |
| **TOTP** | A 6-digit code from an authenticator app that changes every 30 s | Our second factor |
| **WebAuthn / passkey** | Approve login with fingerprint, face or a hardware key; cannot be phished | Not used now, possible later |
| **Step-up** | Asking for extra proof (MFA) only when the user does something risky | Approving a transfer |
| **`acr`** | Token field saying how strong the login was | `1` = password, `2` = password + MFA |
| **`auth_time`** | Token field saying when the user last really logged in | Used to check MFA is recent |
| **JWKS** | The IdP's public keys, used to check token signatures | Cached by the API |
| **Public client** | An app that cannot keep a secret (runs in the browser) | React, Angular |
| **Confidential client** | An app with a server that can keep a secret | MVC |
| **Adapter / profile** | A small file that tells our code how a particular IdP behaves | `idp/profiles/keycloak.json` |
