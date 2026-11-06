---
id: FEAT-0011
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
- Given the person's own context repo, then it is read last, in every repo.
- Given the same fact with two values in two layers, then `canon check` warns and names both files; it never picks one silently.
- Given a value under `locked:` in a higher layer, then a lower layer that changes it fails `canon check`.
- Given a layer the person cannot clone (a private team repo), then it is skipped without an error and nothing about it is shown.
- Given a context repo marked `visibility: restricted`, then no command copies or moves its content into a less private layer, and `canon check` fails if a less private repo quotes it.
- Given a new fact, then canon proposes the narrowest layer that is true for it, and proposes moving it up only when a second repo needs it; the move is a pull request the layer's owners approve.
- Given a context repo cloned anywhere, then canon finds it from the git remote's owner and a `canon-context` repo topic.
- Given a layer's folders (`company/`, `departments/`, `domains/`), then they are declared with `context.folders`, as today.
- Given the person's own settings, then they are a file in that person's context repo and name no organization and no repo. Repos can sit in any folders on any drive, one organization's repos spread across several; canon finds a repo's organization from its git remote, never from its folder.
- Given a repo whose `.context/` is local only (listed in `.gitignore` because it cannot be pushed), then every check reads the files on disk, not only tracked ones (`refs` does since 2026-11-04).
- Given an organization whose knowledge lives in an outside tool (a wiki, a docs site, a shared drive), then that layer is a read-only connector source (`connectors:` with `via: mcp`, `cli` or `api`), searched like a context repo and never written to.
- Given a folder of many flat repos where some are products and others support them (internal tools, admin platforms), then each repo says which product it serves with the existing `product:` key, and repos naming one product share that product's layer.
- Given a machine where the person's layer is a read-only clone, then canon reads it and never commits or pushes to it.
## Out of scope
- Moving or cloning repos on disk.
- GitHub access rules: who may read a layer stays GitHub's team and repo permissions.
- Canon's web UI for layers.

## Decided
- Layers are named with the existing `extends:` key in `.context/context.yaml`; there is no separate `knowledge:` list (2026-11-04).
- A layer that is not on this machine, or that the person cannot read, is skipped without an error, and `canon check --status` lists which layers were found. Today a missing `extends:` target throws (`config/load.ts`); that changes (2026-11-04).
- The person's layer is one repo, read-only where needed (2026-11-04).
- The person's own settings are a file in their personal context repo. It holds only that person's settings: no organization, no repo settings, no organization or repo names. A repo's settings stay in that repo's own `.context/` (local only where it cannot be pushed) (2026-11-04).
- An outside knowledge tool is fetched on demand through its connector; nothing from it is copied to disk (2026-11-04).
- "The same fact in two layers" means the same canonical value (a named value in an entity table); other lines are not compared (2026-11-04).
- Search uses one index per person per machine, built only from the layers that person can read there, kept outside every repo and never pushed (2026-11-04).

## Open questions
- How canon finds the person's own context repo on a machine: a fixed default path, or an environment variable.

## Store copy
> Company, team and personal knowledge in layers: the closest answer first, conflicts shown, private stays private.
