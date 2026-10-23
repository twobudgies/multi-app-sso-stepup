# Progress log

Dated, plain-language journal, one short entry per task. Committed on purpose, because `agent/LOG.md` is git-ignored. Newest at the bottom.

| Date | Task | What happened |
|------|------|---------------|
| 2026-10-23 | Docs PRs #1-#5 | Added the resumable task-runner agent, project brief and phased to-do list, and design docs for architecture, tokens, step-up and the IdP adapter. |
| 2026-10-23 | PR #6 | Added a glossary and the rule to explain things in plain language. |
| 2026-10-23 | PR #7, #8 | Added the presentation phase and its requirements (mixed audience, 45 min, live demo). |
| 2026-10-23 | PR #9, #10 | Recorded owner decisions (1-minute step-up window, Windows demo, shared API) and fixed stale window values. |
| 2026-10-23 | P0-1 (#11) | Added line-ending rules, ignore rules, `.env.example` and a README note. Checked that `.env` and `*.pem` are ignored. |
| 2026-10-23 | P0-2 (#12) | Added the secret scanner (gitleaks) as a pre-commit hook and a GitHub check. Ran it: it caught a fake key and found nothing in history. |
| 2026-10-23 | P0-3, P0-4 (#13) | Documented how fake test credentials are handled and wrote the Windows laptop guide (not tried on Windows). |
| 2026-10-23 | GATE-P0 (#14) | Phase 0 finished; glossary extended. |
| 2026-10-23 | PR #15 | Added the Acme Bank demo story and the end-to-end test task. |
| 2026-10-23 | Phase R | Retrofit: README repo map, docs index, ADRs for layout and ports, narrower secret allowlist, Acme Bank notes in design docs. |
