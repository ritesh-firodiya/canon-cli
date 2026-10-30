# Design sets

How a repo's HTML design set is built. Opt in with `standards: [design-sets]`;
a repo without it is never asked for designs.

Every rule below is a hard rule with a reason attached. The reason is there so
you can tell when a rule truly does not apply — not so you can argue past it.

The product's UX is its own. **Everything around the pages is fixed**, so that
learning one set teaches you all of them.

---

## 0. The one-line version

A design set is a **Babul product kept as files**: static HTML pages built from
components, one file per page with every state in it, painted from W3C tokens,
opened straight from disk inside an identical shell that reads everything it
shows from the HTML itself, and checked against the app it describes.

---

## 1. Layout on disk

```
<repo>/.context/designs/
  design.js          the product: start page, logo and art, sizes, frames, themes, stack, known gaps
  tokens.js         colour, typography, spacing, radius, shadow — W3C design tokens
  shell.js          the set's one link to canon's shell, written once and never edited
  assets/           source art: icon.svg, adaptive layers, feature graphic
  <size>/           mobile · tablet · web · email — one folder per size
    index.html            the journey
    styles/<group>.html   icons · colors · typography · spacing · radius · shadows
    components/<id>.html  a component: its definition in <head>, its board in <body>
    <group>/<page>.html   one page, every state in it
    styles.css            the classes the components are built from
```

**`designs/` holds designs and nothing else.** Notes, decisions and
architecture are canon's, in `.context/wiki/` (§10); the designs follow them.
`assets/` is the only home of source art; store images and the app's own
`assets/` are exports of it.

---

## 2. The HTML is the only source

Two data files are written by hand, because nothing draws them: `design.js` and
`tokens.js` (§8), each strict JSON behind `(window.BABUL ||= {}).<key> = ` so a
`<script>` loads it from disk and Babul reads the JSON.

Everything else the shell **reads from the HTML each time it opens**
(`crawl.js`). From the start page it follows every link and component,
loading each page and board in a hidden frame that posts its own markup back —
a page on `file://` cannot read another file, but a frame can describe itself.
`describe.js` builds the model; `canon check` runs the same code on the files
(`scan.mjs`) and fails on anything the crawl cannot reach.

| Read | From |
|---|---|
| pages | `<group>/<page>.html`: id from the path, name from `<title>`, states from its `data-state` blocks |
| links | every `href`, with the states it sits in; `overlay` when the target is a modal page |
| components | each definition and its board |
| journeys | `data-end` and `data-journeys` on page bodies, in the order pages are reached |
| icons and art | every icon anything draws; every `<img>` in `assets/`; `design.js` `logo` and `art` |

What a drawing cannot show is written on it:

```html
<head>
  <meta name="description" content="One store route, two faces." />           <!-- the page's note -->
  <meta name="description" data-state="error" content="A failed purchase." /> <!-- a state's note -->
  <link data-link="auto" href="../store/free-pick.html" title="first round" /> <!-- opens by itself -->
</head>
<body data-page="game/score" data-route="score.tsx" data-status="approved" data-end data-journeys="Play">
```

- `data-route` is the app file that renders the page; none means no route does.
  `data-status`: `review`, `built`, `approved`.
- `design.js` `start` is one page id, or one per size when the sizes draw
  different pages (`perSize: true`).
- **A link is a step forward unless it says otherwise:**

| | Meaning | Drawn |
|---|---|---|
| *(none)* | a step forward | solid; heavier on the main path |
| `data-link="side"` | a shortcut or an upsell | dotted |
| `data-link="back"` | a return: Home, Back, Play again | dashed, hidden by default |
| `<link data-link="auto">` | not a tap: a sheet that opens by itself, the system back gesture | never drawn |

A link's label is its `data-label`, `title`, `label`, `heading` or `name`, or
its text. A page may open a component's board (the alert it raises); that is
not a link between pages.

---

## 3. One script per page

```html
<script src="../../shell.js"></script>                          <!-- a page -->
<script src="../../shell.js" data-view="components"></script>   <!-- a board -->
<script src="../../shell.js" data-view="styles"></script>       <!-- a styles page -->
<script src="../shell.js" data-view="journey"></script>         <!-- the journey -->
```

`shell.js` loads canon's `boot.js`, which writes in the rest: `design.js`,
`tokens.js`, the shell, Tailwind, lucide, `shell.css` and the size's
`styles.css`.

- **The shell is canon's; a set holds only the link to it.** Its `shell.js` is
  canon's `shell/loader.js`, pointed at `@freetesh/canon@0` on unpkg, so a page
  opened straight from disk (`file:///`) works and a release needs no edit in any
  set. No `_shell/`. `canon ui` serves its own shell at `/shell.js` instead, and
  a site that publishes sets writes each `shell.js` from the same loader, pointed
  at the shell it hosts.

