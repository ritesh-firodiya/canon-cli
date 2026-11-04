// Every session starts knowing to weigh first. The principles stay out: weigh reads them with `canon check --constitution`.
const context = [
  "canon: before acting on a non-trivial request, run the weigh skill; it reads the constitution and cites principle IDs.",
  "Check a request's claims before acting (C-14). Reply in plain words (C-15). Record decisions with the canon decision skill.",
].join("\n");

process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } }));
