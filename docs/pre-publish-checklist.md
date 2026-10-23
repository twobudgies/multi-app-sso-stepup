# Pre-publish checklist

The repo is private. The owner prefers a **fresh squashed repo** over flipping this one (decision #12). Nothing here changes visibility: the owner does that.

## 1. Secrets
- [ ] `gitleaks detect --source . --redact` on the full history: clean (last run: clean on 2026-10-23, also in CI).
- [ ] `trufflehog git file://. --only-verified` (trufflehog was not installed on the dev machine, so **not run**).
- [ ] Review the allowlist in `.gitleaks.toml`: only the placeholder `change-me-dev-only` in `.env.example` and the public fake TOTP seed (RFC 6238 test vector).
- [ ] No real tenant ids, IdP URLs or client secrets: `git grep -nEi "login.microsoftonline|okta.com|amazoncognito|amazonaws"` should show only documentation links.
- [ ] The company PPT template is not committed (`docs/presentation/private/` is git-ignored): `git ls-files docs/presentation | grep -i private` is empty.

## 2. Repo content
- [ ] `LICENSE` name and year are right. `SECURITY.md` contact filled in; private vulnerability reporting enabled on GitHub.
- [ ] The git author email in history is OK to be public (a fresh squashed repo lets you choose).
- [ ] `README.md`, `docs/progress-log.md` and `docs/manual-checks.md` are current; "tested IdPs" table says Keycloak only.
- [ ] `agent/` files: decide whether the task-runner scaffold should be public (`agent/LOG.md` is git-ignored).

## 3. Publish a fresh squashed repo (preferred)
```text
git clone --no-local <this-repo> publish && cd publish
git checkout --orphan clean && git add -A && git commit -m "Initial public release"
git branch -M main && git remote set-url origin <new-empty-repo-url> && git push -u origin main
```
Then re-run gitleaks on the new repo and enable private vulnerability reporting.

## 3b. Or flip this repo (not preferred)
`gh repo edit twobudgies/multi-app-sso-stepup --visibility public --accept-visibility-change-consequences` after items 1 and 2.
