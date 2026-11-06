---
last-verified: 2026-11-02
---
# Work records

**Choice:** each kind of work has its own folder and ID (0.29.0, 2026-11-02; who: not recorded):

| Folder | ID | Holds |
|---|---|---|
| `problems/` | PROB | what needs solving |
| `ideas/` | IDEA | a way to solve it |
| `experiments/` | by name | a proof or test, from any stage |
| `plans/` | PLAN | how it will be solved |
| `features/` | FEAT | what will be built |
| `bugs/` | BUG | what will be fixed |

Each record is Markdown with frontmatter, and what happened to it stays on it
(`## Verdict`, `approvals:`, `sources:`, `cost:`, `outcome:`). Only `id` is required;
a repo changes the kinds in `context.yaml`. Run logs go to `~/.canon/runs.jsonl`.

**Why:** work starts from what is wrong, not from a solution, so options are weighed
before a spec. A stage must read and link each record, so each kind needs one shape.

**Rejected:**
- A PRD → RFC flow: it starts at a solution and skips the options.
- Fixed fields or kinds, `experiment: true`, a `poc` stage, plans or bugs inside `features/`: each team's work differs, and each kind needs its own record.
- Bugs only in an issue tracker: a stage cannot read or link them.
- A database, or logs in the repo: the repo is the truth; a decision lives on the page it decided.

**Revisit:** when a team needs records its members cannot commit.
