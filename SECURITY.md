# Security policy

This is a proof of concept for SSO and step-up MFA and is not production-ready.

## Reporting a vulnerability

Please do not open a public issue. Report privately through GitHub's
"Report a vulnerability" (Security tab) on this repository, or email the
maintainer. Include steps to reproduce and the affected files.

## Secrets

Never commit client secrets, tokens, signing keys or real IdP credentials.
Use environment variables or an untracked `.env` file. If a secret is
committed, rotate it immediately; deleting it from history is not enough.

## Test credentials (dev only)

The local Keycloak realm contains test users and a pre-seeded TOTP secret so the
demo needs no manual enrolment. These are fake, dev-only values, are documented
in `docs/`, and must never be reused anywhere real.

- They live only in the checked-in realm file under `idp/keycloak/` and in
  `.env.example` as obvious placeholders (`change-me-dev-only`).
- Real values go in the git-ignored `.env`, never in a commit.
- Intentional fake values that trip the scanner are allowlisted in
  `.gitleaks.toml` with a comment saying why. Do not allowlist anything that
  could be a real secret.
- Anything real that was committed must be rotated, not just deleted.
