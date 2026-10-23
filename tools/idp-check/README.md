# tools/idp-check

Reads `<issuer>/.well-known/openid-configuration` and compares it with the chosen profile in `idp/profiles/`: PKCE, code flow, logout endpoint, `acr_values_supported`, claims, prompt values. Prints `ok`, `warn` (needs a manual check) or `MISMATCH` (exit code 1).

Run: `npm run idp-check` (or `node tools/idp-check/index.mjs --issuer <url> --profile <name>`). Needs Node 18+ and the IdP reachable.
Discovery metadata is not proof of behavior; see `docs/manual-checks.md`.
