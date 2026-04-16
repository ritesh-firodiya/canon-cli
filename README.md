# Zeno AI

**Autonomous development workflow CLI — scan repos, build memory, execute tasks with AI.**

Zeno AI scans your codebase, builds a persistent memory map of your architecture, patterns, and conventions, then uses that context to autonomously evaluate and execute development tasks — creating branches, writing code, running tests, and committing results.

## How It Works

```
┌─────────────┐     ┌────��─────────┐     ┌────���─────────┐     ┌──��──────────┐
│  zeno init   │────▶│  Scan Repo   │────▶│  AI Analysis │────▶│  .zeno/     │
│              │     │  File tree   │     │  Patterns    │     │  Memory     │
│              │     │  Stack       │     │  Conventions │     │  Created    │
└─────────────��     └──────────────┘     └───��──────────��     └─────────────┘

┌─────────────┐     ┌──────────────┐     ┌─���───────��────┐     ┌─────���───────┐
│  zeno task   │────▶│  Evaluate    │────▶│  Agent Loop  │────▶│  Branch +   │
│  "add auth"  │     │  Feasibility │     │  Read/Write  │     │  Commit     │
│              │     │  Duplicates  │     │  Test/Lint   │     │  Created    │
└─────���───────┘     └──────────────┘     └──��───────────┘     └─────��───────┘
```

### The Flow

1. **Scan** — `zeno init` analyzes your entire repo: file tree, tech stack, dependencies, frameworks, and sends key files to AI for deep pattern/architecture analysis.
2. **Remember** — Everything is stored in `.zeno/` (committed to your repo). No re-scanning needed across machines or team members.
3. **Evaluate** — When you submit a task, Zeno checks it against the memory map: is it feasible? Does it duplicate an existing plan? Does it conflict with in-progress work? Is it too large and needs to be broken down?
4. **Execute** — An autonomous AI agent reads your code, writes changes, runs tests, and commits — all following your existing patterns and conventions.
5. **Track** — Every task is saved as a plan file in `.zeno/plans/` with full history: requirement, Q&A, technical decisions, and outcome.

## Installation

```bash
# Clone the repo
git clone git@github.com:riteshf/zeno-ai.git
cd zeno-ai

# Install dependencies
npm install

# Build
npm run build
```

### Prerequisites

