# ADR-0002: Local port choices

Status: accepted

| Service | Port |
|---------|------|
| Keycloak | 8180 |
| API | 5100 |
| MVC | 5200 |
| React | 5300 |
| Angular | 5400 |

## Why
macOS reserves 5000/5001 (AirPlay Receiver) and port 8080 was already used on the dev machine, so the defaults of .NET and Keycloak would collide. The same ports are used on Windows so redirect URIs in the Keycloak realm are identical. Override in `.env` (`.env.example` lists them) but then the realm redirect URIs must change too.
