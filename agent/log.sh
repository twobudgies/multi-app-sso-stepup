#!/usr/bin/env bash
# Usage: agent/log.sh <EVENT> <message>
# Appends one timestamped line to agent/LOG.md (append-only, never edited).
# Creates LOG.md with a header if it does not exist yet.
set -e
cd "$(dirname "$0")"
if [ ! -f LOG.md ]; then
  printf '%s\n%s\n' \
    '# Agent log (append-only; written via agent/log.sh)' \
    '# Events: INIT, START, NOTE, DONE, BLOCKED, DECISION, RESUME, FINISH' > LOG.md
fi
printf '%s | %-8s | %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" "${*:2}" >> LOG.md
