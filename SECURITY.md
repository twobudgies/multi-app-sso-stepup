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
