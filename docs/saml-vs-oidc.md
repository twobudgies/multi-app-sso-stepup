# SAML app (Treasury) vs the OIDC apps: what changes

`apps/saml` is the fourth app. It is an ASP.NET Core MVC app like `apps/mvc`, but it signs users in with **SAML 2.0** instead of OpenID Connect. It uses the same Keycloak realm, so the same user (`alice`) and the same login page.

## 1. Same idea, different words

| Idea | OIDC apps | SAML app |
|---|---|---|
| The login server | IdP (issuer URL) | IdP (metadata URL) |
| Your app | client (`app-mvc`) | service provider, "SP" (entityID `urn:acme:treasury`) |
| Ask the user to log in | authorization request (redirect) | `AuthnRequest` (redirect) |
| The proof you get back | ID token and access token (JWT) | **assertion** inside a `SAMLResponse` (signed XML, posted to the ACS URL) |
| Who is the user | `sub` | `NameID` |
| How strongly did they log in | `acr` | `AuthnContextClassRef` |
| When did they log in | `auth_time` | `AuthnInstant` |
| How the proof is checked | JWT signature (JWKS) plus `iss`, `aud`, `exp` | XML signature (IdP certificate from metadata) plus `Audience`, `NotOnOrAfter`, `InResponseTo` |
| Replay/CSRF protection | `state` and `nonce` | `InResponseTo` (must match our request id) and `RelayState` |
| Logout | RP-initiated logout | Single Logout (`LogoutRequest` / `LogoutResponse`) |
| Call a shared API | access token | **not possible**: SAML gives no access token |

## 2. The biggest difference: no access token, so no shared API

The three OIDC apps call `api/`, and the API decides whether a sensitive action is allowed (it reads `acr` and `auth_time` from the access token).

A SAML assertion is for the app only. It cannot be sent to the API. So in `apps/saml` **the app itself is the policy point**: `Controllers/Treasury.cs` (`CheckStepUp`) reads the level and login time that were stored from the verified assertion, on the server, and refuses the action if they are too weak or too old. The browser never supplies those values.

## 3. Files to read, in order

| File | What it shows |
|---|---|
| `apps/saml/Program.cs` | Reads the IdP metadata, pins the IdP signing certificate, sets the allowed audience (our entityIDs), cookie flags |
| `apps/saml/Controllers/SamlController.cs` | `Login` (AuthnRequest), `AssertionConsumerService` (all the checks), `Logout`, `SingleLogout` |
| `apps/saml/Controllers/Treasury.cs` | Demo data and the step-up decision |
| `apps/saml/Controllers/TreasuryController.cs` | Sensitive actions park themselves in the server session and send the user to step-up; `/stepup/complete` re-checks before doing anything |
| `apps/saml/Views/Treasury/Assertion.cshtml` | A page that shows the facts the IdP sent (open it after login) |
| `idp/keycloak/realm.json` | The two SAML clients `urn:acme:treasury` and `urn:acme:treasury:stepup`, and the flow `saml-stepup-always-mfa` |

## 4. Step-up in SAML

The standard way is: the SP sends `RequestedAuthnContext` (the level it wants) and `ForceAuthn="true"` (do not reuse the IdP session). The app does send both.

**What we found against Keycloak 26.0 (run, not assumed):** Keycloak accepted `ForceAuthn` (it asked for the password again) but **ignored `RequestedAuthnContext`**: it never asked for the authenticator code and always answered `AuthnContextClassRef = urn:oasis:names:tc:SAML:2.0:ac:classes:unspecified`. Setting `acr.loa.map` or `default.acr.values` on the SAML client did not change that.

So this PoC uses a workaround, which is the main thing to understand:

1. The IdP has **two** SAML clients for the same app: `urn:acme:treasury` (normal login, password) and `urn:acme:treasury:stepup` (bound to a flow that always asks for password + authenticator code).
2. For a normal login the app sends its `AuthnRequest` as `urn:acme:treasury`. For step-up it sends it as `urn:acme:treasury:stepup` with `ForceAuthn`.
3. The step-up client adds a fixed attribute `loa = 2` to the assertion. The assertion is signed, so the app can trust it.
4. The app treats the user as LoA2 only if that signed attribute (or a matching `AuthnContextClassRef`, for IdPs that fill it in) says so. Anything else counts as LoA1.
5. After the return, the app checks again before doing the action. If the new assertion is not LoA2, the action is **not** performed.

For another IdP (Entra, Okta, ADFS) that honours `RequestedAuthnContext` properly, only the IdP configuration changes; the app already reads `AuthnContextClassRef`.

## 5. Known limits (PoC)

- Unsigned `AuthnRequest`s (the IdP is told not to require a client signature). Production should sign requests and encrypt assertions.
- The IdP certificate is read from the metadata URL over plain http on localhost. In production, pin or verify it out of band, over https.
- Session cookies use `SameSite=Lax`. This works on `localhost` because the ports are on the same site. If the IdP is on another site, the ACS post would not carry the cookie; use `SameSite=None; Secure` or keep the request state elsewhere.
- Logout: the app logs out at the IdP, but SAML single logout to the other apps is not wired (same scope as the OIDC apps: back/front-channel logout is out of scope).
- Because the step-up client uses its own flow, a SAML step-up does not set the Keycloak LoA marker the OIDC apps read. Measured: after a SAML step-up the OIDC apps open with no prompt (one IdP session) but still show LoA1, so the 1-minute window is **not** shared between SAML and OIDC apps (see Run results, 5b). The reverse direction was not tested.

## 6. Run results (2026-11-02, Keycloak 26.0, macOS, Chromium via Playwright, `tools/e2e/saml.mjs`)

| # | Check | Result |
|---|---|---|
| 1 | SAML login with password gives LoA1 | run, passed |
| 2 | Release payment at LoA1 shows step-up page, nothing released | run, passed |
| 3 | Step-up: IdP asks password again (ForceAuthn) then the code; assertion carries `loa=2`; action runs | run, passed |
| 4 | Second action inside the 1-minute window: no prompt | run, passed |
| 5 | OIDC Back Office opens with no login prompt after the SAML login (one IdP session) | run, passed |
| 5b | OIDC Back Office shows LoA2 after a SAML step-up | **run, NOT shared** (stays LoA1). Known limitation, see section 5 |
| 6 | After 72 s the same kind of action asks for step-up again | run, passed |
| 7 | Cancel leaves the payment held | run, passed |
| 8 | Forged `SAMLResponse` posted to the ACS is rejected, nobody signed in | run, passed |
| 9 | Logout returns to the signed-out page; the app asks for login again | run, passed |

Not run: other IdPs (Entra, Okta, ADFS) for SAML, signed AuthnRequests, assertion encryption, IdP-initiated logout from another app.

## 7. Run it

```text
npm run up            # Keycloak (re-import the realm once with: npm run reset)
npm run dev:api       # only needed for the OIDC apps
npm run dev:saml      # Treasury on http://localhost:5500
```
Sign in as `alice` / `alice-dev-only`. Release a payment: the app asks for step-up, Keycloak asks for the password again and then the 6-digit code (secret in `docs/idp-keycloak.md`).

Automated browser run: `node tools/e2e/saml.mjs` (about 2 minutes).
