/* global module */
// This package's architecture rules, enforced by `canon check` (architecture module).
// canon wrote this starter once; it is yours now.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  extends: "../../.dependency-cruiser.base.cjs",
  forbidden: [
    {
      name: "no-package-to-app",
      comment: "packages/ are shared; they never depend on an app.",
      severity: "error",
      from: {},
      to: { path: "^\\.\\./\\.\\./apps/" },
    },
    {
      name: "no-orphans",
      comment: "Off here: apps import a package's files through subpath exports, which a run inside the package cannot see.",
      severity: "ignore",
      from: { orphan: true },
      to: {},
    },
    {
      name: "no-duplicate-dep-types",
      comment: "Off here: a shared package lists react and friends as both peer and dev dependency on purpose.",
      severity: "ignore",
      from: {},
      to: {},
    },
  ],
};
