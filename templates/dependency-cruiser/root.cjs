/* global module */
// This repo's architecture rules, enforced by `zeno check` (architecture module).
// zeno wrote this starter once; it is yours now. Add the layers this product has
// (see the rule reference below) and keep the why in a wiki concept page.
// Rule reference: https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  extends: "./.dependency-cruiser.base.cjs",
  forbidden: [],
  options: {
    // The level `zeno ui` draws the architecture graph at: one box per match.
    reporterOptions: { archi: { collapsePattern: "^src/[^/]+|^[^/]+" } },
  },
};
