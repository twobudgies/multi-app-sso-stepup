# Documentation index

> Status: **design documents** (being reconciled with code). The code does not exist yet. Each doc says what the apps *will* do. They are reconciled with the real code in task P6-1 and anything that turns out different is corrected then.

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
