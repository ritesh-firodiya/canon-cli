# Pipeline

How a new app is built: five stages, in order, with hard gates. Opt in with
`standards: [pipeline]`.

These are hard rules. There is no "quick prototype" exception and no "I'll add
it later" exception.

## The stages

Each stage stops and waits for the owner's approval before the next starts.

1. **HTML designs** → **hard gate: the owner reviews them by hand.**
   Static HTML in `.context/designs/<surface>/`, built to `design-sets`. Every
   screen and every state the screen has gets its own file (`design-sets` §5).
   No app project, no schema, no components until the designs exist and are
   approved.
2. **Scaffold the app.** Structure only — no features. For an Expo app, see
   `expo`. The stage does not end until every credential it produced is backed
   up (see `secrets`).
3. **Plan all features**, as `features/` pages.
4. **Build the schema** → **hard gate: the owner reviews it.**
5. **Build the app.**

Present the stage, then stop. A plan approved is not code approved. Do not start
with "a small piece", a spike, or a test harness because it looks useful.

## Principles

These join canon's constitution when a repo opts in. Verdicts cite them by ID.

### C-16 Designs before code
No app code for a screen that has no approved HTML design. A component in no
HTML file does not ship. The wireframe is the spec; when code and wireframe
disagree, fix the code or change the wireframe first and say so.
*Source:* `pipeline`, `design-sets`.

### C-17 Stages stop at their gates
Designs, scaffold, plan, schema, build — in order, each waiting for approval.
Approval of a plan is not approval to code. No "small piece", spike or harness
to get ahead.
*Source:* `pipeline`.
