# Documentation index

> Status: **design documents**. The code does not exist yet. Each doc says what the apps *will* do. They are reconciled with the real code in task P6-1 and anything that turns out different is corrected then.

| Doc | Read it to understand |
|-----|-----------------------|
| [architecture.md](architecture.md) | Who talks to whom, which IdP endpoints are used, how SSO works |
| [token-lifecycle.md](token-lifecycle.md) | Which tokens exist, where each app stores them, how refresh works |
| [step-up-actions.md](step-up-actions.md) | Which actions need step-up MFA, the policy, and the step-up flow |
| [idp-adapter.md](idp-adapter.md) | How any IdP (Entra, Okta, Cognito, generic) is plugged in via profiles |
