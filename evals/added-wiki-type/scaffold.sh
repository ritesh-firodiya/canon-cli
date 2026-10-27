#!/usr/bin/env bash
set -euo pipefail
"$(dirname "$0")/../_scaffold/fixture.sh" streaks
# This product adds a page type, so incident write-ups get their own shape and folder.
mkdir -p .claude
cat > .claude/canon.yaml <<'YAML'
wiki:
  types:
    - type: postmortem
      folder: postmortems
      reason: incidents need a timeline and a fix, not a concept page
      sections: [Summary, Impact, Timeline, Root cause, Fix, Sources]
YAML
cat > .context/raw/2026-10-20-midnight-reset.md <<'MD'
# Incident notes — 2026-10-20

Users in UTC+5:30 saw their streaks reset at 05:30 local time. `src/data/history.ts`
buckets check-ins by UTC date, so a check-in before 05:30 counted for the previous
day. 212 support emails. Fixed in 1.4.2 by bucketing on the device's local date.
MD
