# standards/

zeno's default standards. `zeno standards` lists the ones that apply to a repo:
these first, then each folder named under `standards:` in the estate's and the
repo's `.claude/zeno.yaml`. A configured file with the same name as one of these
replaces it; a configured `constitution.md` adds principles instead.

| File | What it holds |
|---|---|
| `constitution.md` | The principles a request is weighed against (C-01 to C-13) |
| `wiki-schema.md` | Wiki page types, frontmatter, required sections, lint rules |
| `context-layout.md` | The `.context/` ten-folder layout, where each kind of document lives, `features/` and `tasks.md` formats |
| `dev-methods.md` | The evidence spec-, test- and data-driven work leaves behind |
| `agent-contract.md` | What every agent does before, during and after work |