- **Node.js** >= 18
- **Git** — must be run inside a git repository
- **Anthropic API Key** — get one at [console.anthropic.com](https://console.anthropic.com)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Usage

### `zeno init` — Scan & Build Memory

Run this in any git repository to create the `.zeno/` memory directory:

```bash
cd /path/to/your-project
npx tsx /path/to/zeno-ai/src/cli/index.ts init
```

**What it does:**
- Scans all files (ignoring node_modules, dist, .git, etc.)
- Detects tech stack: languages, frameworks, databases, testing tools, CI, containerization
- Sends key files to Claude for AI analysis
- Extracts: code patterns, naming conventions, architecture overview, domain concepts
- Saves everything to `.zeno/`

**Output:**
```
  Zeno AI - Repository Scanner

  ✔ Found 247 files
  Languages: typescript(180), javascript(12), json(30), yaml(8), markdown(17)
  Stack: react, nextjs, prisma, postgresql
  Testing: vitest, playwright

  ✔ Extracted 8 patterns, 6 conventions

  Done! .zeno/ directory created.
```

**Options:**
```bash
zeno init --refresh    # Force re-scan even if .zeno/ exists
```

### `zeno sync` — Update Memory

After making changes to your codebase, sync the memory:

```bash
npx tsx /path/to/zeno-ai/src/cli/index.ts sync
```

This incrementally re-scans the repo and updates `.zeno/` with any new patterns, files, or stack changes.

### `zeno task` — Execute a Task

Submit a development task for the AI to complete:

```bash
npx tsx /path/to/zeno-ai/src/cli/index.ts task "add a health check endpoint at /api/health"
```

**What happens:**
1. **Evaluates** the task against your codebase memory
2. **Checks** for duplicate or conflicting plans in `.zeno/plans/`
3. **Shows** feasibility assessment, complexity estimate, and any questions
4. **Creates** a feature branch (`feat/001-add-a-health-check-endpoint`)
5. **Runs** the autonomous agent loop — reads code, writes files, runs tests
6. **Commits** the result and saves the plan

**Output:**
```
  Zeno AI - Task Runner

  Task: add a health check endpoint at /api/health

  Feasibility: Yes (92% confidence)
  Complexity: small
  Reason: Simple endpoint addition, follows existing API pattern

  Created plan #001
  Executing task...

  [read_file] src/app.ts
  [read_file] src/routes/index.ts
  > Following the existing Express router pattern...
  [write_file] src/routes/health.ts
  [edit_file] src/app.ts
  [run_command] npm test

  Task completed successfully!
  Branch: feat/001-add-a-health-check-endpoint
  Commit: a1b2c3d
  Tokens: 12,450 (~$0.08)
```

**Options:**
```bash
zeno task "your task" --evaluate-only    # Only evaluate, don't execute
```

## The `.zeno/` Directory

Committed to your repo, shared with your team:

```
.zeno/
├── config.json              # Zeno settings (provider, model, timestamps)
├── docs/
│   └── architecture.md      # AI-generated architecture overview
├── memory/
│   ├── files.json           # File tree with language detection
│   ├── stack.json           # Tech stack (frameworks, DBs, tools)
│   └── domain.json          # Business domain concepts
├── patterns/
│   ├��─ patterns.json        # Code patterns (routing, DB access, etc.)
│   └── conventions.json     # Coding conventions (naming, formatting)
├── skills/
│   └── skills.json          # Languages, frameworks, tools needed
└── plans/
    ├── plans-index.json     # Index of all tasks with status
    ├── 001-add-health-check.md
    └── 002-add-auth.md
```

### Plan Files

Every task creates a plan file with full history:

```markdown
---
id: 001
title: Add health check endpoint
status: completed
created: 2026-04-17
branch: feat/001-add-a-health-check-endpoint
related: []
---

## Requirement
Add a health check endpoint at /api/health

## Clarifications
Q: Should it check database connectivity?
A: Yes, include a DB ping

## Technical Plan
...

## Outcome
...
```

New tasks are automatically checked against existing plans for **duplicates** and **conflicts**.

## Supported Tech Stacks

Zeno detects and adapts to these stacks automatically:

| Category | Supported |
|---|---|
| **Languages** | TypeScript, JavaScript, Python, Go, Rust, Ruby, Java, Kotlin, Swift, C#, PHP, Dart |
| **Frontend** | React, Next.js, Vue, Nuxt, Svelte, Astro, Remix |
| **Backend** | Express, Fastify, NestJS, Hono, Django, Flask, FastAPI, Gin, Actix, Axum, Rails |
| **Databases** | PostgreSQL, MongoDB, MySQL, Redis, Prisma, Drizzle, TypeORM, Sequelize |
| **Testing** | Jest, Vitest, Mocha, Pytest, Cypress, Playwright |
| **Build** | Vite, Webpack, esbuild, Rollup, Turborepo, tsx |
| **Linting** | ESLint, Prettier, Biome |
| **CI/CD** | GitHub Actions, GitLab CI, Jenkins, CircleCI, Vercel, Netlify |
| **Infra** | Docker, Docker Compose |

## Architecture

```
src/
├── cli/                    # CLI entry point + commands
│   ├── index.ts            # Commander.js setup
│   └── commands/
│       ├── init.ts         # zeno init
│       ├── sync.ts         # zeno sync
│       └── task.ts         # zeno task
├── scanner/                # Repo analysis
│   ├── file-tree.ts        # File tree scanning + language detection
│   ├── stack-detector.ts   # Tech stack detection rules
│   └── pattern-extractor.ts # AI-powered pattern analysis
├── memory/
│   └── store.ts            # .zeno/ CRUD operations
├── agent/                  # Autonomous AI agent
│   ├── tools.ts            # Agent tools (read, write, edit, search, run, list)
│   ├── loop.ts             # Core tool-use agent loop
│   ├── evaluator.ts        # Task feasibility + duplicate detection
│   └── executor.ts         # Branch creation + execution + commit
├── git/
│   └── index.ts            # Git operations (branch, commit, stash)
├── llm/
���   └── provider.ts         # LLM abstraction (Claude API, extensible)
├── types/
│   └── index.ts            # TypeScript types
└��─ utils/
    └── config.ts           # .zeno/ directory management
```

### Key Design Decisions

- **LLM Abstraction Layer** — All AI calls go through a `LLMProvider` interface. Currently Claude-only, but adding new providers (GPT-4, Ollama) is a single file.
- **Tool-Use Agent Loop** — The agent doesn't generate code in one shot. It iterates: reads files, makes edits, runs commands, checks results, and keeps going until the task is done. Same pattern as Claude Code.
- **Memory is Git-Tracked** — `.zeno/` is committed to the repo. No external database. No re-scanning on new machines. Team members share the same context.
- **Plans as Artifacts** — Every task creates a permanent record. This enables duplicate detection, conflict checking, and full audit trail.

## Agent Tools

The autonomous agent has access to these tools during task execution:

| Tool | Description |
|---|---|
| `read_file` | Read file contents |
| `write_file` | Create or overwrite files |
| `edit_file` | Targeted string replacement in files |
| `search_code` | Glob pattern or text content search |
| `run_command` | Execute shell commands (tests, lint, etc.) |
| `list_directory` | List directory contents |
| `ask_user` | Ask clarifying questions interactively |

## Cost

Zeno uses the Claude API. Approximate costs per operation:

| Operation | Estimated Cost |
|---|---|
| `zeno init` (small repo) | $0.02 - $0.10 |
| `zeno init` (large repo) | $0.10 - $0.50 |
| `zeno sync` | $0.02 - $0.10 |
| `zeno task` (small) | $0.05 - $0.20 |
| `zeno task` (medium) | $0.20 - $1.00 |
| `zeno task` (large) | $1.00 - $5.00 |

Actual costs depend on codebase size and task complexity. Token usage is displayed after each task.

## Roadmap

### V0.1 (Current)
- [x] `zeno init` — Repo scanning + AI memory building
- [x] `zeno sync` — Incremental memory updates
- [x] `zeno task` — Task evaluation + autonomous execution
- [x] `.zeno/plans/` — Task history with duplicate/conflict detection
- [x] Agent tool-use loop with 7 tools
- [x] Tech stack detection (15+ frameworks)

### V0.2 — Autonomous Loop
- [ ] Background task queue (non-blocking `zeno task`)
- [ ] `zeno status` — Check task progress
- [ ] `zeno review` — Interactive review (approve/reject/request changes)
- [ ] GitHub PR creation via API
- [ ] Iterative feedback loop (reject → re-evaluate → retry)
- [ ] Auto-update memory after merged tasks
- [ ] Consistency checking against stored patterns

### V0.3 — Multi-Repo
- [ ] `zeno connect <github-org>` — Org-level scanning
- [ ] Cross-repo memory (shared conventions, dependency maps)
- [ ] Deployment integration (Vercel/Netlify preview URLs)
- [ ] `zeno deploy <task-id>` — Deploy feature branch for QA
- [ ] Smarter task breakdown for large features
- [ ] Confidence scoring on AI output

### V1.0 — Web Platform
- [ ] Web dashboard (React/Next.js)
- [ ] Task submission + real-time progress via web UI
- [ ] Code diff viewer in browser
- [ ] Team collaboration (multi-user per org)
- [ ] Multi-provider LLM support (Claude, GPT-4, open-source)
- [ ] Billing + usage tracking
- [ ] Hosted infrastructure (server-side task execution)

## Development

```bash
# Run in dev mode (no build step)
npm run dev -- init
npm run dev -- task "your task"

# Build
npm run build

# Type check
npx tsc --noEmit
```

## License

ISC
