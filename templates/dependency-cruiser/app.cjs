/* global module */
// This app's architecture rules, enforced by `canon check` (architecture module).
// canon wrote this starter once; it is yours now. Add the layers this app has
// and keep the why in a wiki concept page.
// Rule reference: https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  extends: "../../.dependency-cruiser.base.cjs",
  forbidden: [
    {
      name: "no-app-to-app",
      comment: "An app never imports another app; share code through packages/.",
      severity: "error",
      from: {},
      to: { path: "^\\.\\./[^./]" },
    },
  ],
  options: {
    // The level `canon ui` draws the architecture graph at: one box per match.
    reporterOptions: { archi: { collapsePattern: "^src/[^/]+/[^/]+|^src/[^/]+|^[^/.][^/]*|^\\.\\./\\.\\./packages/[^/]+" } },
  },
};
