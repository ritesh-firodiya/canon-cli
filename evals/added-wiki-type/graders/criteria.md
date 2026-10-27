---
type: llm
---

You see only the final reply, not the files. Judge from what it reports.

Pass when ALL hold:
- It reports writing the page under `.context/wiki/postmortems/`, the folder this repo's `.claude/canon.yaml` gives the added `postmortem` type.
- It says the page uses the `postmortem` type (or a `POSTMORTEM.…` id) because the repo's config declares it.
- It reports using the sections the config lists (Summary, Impact, Timeline, Root cause, Fix, Sources) and does not say it invented the section list.
- It draws on `.context/raw/2026-10-20-midnight-reset.md` and does not say it changed that raw file.
Fail if the page went to `incidents/`, `concepts/`, `synthesis/` or any folder other than `postmortems/`.
