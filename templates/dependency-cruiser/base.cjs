/* global module, require */
// Managed by zeno — `zeno sync` rewrites this file from zeno's template, so edits here are lost.
// Put this repo's own rules in the .dependency-cruiser.cjs files that extend it.
// Each workspace runs on its own because apps map `@/` to their own src, and
// dependency-cruiser reads one tsconfig per run.

const { existsSync } = require("node:fs");

// recommended's no-orphans exceptions (dot files, .d.ts, tsconfig, babel/webpack configs),
// restated because the package does not export its rule files…
const KNOWN_CONFIG_FILES = [
  "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$",
  "\\.d\\.(c|m)?ts$",
  "(^|/)tsconfig\\.json$",
  "(^|/)(?:babel|webpack)\\.config\\.(?:js|cjs|mjs|ts|json)$",
];
// …plus files a framework or tool loads by convention, so nothing imports them.
const ENTRY_POINTS = [
  "(^|/)src/app/[^.]*(page|layout|route|loading|error|not-found|template|default)\\.tsx?$", // Next.js app router
  "(^|/)src/pages/[^.]+\\.tsx?$", // Next.js pages router
  "^src/app/[^.]+\\.tsx?$", // Expo Router: every file under app/ is a route
  "^src/(instrumentation|middleware)\\.ts$", // Next.js hooks
  "^(scripts|plugins|eslint|e2e|public)/", // run by a tool, not imported
  "(^|/)__mocks__/", // jest mocks
  "^(src/)?index\\.ts$", // a package's entry
  "(^|/)codegen\\.ts$", // GraphQL codegen script
];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  extends: "dependency-cruiser/configs/recommended",
  forbidden: [
    {
      name: "no-orphans",
      comment: "Nothing imports this file: use it or delete it. Add a real entry point to ENTRY_POINTS instead.",
      severity: "warn",
      from: { orphan: true, pathNot: [...KNOWN_CONFIG_FILES, ...ENTRY_POINTS] },
      to: {},
    },
  ],
  options: {
    // Record imports into a sibling workspace, but leave cruising it to that workspace's own run.
    doNotFollow: { path: ["node_modules", "^\\.\\./"] },
    // Specs and tooling configs are not app code.
    exclude: { path: "^(dist|build|out|generated|coverage|\\.next|\\.expo|\\.turbo)/|^tests/|\\.(spec|test)\\.tsx?$|(^|/)[^/]+\\.config\\.(c|m)?(j|t)s$|(^|/)\\.dependency-cruiser" },
    tsPreCompilationDeps: true,
    // Each run starts in its workspace, so this is that workspace's tsconfig (if it has one).
    ...(existsSync("tsconfig.json") ? { tsConfig: { fileName: "tsconfig.json" } } : {}),
    // Packages like uuid 13 export only `node`/`default` conditions.
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "node", "default", "types"] },
  },
};
