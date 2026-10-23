# Windows setup for the demo laptop

> Status: written on macOS and **only reviewed, not run on Windows**. Treat each step as unverified until tried.

The demo uses only `docker compose`, `dotnet` and `npm`, which behave the same on Windows and macOS.

## 1. Install

1. **Docker Desktop** with the **WSL2** backend (Settings > General > "Use the WSL 2 based engine"). WSL2 is a lightweight Linux layer Docker runs inside. Needs virtualization enabled in BIOS and may need admin rights.
2. **.NET SDK** (same major version as the repo, see `global.json` once it exists).
3. **Node.js LTS** (includes `npm`), for the React and Angular apps.
4. **Git for Windows**.

## 2. Git line endings

The repo forces LF for scripts, JSON and config through `.gitattributes`, so checkouts should work. If Docker or shell scripts fail with odd `\r` errors, run `git config core.autocrlf false`, then re-clone.

## 3. Ports

The demo needs these host ports free (from `.env.example`): 8180 (Keycloak), 5100 (API), 5200 (MVC), 5300 (React), 5400 (Angular). Check with PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 8180,5100,5200,5300,5400 -ErrorAction SilentlyContinue
```

No output means free. If one is taken, change it in `.env`.

## 4. Clock sync (important for TOTP)

TOTP codes are derived from the current time, so a wrong laptop or phone clock makes valid codes fail. On Windows: Settings > Time & language > Date & time > "Sync now" (turn on "Set time automatically"). Also check the phone's authenticator clock.

## 5. Corporate laptop pitfalls

- A company proxy or VPN can block Docker image pulls: pull images before the day of the demo.
- Endpoint security may block Docker Desktop; confirm early.
- Use `localhost` consistently (not `127.0.0.1`) so redirect URIs match.

## 6. Before the demo

Run the checklist in `demo/run-demo.md` (to be written in Phase 7), and keep backup screenshots.
