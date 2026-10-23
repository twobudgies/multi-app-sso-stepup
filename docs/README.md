# Documentation index

> Status: reconciled with the code on 2026-10-23. Each doc says at the top what is built, what is only reviewed and what is not implemented.

| Doc | Read it to understand |
|-----|-----------------------|
| [architecture.md](architecture.md) | Who talks to whom, which IdP endpoints are used, how SSO works |
| [token-lifecycle.md](token-lifecycle.md) | Which tokens exist, where each app stores them, how refresh works |
| [step-up-actions.md](step-up-actions.md) | Which actions need step-up MFA, the policy, and the step-up flow |
| [idp-adapter.md](idp-adapter.md) | How any IdP (Entra, Okta, Cognito, generic) is plugged in via profiles |
| [glossary.md](glossary.md) | Plain-language meaning of every term used |
| [windows-setup.md](windows-setup.md) | Preparing the Windows demo laptop (reviewed only, not run) |
| [progress-log.md](progress-log.md) | Dated, plain-language journal of every task (committed; `agent/LOG.md` is not) |
| [decisions/](decisions/) | ADRs: why the repo and ports are laid out the way they are |
| [idp-keycloak.md](idp-keycloak.md) | The Keycloak realm: users, clients, TOTP, login levels, mappers |
| [api.md](api.md) | The shared API: endpoints, token checks, policy, challenge |
| [demo-domain.md](demo-domain.md) | The Acme Bank story and what each app does |
| [decisions/](decisions/) | ADR-0003 (SPA state), ADR-0004 (minimal TS loader) |
| [manual-checks.md](manual-checks.md) | Step-by-step demo checklist and the evidence of what was run vs only reviewed |
| [review-checklist.md](review-checklist.md) | Security-critical code paths, how each was checked (run vs read), known weaknesses |
| [idp-check](../tools/idp-check/README.md) | Capability probe for any IdP |
| [decisions/](decisions/) | ADR-0005 PKCE, ADR-0006 server-side enforcement, ADR-0007 SPA tokens vs BFF, ADR-0008 shared window |
| [pre-publish-checklist.md](pre-publish-checklist.md) | What to check before the repo goes public |
