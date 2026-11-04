---
name: learn
disable-model-invocation: true
description: Turn what history shows into proposed rule changes — overridden verdicts, where work stalls, what costs most. Use when the person asks what canon has learned, why a rule keeps being overridden, or to review the rules; `/learn`.
---

You are reading this repo's history and proposing changes to its rules. You propose; the person decides.

## Steps

1. Run `canon learn --json`. It returns the verdict counts and the open proposals: each names a principle, how often it was overridden, in which products, and the reasons people gave.
2. If the person asked where work stalls, also run `canon learn --flow <product>`; if they asked about cost, `canon learn --cost --json`.
3. For each proposal, read the principle (`canon check --constitution`) and the reasons. Decide which is true:
   - the rule is wrong for these cases: propose new wording, or an exception that names the case;
   - the wording misleads: propose clearer words;
   - the overrides were mistakes: say so, and propose nothing.
4. Show the person one short list: each proposal, what you would change, and the evidence (counts, two reasons at most).
5. Change nothing yourself. canon's standards are read-only unless the person says to edit them. When they decide:
   - approved: `canon learn --approve <id> --note "<what changes>"`, then record it with the decision skill, or edit the standard only if they asked you to;
   - rejected: `canon learn --reject <id> --note "<why>"`. It returns only with new evidence.

Every page you write passes the knowledge gate. If it refuses one, fix what it names or bring the page to the person.
