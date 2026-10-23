# Presentation outline (45 min, mixed audience, live demo)

Deck: `acme-bank-sso-stepup.pptx` (built by `build-deck.mjs`, `npm run build` in this folder). 19 main slides plus 3 appendix slides, speaker notes on every slide. Every content slide carries a one-line takeaway for managers; detail is in the notes and the appendix. The company template is not used (none was provided, and it must never be committed): to apply it, paste the slides into the template.

Story arc: problem, then SSO, then architecture, then tokens, then step-up, then the demo, then IdP flexibility, then trade-offs and honesty about what was verified, then next steps.

| # | Slide | One message | Min |
|---|-------|-------------|-----|
| 1 | Title | One login, extra proof only when it matters | 1 |
| 2 | The problem | Many logins, and a password alone is a weak gate for risky actions | 2 |
| 3 | Agenda | 45 minutes: concepts, 12 min live demo, trade-offs | 1 |
| 4 | Single sign-on | Log in once at one trusted page, apps trust the proof | 3 |
| 5 | The demo domain | Acme Bank: Customer Portal, Payments, Back Office | 2 |
| 6 | Architecture | Three apps, one API that decides, one IdP | 3 |
| 7 | Token journey | Short-lived tokens; refresh does not extend the login time | 3 |
| 8 | Step-up concept | LoA1 password vs LoA2 password + code, and it must be recent | 2 |
| 9 | Step-up flow | Six steps from click to completed action | 2 |
| 10 | The API decides | Tampering with the website cannot bypass the rule | 2 |
| 11 | Shared window | One proof counts in all apps for about a minute (up to 65 s) | 2 |
| 12 | Demo divider | Live demo | 0 |
| 13 | Demo script | Ten steps | 1 |
| 14 | Screenshots | Backup if the live demo fails | 12 (demo) |
| 15 | Any IdP | Profile file, not new code; only Keycloak tested | 5 |
| 16 | Security decisions | Strong where it matters; weaknesses listed | 3 |
| 17 | Run vs reviewed | What was proved and what was only believed | 2 |
| 18 | Next steps | Windows, real tenant, BFF, limits | 1 |
| 19 | Questions | Buffer 10 min | 10 |
| A1-A3 | Glossary, FAQ, repo map | Reference | n/a |

Rules kept: no real secrets, tenant ids or IdP URLs on any slide; no invented metrics (the only numbers are the 60 s window, 5 min token, 14 screenshots and the counts of checks in `docs/manual-checks.md`); no claims about untested IdPs beyond "template, untested".

## Visual check (P7-3)
All 22 slides were rendered through LibreOffice and inspected. Fixes made: card titles overlapping body text, an overlong title, labels crossing arrows, a wrapped code line. Caveat: LibreOffice substitutes Cambria and Calibri with metric-compatible fonts, so fit in real PowerPoint is expected to match but was not seen there. Slide 14 screenshots are small on purpose (they are a backup); slide 11 timeline labels are the densest and worth a glance in PowerPoint.
