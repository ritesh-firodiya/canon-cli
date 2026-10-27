# Frontend code

Rules for every `.tsx` file in a React Native or React app, new or touched.
Opt in with `standards: [frontend]`.

These are not style preferences and there is no "I'll split it later". **Plan
the files before writing the screen**: list the components, hooks and helpers a
screen needs, then write each in its own file. A screen written as one file and
split afterwards is the failure this standard exists to stop.

1. **One component per file, named after the file.** No private sub-component at
   the bottom of a screen, however small. The only exception is a set of sibling
   primitives always imported together (a type ramp, a layout trio), in a file
   named for the set and listed in the lint config.
2. **A route file is thin.** `app/**` reads params, finds the data, and renders
   one screen component from `components/<feature>/`. No business logic, no
   event handlers longer than a line, and under 200 lines.
3. **Helpers live apart from what renders.** A pure function goes in `lib/` with
   a test. Anything that touches React, a store or navigation goes in `hooks/`.
   No lowercase function is declared in a `.tsx` file.
4. **Constants live in `constants/`.** A number, a label map, a limit, a regex:
   if it has a name, it has a home outside the component.
5. **UniWind only** (`uniwind` + `tailwindcss`). `className` for everything a
   class can express. No `StyleSheet`, no styled-components, no NativeWind, no
   CSS files beyond the theme. `style={{ }}` only for a value computed at
   runtime — a measured or animated number. A third-party native view that
   ignores `className` (expo-image, expo-camera) is wrapped once with
   `withUniwind` in `components/ui/` and used through the wrapper.
6. **Props are a named `interface`**, declared above the component. No
   `React.FC`, no anonymous inline prop types on an exported component.
7. **Hooks hold the state and effects; components render.** A component that
   fetches, navigates and lays out is three files.
8. **Lowercase kebab-case file names, PascalCase component exports.**

## The linter enforces these

`pnpm lint` is a gate. Keep the rules in one ESLint file (for example
`eslint/standards.js`): one component per file, no helpers in component files,
no fixed inline styles, no `StyleSheet`, a line cap on routes. Copy it from the
reference repo (`copies.source`) at scaffold time. A standard that is only
written down gets broken; one that fails the build does not.

Before reporting frontend work as done, run the linter and read the diff against
this list. If a file breaks one of these, the work is not done.
