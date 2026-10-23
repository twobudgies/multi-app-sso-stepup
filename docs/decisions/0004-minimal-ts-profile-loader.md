# ADR-0004: Minimal TypeScript profile loader

Status: accepted

## Decision
The TS package `packages/idp-profile` reads the same profile JSON as C#, but only builds authorization parameters (`acr_values`, `max_age`), parses the RFC 9470 challenge, maps a token claim to LoA1/LoA2 for a sanity check, and allow-lists return paths. It has no authoritative evaluator.

## Why
Anything a browser decides can be tampered with. The API evaluator (`packages/dotnet/IdpProfile`) is the only authority, so duplicating a full evaluator in TS would add drift risk without adding security.
