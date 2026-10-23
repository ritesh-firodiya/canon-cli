// This repo's architecture rules, enforced by `zeno check` (architecture module).
// zeno wrote this starter once; it is yours now — add the layers and boundaries
// this product has, and keep the why in a wiki concept page.
// Rule reference: https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  // No cycles, no orphans, no shipped code importing dev-only packages, and more.
  extends: "dependency-cruiser/configs/recommended",
  forbidden: [
    {
      name: "no-app-to-app",
      comment: "An app never imports another app; share code through packages/.",
      severity: "error",
      from: { path: "^apps/([^/]+)/" },
      to: { path: "^apps/([^/]+)/", pathNot: "^apps/$1/" },
    },
    {
      name: "no-package-to-app",
      comment: "packages/ are shared; they never depend on an app.",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(node_modules|dist|build|coverage|\\.next|\\.expo|\\.context)/|^\\.dependency-cruiser\\.cjs$" },
    tsPreCompilationDeps: true,
    // The level `zeno ui` draws the architecture graph at: one box per match.
    reporterOptions: { archi: { collapsePattern: "^(apps|packages)/[^/]+|^[^/]+/[^/]+" } },
  },
};
