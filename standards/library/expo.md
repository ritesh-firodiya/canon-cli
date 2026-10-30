# Expo apps

How an Expo app is created and laid out. Opt in with `standards: [expo]`.
Code rules for the `.tsx` files are in `frontend`.

## Read the versioned docs

This project is on **Expo SDK {{expo.sdk}}** (from `expo.sdk` in
`.claude/canon.yaml`). Read <https://docs.expo.dev/versions/v{{expo.sdk}}.0.0/>
before writing any Expo or React Native code. APIs move between SDKs, and
recalled shapes are often wrong.

## Scaffold with the Expo CLI

Create the app with `npx create-expo-app@latest`, on the latest Expo SDK. Never
hand-assemble a React Native project, never copy another app's `node_modules`
layout, never fork an old scaffold that is a major version behind.

Set these up at scaffold time, before any feature work: expo-router, lucide
icons (`lucide-react-native`), UniWind, RevenueCat (`react-native-purchases`),
Firebase, and any AI integrations the app needs. Structure only — no features.
Copy the lint rules in at the same time (`frontend`).

## Layout

```
<app>/
  CLAUDE.md        # stack, directory tree, monetization, persistence rules
  AGENTS.md        # the agent contract; CLAUDE.md imports it with @AGENTS.md
  CHANGELOG.md     # Keep a Changelog 1.1.0 — feeds the store release notes
  .context/        # see context-layout
  src/             # application code; routes in src/app/ (or apps/<name>/src/ in a monorepo)
```

- `/ios` and `/android` are **generated** and gitignored. Never hand-edit them —
  change `app.config.ts` or a config plugin and prebuild again.
- The store listing is in `.context/listing/` (see `store-listing`).

## Styling

UniWind only — the rule is `frontend` rule 5. The Tailwind tokens in the app
mirror the design set's `tailwind.config.js` (`design-sets` §8), so a token
means the same thing in the drawing and in the app.

## Before calling work done

On top of the repo's lint, typecheck and tests:

1. For anything touching imports, dependencies or assets, also run
   `npx expo-doctor` and `pnpm expo export --platform android`. They catch SDK
   pin drift and runtime resolution failures that typecheck cannot.
2. If a native dependency changed, it ships as a release
   (`npm version patch && git push --follow-tags`), not an OTA update.
   `scripts/check-ota-safe.mjs` blocks the OTA otherwise.
3. An OTA never ships on a push to `main`. `ota.yml` runs only from an
   `ota-v<version>-<n>` tag on `main`, or a manual run. A push is not a decision
   to ship to users.
