---
date: 2026-10-25
kind: research
question: Is a hosted, org-wide zeno (sellable, enterprise onboarding, in-app editor) worth building?
status: first pass — desk research only, no customer interviews yet
---

# zeno for teams — market research, first pass

Desk research from web search on 2026-10-25. Most sources are vendor blogs or
vendor-written comparisons, so read prices and rankings as rough. **This is not
proof of market fit.** Only talks with buyers, and a pilot, can show fit (C-14).

## The idea being tested

A company onboards to zeno. zeno scans its GitHub org, suggests a setup for each
product, asks questions, imports the knowledge people give it, and builds a first
wiki per repo. The company sets its own standards (PRD, RFC, ADR, spec, data and
test driven); zeno ships short defaults. People read, search, edit, use
templates, and ask questions on a website. Every file stays in its own repo.

## What already exists, by part of the idea

| Part | Who already does it | Price seen | What this means for zeno |
|---|---|---|---|
| AI wiki per repo, built from the code | Factory AutoWiki (commits to `droid-wiki/` in the repo), DeepWiki (Cognition, free for public repos), Google Code Wiki, OpenDeepWiki (open source) | AutoWiki: no price listed. Factory plans: Teams $60 + $40/seat (third party, not checked) | Taken, and often free. Not a reason to buy zeno. |
| Ask questions across org knowledge | Unblocked (code, PRs, Slack, Jira, Notion, Confluence; respects permissions), Augment, Onyx (open source), Copilot Spaces | Unblocked $19/user/mo; Onyx cloud from $16/seat | Taken. They connect far more sources than zeno does. |
| Org-wide rules for AI agents | GitHub Copilot org custom instructions (GA April 2026, every repo in an org), AGENTS.md (Linux Foundation) | Included in Copilot Business and Enterprise | The biggest threat. GitHub gives "one set of rules for every repo" free with Copilot. |
| Git-synced docs with an editor for non-devs | GitBook (visual editor, Git sync), Mintlify (web editor commits to Git) | GitBook $65/site + $12/user; Mintlify Pro $450/mo | Taken. Building an in-app editor means competing with these head on. |
| Spec-driven workflow | GitHub Spec Kit (MIT, 90k+ stars), Kiro (AWS), Tessl | Spec Kit free; Kiro metered | Free and popular. A zeno spec standard should work with Spec Kit, not replace it. |
| Quality gates that block bad work | Qodo (review agents, quality gates) | Teams $30/user/mo | Enforces **code** quality, not product decisions or standards. |
| Decisions handed to agents, CI checks | AsDecided (open-source tools; says "give your agents the decisions your team already made") | Unknown | Closest to zeno. Needs a proper look before positioning. |

## Where zeno is different

None of the tools above, as far as these sources show, does all of these:

1. **Weighs a request before work starts** against written rules and decisions,
   and pushes back with citations.
2. **Checks claims** in the request against facts and data sources, and stops
   on assumptions.
3. **Fails CI** when docs or code break a standard (`zeno check`).
4. **One home per standard**, with org, repo and local layers.

The retrieval, wiki and editor parts are crowded. The **enforcement** part is
thin. This is the only part of the idea with a clear gap.

## Answers to the four questions

- **Worth it?** Not proven. The gap is real but narrow: enforcement, not
  knowledge. Nobody has been asked whether they would pay for it.
- **Over-engineered?** Yes, the editor, the hosted multi-tenant app and Ask.
  These are commodity parts that GitBook, Unblocked and GitHub already sell or
  give away.
- **Really needed?** For the user's own estate, no; `zeno ui` covers it. For the
  employer org, unknown. That's the cheapest place to find out.
- **Instead:** sell the gate, not the wiki. Onboarding (`init --scan`) plus
  standards plus CI checks plus the weigh gate, working with GitHub and
  Copilot/Claude rather than replacing them.

## Market-fit tests, cheapest first

1. **5–10 talks with eng leads or heads of product**, including the employer.
   Ask: how do you stop agents from ignoring decisions today? What did that cost
   last time? Who pays for dev tools? Write each talk to `.context/raw/`.
2. **Employer pilot** with the CLI and plugin only, on 2–3 repos. Count
   push-backs that saved rework, and `zeno check` failures that caught a real
   problem.
3. **Look closely at AsDecided and Qodo** before choosing a position.
4. Only after 1–2 come back positive: decide open-core vs private, decide
   whether a turborepo split is needed, and start the web designs.

## Open items

- Whether the employer allows its internal docs and code in such a tool.
- Making the repo private does not take back the versions already published on
  npm under MIT. Open-core (CLI stays MIT, the hosted or enterprise part is paid)
  keeps current users and still allows selling.
- Prices above come from third-party pages and were not checked on vendor sites.

## Sources

- https://factory.ai/news/wiki
- https://codersera.com/blog/what-is-deepwiki-ai-code-documentation-github-repository/
- https://github.com/topics/deepwiki
- https://www.atlascloud.ai/blog/tips/ai-github-repository-documentation-codewiki
- https://theaiagentindex.com/agents/factory-ai
- https://getunblocked.com/blog/best-engineering-knowledge-platforms-ai-coding-agents-2026/
- https://github.blog/changelog/2026-04-02-copilot-organization-custom-instructions-are-generally-available/
- https://github.blog/changelog/2025-05-29-introducing-copilot-spaces-a-new-way-to-work-with-code-and-context/
- https://www.gitbook.com/blog/gitbook-vs-mintlify
- https://buildwithfern.com/post/mintlify-reviews-pricing-alternatives
- https://www.augmentcode.com/tools/best-spec-driven-development-tools
- https://intuitionlabs.ai/articles/spec-driven-development-spec-kit
- https://www.morphllm.com/agents-md-guide
- https://asdecided.com/notes/agents-md-vs-claude-md-vs-adrs