- **Every CDN is pinned**, but for that link, which follows canon's major version: Tailwind 3.4.17, lucide 0.544.0, React 18.3.1,
  React Flow 11.11.4 (v12's UMD build expects `react/jsx-runtime` as a global).
- **Tailwind, and only Tailwind**, plus `styles.css`. No build step.
- **Icons are lucide**, by the name of the component the app imports.
- `style="…"` only for what a class cannot express.

---

## 4. The shell

**One frame, identical in every product**, as Babul lays out View mode: a bar
(logo · product / size, a switch when there are several · theme), a rail (Journey · Pages · Components ·
Styles), a list, the canvas, and on a page an island (‹ name › · states ·
sizes). It shows only the drawing.

- **The shell adds the frame around a page, never anything in it.**
- **Its colours are `--chrome-*` only.** Reading a product token made the same
  control look different per product.
- **`?bare`** renders a page alone — what the journey's thumbnails embed.
  **`?scan`** makes a page describe itself to the crawl and nothing else.
- **Every icon keeps its label**; if the CDN fails, the label shows.

---

## 5. One file per page

- **A state is a block, not a file.** What differs is marked with the states it
  belongs to; everything else is shared. `paywall.html?state=error` opens one;
  no `?state=` is `data`. A layout that differs entirely — landscape — is one
  block holding the whole frame.

  ```html
  <c-banner data-state="error" variant="danger" icon="circle-alert">The purchase did not go through.</c-banner>
  ```
- **A theme is not a state.** It is the toggle.
- **No prose inside a page.** Comments in the markup are fine.
- **Group names** are lowercase kebab-case folders. These recur and mean the
  same everywhere: `launch` (splash, app-wide pages), `auth`, `onboarding`
  (first run only), `home`, `settings`, `store` (anything about money).

---

## 6. Journey

`index.html` is a flow chart drawn with React Flow from the model. **No layout
library**: longest-path depth from the start gives the column.

- **A node is the page itself, shrunk** — a live `?bare` thumbnail.
- **One node per page.** States collapse onto their page.
- **The forward graph must be a DAG.** Drop `auto`, `back` and `side` links and
  what is left must be acyclic, or the columns explode.
- **The main path** — start to the first end — is one straight row.
- **The chips are the named journeys.**

---

## 7. Components

**A component is defined once, in the `<head>` of `components/<id>.html`** — a
page on `file://` cannot read another file, so it opens the board in a hidden
frame, which posts its definition back — and used by name:

```html
<template state="disabled"><span class="btn-go is-off"><slot></slot></span></template>
<template><a class="btn-go"><slot></slot> <i data-if="icon" data-lucide="{icon}" class="w-5 h-5"></i></a></template>
<template variant="got"><a class="btn-go btn-go--got"><i data-lucide="check" class="w-6 h-6"></i> <slot></slot></a></template>
```
```html
<c-go-button variant="got" href="score.html" class="flex-[2]">Got it</c-go-button>
```

- Props are the instance's attributes; `class`, `href`, `title`, `style`,
  `id`, `target`, `aria-*` and `data-*` go on the root.
- The template whose attributes match the most props wins, the first on a tie.
- `{name}`, `{name|default}`, `{test?then:else}`; `data-if="test"` keeps an
  element. A test is `name`, `name=value`, or either after `!`.
- `<slot>` takes the children; `<slot name="x">` those marked `slot="x"`.
- **A prop's kind is how the definition uses it**: a template attribute or a
  `name=value` test is a variant; a `data-lucide` value an icon; a `{name}`
  value text; only tested, a boolean; `<slot>` a slot. A prop that builds a
  class name (`bg-industry-{industry}`) takes the colours that exist as its
  options.
- An instance names any variant its definition tests by value: a test cannot
  see a default.
- **The board is the spec.** Its `<body data-component="go-button"
  data-group="Actions" data-source="src/components/ui/go-button.tsx"
  data-not-needed="pressed">` holds only instances, each spelling out every
  variant; the first value drawn is the default.
- **Anything a page repeats is a component.** Copied markup is two specs.
- **The id is the app component's name in kebab case** wherever there is one.

---

## 8. Tokens

`tokens.js` is the **one home of every colour, type style, space, radius and
shadow**, as W3C design tokens in Babul's groups:

```json
{ "color": { "palette": { "red": { "500": { "$type": "color", "$value": "#ef3e36" } } },
             "brand": { "500": { "$type": "color", "$value": "{color.palette.red.500}",
               "$extensions": { "dev.babul": { "modes": { "dark": "{color.palette.red.450}" } } } } } } }
```

- **Two tiers.** `color.palette` holds every colour once, by base colour,
  light to dark; a step is a lightness. Every other colour is a **role**
  (`brand`, `surface`, `success.bg`) whose light and dark values alias the
  palette. Two colours nobody can tell apart that do one job are one; ground
  steps stay apart, or a line vanishes on its surface.
- **Screens paint with roles.** The palette gets a variable and no utility.
- **The token path is the name everywhere**: `ink.2` → `--ink-2` →
  `text-ink-2`; typography `h1` → `--fs-h1` → `text-h1`.
- **A dark value is `$extensions["dev.babul"].modes.dark`**, applied by
  `data-theme` on the root; utilities read variables, so nothing needs `dark:`.
- **A reserved colour says so in its `$description`.**
- **`styles.css` holds only the classes components are built from**; a class
  nothing draws fails the check.

---

## 9. The frame

- The size's frame from `design.js`, the device radius on a normal page, square
  and full-bleed under `?bare`.
- It **clamps to what is left under the shell**:
  `height: min(var(--frame-h), calc(100dvh - var(--chrome-h) - var(--stage-pad)))`.
  Never `transform: scale()` — it does not change layout height.
- **A page with a modal over it carries `phone--modal`**; a modal card uses
  `bg-frame`; the page underneath is drawn unchanged and inert.
- **The status bar is not drawn; its space is**: every mobile page starts with
  `<div class="safe-top"></div>`. The OS draws the bar, not the product.

---

## 10. The drawing and the wiki

- **HTML is the spec for anything visual.** The page inventory is the pages
  themselves, never a list in Markdown.
- **What a picture cannot hold is canon's**, in `.context/wiki/`: a screen's
  notes in `surfaces/<slug>.md` (only screens that have some), design choices in
  `decisions/`, a colour's or a pattern's rule in `concepts/`. The rules are
  `wiki-schema`.
- **A note holds only what the drawing cannot show.** Never what the HTML, the
  app's CLAUDE.md or git already say — no layout, no history.
- **Where they disagree**: the HTML wins on layout and flow; the wiki's
  canonical values win on prices, names and copy.

---

## 11. The designs describe the app that exists

- **For a shipped product the app is the fact** and a drawing that disagrees is
  wrong. Fix it, or change it deliberately and say so in its note.
- **Read the source, do not remember it.** Icons from the component the app
  imports, names from the data, copy from the i18n dictionary, colours from the
  app's theme.

---

## 12. Checks

`canon check` runs the design checks for every size folder beside `design.js`:

| Check | Asks |
|---|---|
| **scan** | does the crawl from the start reach every page, board and definition; does every instance name a real component, property, variant and state; every link a page or state; every state note a block; is every file in `assets/` drawn or named? |
| **shell** | does the set hold no copied `_shell/`? |
| **well-formed** | is every `<div>` closed exactly once? |
| **links** | does every local `href` point at a file that exists? |
| **tokens** | does every class and `var(--…)` resolve? |
| **acyclic** | is the forward graph a DAG? |
| **routes** | is every app screen drawn, and does every `data-route` exist? |
| **app-flow** | do the app and the journey navigate alike, both ways? |
| **copy** | is every word a dialog or toast shows drawn somewhere? |
| **styles** | is every class in `styles.css` drawn? |

A route the set does not draw yet is listed in `design.js` `missing`, with why.

---

## 13. Where each part comes from

| Part | Comes from |
|---|---|
| `shell.js` | canon's `shell/loader.js`; `canon ui` serves its own in its place |
| `<size>/index.html`, `<size>/styles/*.html` | the same in every set but the `<title>`, which names the product |
| `design.js`, `tokens.js`, `styles.css` | written for this product |
| pages, components, boards | drawn |

**A formatter is an edit.** Add `.context/designs/` to `.prettierignore`.

### Building a set

1. Read the app's routes, components, theme and i18n dictionary.
2. Write `design.js` and `tokens.js`, then run `canon ui`.
3. Define each component the app has, with its board.
4. Draw the pages from the components, states as blocks; mark returns,
   shortcuts and journeys.
5. Run `canon check` and walk the set.

---

## 14. Known-wrong patterns

| Pattern | Why it fails |
|---|---|
| `transform: scale()` to fit the frame | does not change layout height |
| Several pages in one file | no URL, no page, no link |
| A file per state | every unchanged line is a copy that drifts |
| Component markup copied into a page | two specs for one thing |
| A hand-written list of pages, links or components | it drifts from the HTML |
| Prose, notes or decisions inside `designs/` | knowledge is canon's; two homes drift |
| A screen painting with a palette or hue colour | a repalette becomes a rename everywhere |
| A class used but never declared | paints nothing |
| Unpinned CDN | every set restyles itself overnight |
| The shell reading a product token | the same control looks different per product |
| Inventing a page, a pack or a string | the set becomes fiction |
| Copying the shell from whichever set is nearest | older sets are behind |
| A component class named after a Tailwind utility | the utility wins the cascade |
