---
id: FEAT-0027
type: feature
status: planned
priority: p2
last-verified: 2026-11-04
release: null
surfaces: []
---
# Layered knowledge

## Summary
Knowledge, not only rules, comes in layers: a repo's own `.context/`, then the context repos it `extends:` (team, domain, department, company), then the person's own. canon finds the right answer, reports when layers disagree, keeps restricted knowledge where it belongs, and says where a new fact should go.

## Motivation
`extends:` layers rules today, but nothing above a repo's `.context/` is read for knowledge. An organization keeps shared facts in a context repo and wires it in by hand (an import line in a `CLAUDE.md`), so canon cannot search it, check it, or see a fact written twice with two values. A large organization has company, product, team, domain and department knowledge, some of it private to one team.

## Acceptance scenarios
- Given a repo that `extends:` a context repo, then `canon` search and the band read that repo's `.context/` after the repo's own, closest first.
- Given a repo with no `extends:`, then nothing changes.
- Given a person's own context repo named in user config, then it is read last, in every repo.
- Given the same fact with two values in two layers, then `canon check` warns and names both files; it never picks one silently.
- Given a value under `locked:` in a higher layer, then a lower layer that changes it fails `canon check`.
- Given a layer the person cannot clone (a private team repo), then it is skipped without an error and nothing about it is shown.
- Given a context repo marked `visibility: restricted`, then no command copies or moves its content into a less private layer, and `canon check` fails if a less private repo quotes it.
- Given a new fact, then canon proposes the narrowest layer that is true for it, and proposes moving it up only when a second repo needs it; the move is a pull request the layer's owners approve.
- Given a context repo cloned anywhere, then canon finds it from the git remote's owner and a `canon-context` repo topic, or a path in user config.
- Given a layer's folders (`company/`, `departments/`, `domains/`), then they are declared with `context.folders`, as today.

## Out of scope
- Moving or cloning repos on disk.
- GitHub access rules: who may read a layer stays GitHub's team and repo permissions.
- Canon's web UI for layers.

## Decided
- Layers are named with the existing `extends:` key in `.context/context.yaml`; there is no separate `knowledge:` list (2026-11-04).
- A layer that is not on this machine, or that the person cannot read, is skipped without an error, and `canon status` lists which layers were found. Today a missing `extends:` target throws (`config/load.ts`); that changes (2026-11-04).

## Open questions
- How "the same fact" is detected: canonical values in entity tables only, or any line.
- Whether the person's layer is one repo or a folder in user config.
- Whether a search index is built per person, and where it is kept.

## Store copy
> Company, team and personal knowledge in layers: the closest answer first, conflicts shown, private stays private.
