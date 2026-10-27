# Design sets

How a repo's HTML design set is built. Opt in with `standards: [design-sets]`.

Every rule below is a hard rule with a reason attached. The reason is there so
you can tell when a rule truly does not apply — not so you can argue past it.

The product's UX is its own. A game and a tax app should look nothing alike.
**Everything around the screens is fixed**, so that learning one set teaches you
all of them: where the gallery is, what the bar does, how a variant is named,
where the reasoning lives.

---

## 0. The one-line version

A design set is a folder of static HTML screens, one screen per file, declared
in a single manifest, wrapped in an identical demo navbar, indexed by a flow
chart, and checked against the app it describes.

---

## 1. Layout on disk

```
<repo>/.context/designs/
  brand/                  # source art: icon.svg · splash-icon.svg · adaptive layers · wordmark. Not a surface.
  architecture/           # diagram sources (<slug>.json) and their drawn pages. Not a surface — see §4
  email/                  # transactional email HTML. An email is a surface of its own, drawn in HTML
  <surface>/              # `mobile` or `web` — the surfaces that carry the set machinery below
    index.html            # the gallery — a flow chart, nothing else
    screenshots.html      # every screen at once, as live iframes
    routes.js             # THE MANIFEST — the one place a screen is declared
    _gallery.js           # renders the flow chart from the model
    _chrome.js            # derives the model (window.WF), injects the navbar
    shared.css            # CORE, then PALETTE, then this product's components
    tailwind.config.js    # loaded AFTER the CDN; every value is var(--token)
    <flow>/<screen>.html  # one screen per file
```

`brand/` is the only home of source art. Store images, press media and the
app's own `assets/` are exports of it.

Documentation lives in `.context/wiki/`, never beside the HTML. No top-level
`docs/` or `wireframes/` folder: that material belongs under `.context/`.

---

## 2. `routes.js` is the single source

`_chrome.js`, `index.html` and `screenshots.html` all read it. Before it existed
the screen order lived in three places — the gallery's table, each screen's
hand-written sibling strip, and nobody's idea of prev/next — and they disagreed,
because three copies of a list always do.

**`routes.js` is read exactly once, by `_chrome.js`**, which publishes the
derived model as `window.WF` and is loaded by every page. Nothing else may walk
the manifest itself. The three readers each used to rebuild their own maps from
it and came to disagree about what a state was: the chart collapsed
`Board · loading` onto Board, the contact sheet gave it a tile of its own, and
back/next stepped through a list that matched neither.

| `window.WF` | |
|---|---|
| `flat` | every file, states inline, manifest order — what `back`/`next` walk |
| `meta` / `base` | one entry per screen; `base(file)` maps a state onto its screen |
| `links` / `col` | the graph collapsed onto screens, and each screen's rank |
| `mainPath` / `mainNodes` | the happy path, start to first end |
| `journey` | `[{ flow, screens }]` — flows and screens in the order reached |

```js
window.ROUTES = {
  product: "My Game",
  surface: "mobile",
  surfaces: ["mobile"],          // every surface this product draws
  themes: ["light", "dark"],     // every theme this SET draws, not the app
  frame: { w: 390, h: 844 },
  architecture: "architecture/overview.html",   // see §4; omit if none

  /* Reserved order: states · auth · onboarding · home · * · settings · store · patterns */
  flows: [
    { flow: "game", screens: [
      { file: "game/board.html", screen: "Board",
        states: { loading: "game/board-loading.html" },
        status: "built",          // built | approved | review
        notes: "board" },         // wiki slug, or null — see §10
    ]},
  ],

  flow: {                         // the chart
    start: "states/splash.html",
    end:   ["game/win.html"],
    edges: [ /* see §6 */ ],
  },

  updated: "2026-09-22",
  missing: [{ what: "Interstitial", why: "ships and has no wireframe" }],
  states:  { empty: { drawn: null, note: "why not" } },
};
```

**A screen not in `routes.js` appears nowhere.** That is the point: adding one is
a single edit, and forgetting is visible immediately rather than months later.

Status (`built` / `approved` / `review`) and the five-state coverage live in
`routes.js`, where the bar reads them. They are data, not a page.

A screen file declares only its own path. Everything else is derived, and the
bar is injected from it — never hand-write chrome into a screen:

```html
<body data-chrome data-file="game/board.html">
```

---

## 3. Tailwind, and only Tailwind

Static HTML plus Tailwind via the CDN. **No React, no build step, no other CSS
framework, no hand-written utility classes.**

Every screen loads exactly this, in this order, with **pinned** versions:

```html
<script src="https://cdn.tailwindcss.com/3.4.17"></script>
<script src="../tailwind.config.js"></script>
<script src="https://unpkg.com/lucide@0.544.0/dist/umd/lucide.js"></script>
<link rel="stylesheet" href="../shared.css" />
...
<script src="../routes.js"></script>
<script src="../_chrome.js"></script>
<script>lucide.createIcons();</script>
```

An unpinned CDN can silently restyle every screen in every repo overnight.

`index.html` and `screenshots.html` load the lucide line too. They have no
screen on them, but they carry the same navbar, and the navbar is icons.

- **Icons are lucide**, the same set the Expo app uses via `lucide-react-native`,
  so an icon never has to be re-chosen at build time. Use the *lucide* name of
  the component the app imports: `CircleCheckBig` → `circle-check-big`.
- **One icon set, and nothing hand-copied.** No inline `<svg>` in a screen and
  no path data in `_chrome.js`: ask lucide for the icon by name. A mark lucide
  cannot supply — the product's own logo — is **one file under `brand/`**,
  referenced by every screen that shows it. Pasted inline it exists twice and
  drifts twice; one game's mark had two copies with two different sets of
  gradient ids before it became `brand/mark.svg`.
- **A DRAWING is not an icon, and the rule above is about icons.** A progress
  ring, a sparkline, a chart — something the app itself renders as SVG and whose
  shape carries data — has no lucide name and no static file, because it changes
  with the number. Draw it, but **declare the geometry once, as a component
  class in `shared.css`**, and leave only the datum in the markup:

  ```html
  <svg class="ring-svg [--arc:116]" viewBox="0 0 118 118">
    <circle class="ring-track" /><circle class="ring-fill" />
  </svg>
  ```

  The test is the same one as for a mark: is there one source of truth? One
  set's calorie ring was five copies of nine identical attributes differing in
  one number — nine chances to drift, on the first thing on the home screen.
  Prefer CSS where CSS can say it (a countdown timer can be a conic gradient),
  and keep SVG where it cannot — round caps and a bottom gap are the shape of a
  ring like that, and a conic gradient has neither.
- `style="..."` is for what a class truly cannot express — an exact type
  ramp step, a one-off overlay alpha. Not for colour that a token exists for.

---

## 4. The demo navbar

**One bar, identical in every product**, injected by `_chrome.js`. It renders on
a screen, on the flow chart and on the screenshots sheet, at the same height,
with every control in the same place. Navigation on the left, settings on the
right, and what you are looking at in between — so the two never trade places
and you stop hunting for the control you just used.

| Group | Contents |
|---|---|
| **Left** | all routes · screenshots · architecture · back · next — all icons |
| **Middle** | every screen in this flow, then this screen's states — words |
| **Right** | light / dark · mobile / web · notes — all icons |

- **Architecture** (`network`) opens how the product is built, between
  screenshots and back. `routes.js` names the page in `architecture`, relative
  to the surface folder; a set without one shows the chip struck out, so the
  chips after it never move. See "The architecture pages" below.
- **Key screens.** With more than a handful of screens, every box at once is a
  wall nobody can read. A set marks the few screens that explain the product
  with `key` in `routes.js`: `key: "Editor"` puts a screen in a named row,
  `key: true` in its flow's own row. Rows group related flows (for example
  Start · Onboarding · Editor · Settings). Base screens only, never a state.
  One to five a row, about 8–25 in all.
  - The chart then opens on those rows, one row per lane, each read left to
    right, arrows only between neighbours, and a label only on a direct link (a
    link that steps over hidden screens would borrow a label the reader cannot
    see). Rows come in the order their first screen appears in `routes.js`.
  - The contact sheet opens on the key tiles, grouped by the same rows.
  - Both have a switch to every screen. A set that marks none shows everything.
- **A control that means the same thing on every page is an icon.** All eight
  of them — all routes, screenshots, architecture, back, next, theme, surface,
  notes — never change meaning between products, so the word was only ever a
  label for something you already knew. They are lucide, asked for by name, so
  the bar carries no icon set of its own. Icons: `workflow`, `layout-grid`,
  `network`, `chevron-left`, `chevron-right`, `sun`, `moon`, `smartphone`,
  `monitor`, `info` — theme and surface are two-state, so they take two each.
- **The middle fits on one line.** The screen names scroll when they overflow,
  and the state chips sit after them, so an overflowing flow hides its states.
  Keep each flow small enough to fit the frame's width: split a long flow by
  what it is about (twenty settings screens became product, company and account
  settings), and **never repeat the flow in a screen's name** — in `pages`,
  "Code", not "Pages · Code"; the flow already says it. A state key outside the
  closed set (§5) is not shown at all, so anything else is a screen.
- **A word stays where the word IS the content.** The screen names in the
  middle and the state names beside them are the only text left in the bar.
- **Every icon keeps its label** in `title` and `aria-label`, so hovering says
  which control it is. An icon you have to click to understand is worse than
  the word it replaced. If the lucide CDN fails, each icon falls back to
  rendering its own label rather than an empty square.
- **There is no breadcrumb.** `mobile · /game ›` said what the surface toggle
  on the right already says and what the flow tint in the chart already says,
  and it sat between the nav chips and the screen chips pushing the two apart
  for no information.
- **The bar has its own fixed colours**, `--chrome-*`, declared in the CORE
  block of `shared.css`. **It must never read a PALETTE token.** Reading
  `--brand-500` made the active chip blue in one set and navy in another, so the
  same control looked like a different control, and the bar read as part of the
  product rather than as the thing holding it. Other CORE tokens are fine and
  are used — `--font-mono` is the same stack in every set, so it cannot drift.
- **Both halves of each right-hand control are always rendered.** A set with no
  dark palette shows `dark` struck through; a product with no web surface shows
  `web` struck through. A control that appears on some pages and not others
  moves everything beside it — and a theme the app ships but nobody has drawn is
  a gap, which has to *look* like a gap rather than like "there is no dark here".
- `back` / `next` step through the set in route order and are struck through at
  the ends, so the bar does not reflow as you walk it.
- **The bar is measured, not assumed.** It wraps to two rows on a narrow window,
  and `_chrome.js` publishes `--chrome-h` so the frame can clamp under it. A
  guessed constant is wrong exactly when the window is small, which is when
  fitting matters.
- **`?bare` renders a screen with no bar at all** — what the screenshots sheet
  embeds, and what you want when capturing one screen. It also sets `data-bare`
  on the root, which drops the stage gutter and the device rounding.

### The notes button

- **The `info` icon at the far right, past the display controls.** It is the
  only control in the bar that opens something *over* the screen rather than
  changing which screen you are looking at, so it sits apart from the ones that
  navigate, and it is the only round single chip — the segmented pairs beside
  it are pills, every other chip is a rounded rectangle. As a word among the
  screen names it read as another screen.
- The drawer is collapsed by default. It opens on the right, has a **header
  naming the screen and a close button**, and closes on Escape. A panel covering
  a third of the window needs a way out that is not the button you opened it
  with, which the bar may have scrolled past.
- **Every screen has a notes button.** A screen with no wiki page still renders
  the button, struck out, for the same reason a missing theme is struck out.

### The architecture pages

Every set carries an `architecture` flow: how the product is built.

```
<repo>/.context/designs/
  architecture/            # ASSETS, like brand/: <slug>.json (the source) + <slug>.html (drawn)
  <surface>/architecture/  # SCREENS: overview.html + one screen per diagram, declared in routes.js
```

- **Diagrams are small and answer one question each**: who uses it, how it is
  built, the backend (only when there is a server), what it relies on. At most
  six boxes and straight arrows. One big diagram of everything was unreadable.
- They are drawn by the **Archify** agent skill from their `.json`. Edit the
  `.json`, then in `designs/architecture/` run
  `ARCHIFY_UPDATE_CHECK_DISABLED=1 node <archify>/bin/archify.mjs finalize
  architecture <slug>.json <slug>.html --quality showcase`. It must pass; delete
  its receipts after.
- **The screens are generated** from a spec that names the set, the diagrams,
  the stack tables (library, version, what it is for), one line on the
  product's own code, and the monthly cost. The generator writes the screens
  and their `routes.js` entries.
- A screen frames its diagram in Archify's embed mode (`?embed=1&theme=light`),
  in a frame of the diagram's own shape, so nothing is cropped and the only
  theme switch is the set's own bar. In a phone set the architecture screens
  drop the 390px frame and fill the window under the bar.
- **The overview is architecture and cost only**: the diagrams, the stack by
  layer with versions, the monthly cost. How a feature works belongs in the
  wiki and the docs, not here. Facts come from the repo; a fact that is not in
  it is left out or marked, never invented.
- Notes: `.context/wiki/surfaces/architecture.md`.

---

## 5. One screen per file

A second frame in a file has no URL, cannot appear in `routes.js`, cannot be
linked to, and does not show up in the screenshots sheet. So:

- **A theme is not a second frame.** It is the toggle. One file, both themes.
- **A state is its own file**: `<screen>-<state>.html`, with the state drawn
  from the closed set `empty · loading · error · offline · locked`.
- **Anything the closed set cannot name is its own screen, not a state.** "Draw"
  and "Ads off" are screens with their own base names, not `-draw` and `-off`
  variants. Stretching a state word to cover them is how a vocabulary stops
  meaning anything.
- **No prose inside a screen file.** No annotation sidebar, no rationale column,
  no explanatory paragraph. The screen is the thing being reviewed, and an essay
  beside it competes for the eye. Comments in the markup are fine and expected.

Not every screen has every state; a loading state on an about page is a rule
people learn to ignore. Draw the real ones and let `routes.js` say in one line
why each of the others is not drawn.

### Flow names

One folder per flow, lowercase kebab-case. Seven names recur across products
and mean the same thing every time, so they are reserved and always sort to the
same place; everything else is the product's own domain and sorts
alphabetically in the `*` slot:

`states · auth · onboarding · home · * · settings · store · patterns`

**`states` sorts first because it holds `splash`** — the screen the product
starts on. `back`/`next` walk manifest order and the contact sheet breaks ties
with it, so a manifest that does not begin where the product begins puts the
entry screen near the end and makes the first `back` dead in the wrong place.
The rest of `states` — `404`, `offline`, `maintenance` — comes along with it,
which costs nothing: nobody browses to a 404 on purpose.

| Flow | Owns |
|---|---|
| `auth` | sign-in, verify, profile — getting an identity |
| `onboarding` | first run only. A screen shown again later is not onboarding |
| `home` | the first screen after entry |
| `settings` | changing the thing, including how-to-play and about |
| `store` | paywall, packs, upgrade, ads — anything about money |
| `states` | app-wide: `404`, `500`, `offline`, `maintenance`, `splash` |
| `patterns` | reusable pieces shown alone: toasts, sheets, components |

**A `patterns` page is a screen file in every respect but one: the frame is
optional, and what it shows decides.** A modal, a sheet or a toast is a device
thing — it has a backdrop, it sits over a screen, and it only means anything at
390pt, so it belongs in the frame. A colour ramp, a type ramp or a component
inventory is not a device thing: nothing in the product renders it, it is wider
than 390pt, and squeezed into a phone it teaches less than the same ramp laid
out, so it goes frameless. Never more than one frame, the same as any other
file.

**Everything else about a patterns page is the ordinary rule**, including the
one most often broken here: **it carries no prose.** The specimens and their
legends are the content — a badge row that does not say what the badges mean is
useless, and a legend is inventory, not rationale. What a pattern is FOR goes in
its wiki page, which the notes button already opens. Pattern pages that open
with the same paragraph as their wiki page are two copies of one sentence —
exactly what §10 exists to prevent.

Screens are named for what the screen **is**. **No `index.html` inside a flow** —
at surface root it is the gallery, and one level down the same name meaning "the
main screen of this flow" is ambiguous and has no variant form.

---

## 6. `index.html` is a flow chart

**A horizontal flow chart and nothing else.** No title, no description, no meta
line, no tables, no status legend. The chart already names every screen, and
anything that needs explaining is a wiki page. It runs start → … → end, and
every screen in `routes.js` appears in it.

Drawn with **React Flow v11**, from `WF` — never from `routes.js`. `_gallery.js`
draws; it derives nothing.

```html
<script src="https://cdn.tailwindcss.com/3.4.17"></script>
<script src="tailwind.config.js"></script>
<script src="https://unpkg.com/lucide@0.544.0/dist/umd/lucide.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/reactflow@11.11.4/dist/umd/index.js"></script>
<link rel="stylesheet" href="https://unpkg.com/reactflow@11.11.4/dist/style.css" />
<link rel="stylesheet" href="shared.css" />
...
<script src="routes.js"></script>
<script src="_chrome.js"></script>
<script src="_gallery.js"></script>
```

`_chrome.js` comes before `_gallery.js`: it publishes the model the chart reads.

v11 and not v12: the v12 UMD bundle expects `react/jsx-runtime` as a page global,
which React's own UMD build does not provide.

**No layout library.** React Flow wants explicit positions, and the graph is a
shallow DAG with a declared start, so longest-path depth gives the column
directly. dagre or elk would be a third dependency solving a problem that is
already solved — and their columns would line up with what the engine thought
looked balanced rather than with the journey.

### Declaring the graph

```js
flow: {
  start: "states/splash.html",
  end:   ["game/score.html"],
  edges: [
    { from: "states/splash.html", to: "home/home.html" },
    { from: "home/home.html", to: "game/play.html", label: "Let's Play" },
    { from: "game/score.html",  to: "store/bundle.html", label: "more packs", side: true },
    { from: "game/score.html",  to: "home/home.html",    label: "Home",       back: true },
  ],
}
```

**Four kinds of edge**, and only the first defines the shape of the chart:

| | Meaning | Drawn |
|---|---|---|
| *(none)* | a step forward | solid; heavier and brand-coloured on the main path |
| `side: true` | a shortcut or an upsell — real navigation, no progress | dotted |
| `back: true` | a return: Home, Back, Play Again | dashed, **hidden by default** |
| `state: true` | **not a step in the journey** — it involves a state screen | never drawn — dropped in `_chrome.js` before anything is ranked |

`side` exists because counting a shortcut as progress drags its target right: an
upsell from the score put the whole shop *after* the score and stretched the
spine across the page. Returns are hidden behind a toggle because every screen
goes back to Home, so they all converge and cross everything on the way.

### `state: true` is a judgement, not a shape

It does **not** mean "an edge that touches a state file". It means *this is not
a step in the journey*. Two edges both touching a state screen can go opposite
ways:

| | |
|---|---|
| `balances-offline → add` | The offline variant of Balances offers the same navigation the base screen already offers. Drawn again from the variant it is a duplicate. **`state: true`.** |
| `board-loading → win` | The game progresses through the thinking state to an outcome, and no other edge says so. Drop it and Win has no way in. **A plain forward edge.** |

Ask whether the journey moves. If the same step is already declared from the
base screen, it is not a second step.

### The ranked graph must be a DAG

Collapse the states, drop `state`, `back` and `side`, and what is left **must be
acyclic**. Longest-path ranking is only defined on a DAG, and those three flags
are what keep it one — that is what they are *for*, not a side effect.

Get it wrong and the failure is silent and enormous: relaxation round a cycle
never settles, so every screen in the loop is ranked by the pass budget instead
of by the journey. One set once put 34 screens at column 727 and drew a chart
**185,385px wide**, which reads as "broken" rather than as "mis-declared".

`_chrome.js` detects the cycle instead of waiting it out, falls back to BFS
depth — defined on any graph, always terminating — and warns in the console
naming the three flags. The chart stays readable; the warning tells you which
declaration to go and fix.

### Rules the chart must obey

- **One box per screen.** A state is a variant, not a second screen — it
  collapses onto the screen it is a state of, and edges are rewritten through
  the same map so a step that passes through a state still connects the screens
  either side of it. Drawing states as their own nodes put "Board" beside
  "Board · loading" and read as two places.
- **A node is a labelled rectangle** — the screen's name and its flow. Never a
  thumbnail; the screenshots sheet is where you go to look at screens.
- **Each node carries an arrow in its corner that opens the screen.** The box
  itself is not a link.
- **Clicking a box shows how you reach it**: every route into it lights up, the
  rest fades. Computed over the edges currently drawn, so turning returns on
  widens the answer rather than having silently counted paths nobody could see.
- **The main path is found, not declared** — start to the first end node,
  following forward edges — and pinned to row 0 in every column, so the happy
  path is one straight horizontal line with everything else hanging below it.
  Ordering rows by declaration made the spine zig-zag between columns, which is
  exactly what a flow chart exists to stop.
- **The main path reads first.** Its edges are heavier and brand-coloured and
  its nodes fully opaque; everything else is lighter and slightly faded.
- **Each node carries its flow's colour on its left edge**, so you can tell the
  shop from the game without reading a word: `home` brand, `store` accent,
  `states` and `settings` ink, the product's main domain flow success, anything
  else info. A small key names them — one swatch per flow the set uses, four to
  seven of them, not a paragraph.
- **A flow's colour falls back rather than resolving to nothing.** `store` is
  `var(--accent-500, var(--brand-500))`: only a set with a second brand colour
  declares accent, and an undeclared `var()` paints *nothing at all* — a
  colourless node edge and a blank swatch, which reads as a bug rather than as
  a colour choice.
- The start node is ringed in `brand`, the end nodes in `success`.
- **Only forward edges carry a label.** A return is dashed and arrowed, which
  already says "goes back here"; labelling them put three "Back"s on top of each
  other.
- **A label sits at the target's row**, on the run going into the screen it
  names — that is the end that makes it mean something, and five exits from one
  screen no longer stack in the gutter. Labels landing on the same screen stack
  a line apart. The few that still land on a box (an edge that skips a column
  passes over the node between) are measured once the chart has settled and
  lifted clear, with a halo rather than a background box, which would detach
  from the moved text.
- **Every edge leaving one node bends at a different distance.** They share a
  bend by default, so five exits from Home ran down one corridor and became a
  single thick line.
- **Nothing may re-fit the chart after load.** Memoise the node and edge arrays;
  rebuilding them every render made React Flow re-measure and the chart shivered
  continuously.

---

## 7. `screenshots.html`

Every screen at once, live, at half scale — the fastest way to spot the one that
drifted.

- **Live iframes, not stills.** A sheet of stills is stale the day after it is
  made, and this page exists to catch the screen that drifted.
- Each tile embeds `<screen>?bare`, which is why bare mode must fill its tile
  exactly: no stage gutter, no device rounding, no device shadow.
- Tiles are labelled with the screen name and link to the screen.
- It carries the same demo navbar as every other page.
- **One tile per screen. States get no tile of their own** — the same rule as
  the chart, and for the same reason. "Board" beside "Board · loading" beside
  "Game History · empty" is one screen listed twice, and on a page whose whole
  job is *find the one that drifted* the duplicate is noise. The navbar's state
  switcher is where the variants live: there you are already looking at the
  screen they are variants of.
- **Grouped by flow, in journey order.** The flow is a heading, once, instead
  of a line under every tile; the flows run in the order the product first
  reaches one and the screens inside a flow run by rank — so the sheet opens on
  Splash, then Home, then the game. Manifest order breaks every tie. Both the
  grouping and the order are `WF.journey`, which the chart ranks from the same
  numbers, so the sheet and the chart cannot tell different stories.

---

## 8. Tokens

`shared.css` is three blocks, in this order:

1. **CORE** — identical in every product. The frame, the stage, the bar, the
   notes drawer, the chart, the type ramp, the radii, the shadow geometry, and
   the token *names*. Copied byte for byte (§13).
2. **PALETTE** — this product's colours, and nothing else.
3. **Components** — this product's own classes.

The naming rule is the whole naming policy:

> **the CSS variable is the Tailwind token path with dots as dashes.**
> `line.strong` ↔ `--line-strong`. `ink.2` ↔ `--ink-2`. `brand.500` ↔ `--brand-500`.

Required in every palette: `page`, `frame`, `surface`, `muted`, `sunken`; `ink`,
`ink-2`, `ink-3`, `ink-4`, `ink-inverse`; `line`, `line-strong`;
`brand-50/100/200/400/500/700/900`; `accent-*` where the product has a second
brand colour; `success`/`warn`/`danger`/`info` each with `-bg` and `-fg`; and
`--shadow-tint` as an `r g b` triple.

- **Colours are named by role** (`brand`, `accent`, `line`), never by hue
  (`navy`, `gold`, `green`), so a repalette is a one-file change.
- **Every value in `tailwind.config.js` is `var(--token)`, never a literal.** A
  literal compiled into `bg-surface` paints the dark frame white — the utility
  stops following the scope it lands in, and a theme remap can no longer reach
  it.
- **A theme is a token remap** (`.phone--dark`), never a `dark:` prefix and never
  a second set of utilities.
- **`.phone` sets `color: var(--ink)` itself.** A variable remap only reaches
  declarations that read the variable; text with no colour class inherits the
  *computed* colour from `body`, resolved in the light scope, and stays black in
  a dark frame.
- **Each product declares its reserved colours** at the top of the palette block:
  the one or two that carry product meaning and may not be reused. In a party
  game green may mean one role and black another; in a two-player game blue is X
  and rose is O; gold may mark a paid action and nothing else.
- **Adding a class means declaring it in `shared.css` in the same edit.** A class
  that resolves to nothing does not throw — it quietly does not paint, which is
  how `text-2xs` came to be used 186 times across three apps while declared in
  exactly one. The `tokens` check (§12) catches it.
- **A component class may not take a name Tailwind generates.** `.ring` looks
  free and is not: `ring` is Tailwind's focus-shadow utility, so a component
  class called `.ring` loses the cascade and paints a blue box round whatever it
  was meant to draw. The CDN build emits the utility whether or not you meant
  it, and nothing warns. Check the name against Tailwind's own before using it,
  or suffix it — `.ring-svg`.
- **One stylesheet per surface.** `shared.css` and nothing else — no
  `<flow>/<flow>.css`. A second sheet has no slot in §1, is loaded by some
  screens and not others, and puts one flow's rules where no token check will
  look at them. Its contents are either component classes, which belong in the
  third block, or Tailwind utilities that were never written as utilities.
- **Two tokens are published at runtime, not declared in CSS**: `--chrome-h` and
  `--stage-pad`, both set on the root by `_chrome.js`. Every read of them carries
  a fallback (`var(--chrome-h, 0px)`) so a page without the bar still lays out,
  and a token check must not flag them as undeclared.

---

## 9. The frame

- **390 × 844**, the device radius on a normal screen page, square and
  full-bleed under `?bare`.
- It **clamps to whatever is left under the bar** and scrolls its own content the
  way the phone does:
  `height: min(var(--frame-h), calc(100dvh - var(--chrome-h) - var(--stage-pad)))`.
  Never `transform: scale()` — a transform does not change layout height, so the
  frame still occupies 844px and the page scrolls to reveal a frame that was
  already drawn smaller.
- The stage's gutter and the frame's height subtraction read **the same
  variable**, or the two disagree and the frame is short by the gutter.
- **A screen with a modal over it carries `phone--modal`**, which stops the frame
  scrolling. `position: absolute; inset: 0` resolves against the frame's padding
  box, and in a scroll container that is the visible box pinned to the top of the
  scrollable area — so scrolling slid the backdrop off and left the card floating
  over nothing.
- **A modal card uses `bg-frame`, not `bg-surface`.** In a dark palette
  `--surface` is a translucent white tint, which is right on a solid page and
  wrong over a backdrop: the screen shows straight through the card.
- **A modal draws the screen underneath unchanged and inert.** A sheet does not
  redraw the screen it opens over, and every link in the underlay is blocked in
  the app, so it must not be a link in the wireframe either.
- **The device status bar is drawn.** The OS draws it, not the app — but the app
  pads for it, so a wireframe that omits it puts every screen ~44px too high and
  makes the first row look like it has more air than it will.

---

## 10. HTML or wiki — which holds what

- **HTML is the spec for anything visual** — layout, component inventory,
  placement, size, state (see C-16 in `pipeline`). The screen inventory is the
  `routes.js` route table, never a second list in Markdown.
- **A screen's notes live in the wiki, only where it has some** —
  `.context/wiki/surfaces/<slug>.md`, named by `routes.js`; every other screen
  has `notes: null`. The notes button renders it beside the screen on demand.
- The wiki also holds what a picture cannot: decisions and why, canonical values
  (prices, tier names, copy strings, enums), research, ops.
- **Where they disagree**: the HTML wins on layout and flow; the canonical-values
  page wins on prices, names and copy strings. Different columns, not a conflict.

### What a notes page contains

Decisions and constraints true of **that page** and invisible in its pixels.
Not a description of the screen — the screen is right there.

```markdown
---
last-verified: 2026-09-22
---
**A lead in bold, then the reason.** One paragraph per decision. Say what was
tried and why it lost, where that is what makes the decision stick.
```

No summary, no wireframe link, no related list: the screen and `routes.js`
already say those. The rules are canon's `wiki-schema` standard.

---

## 11. The designs describe the app that exists

This is the rule that matters most and is broken most often.

- **When a screen and its wireframe disagree, the wireframe is the spec** — for a
  product still being designed. For a product that has shipped, the *app* is the
  fact and the wireframe is the thing that is wrong. Fix the wireframe, or change
  it deliberately and say so in its notes page.
- **Read the source, do not remember it.** Icons come from the component the app
  imports. Names come from the data table. Copy comes from the i18n dictionary.
  Colours come from the app's theme file. A wireframe drawn from memory invents
  packs that do not exist, screens that were deleted, and copy nobody wrote.
- **A deliberate departure is allowed and must be recorded** in the screen's
  notes page, saying what the code does and why the drawing differs.

---

## 12. Checks

There is no lint and no build for a design set. **`canon check` runs the design
checks** for every surface under `.context/designs/<surface>/` that has a
`routes.js`, after every change:

| Check | Asks |
|---|---|
| **inventory** | is every file on disk declared in `routes.js`, and every declared file on disk? |
| **well-formed** | is every `<div>` closed exactly once, in order? |
| **links** | does every local `href` point at a file that exists? |
| **tokens** | does every class and `var(--…)` in the set resolve against `shared.css` + `tailwind.config.js`? |
| **click-through** | is every forward edge in `routes.js` a real link in the screen it leaves? |
| **flow-complete** | is every link between screens a declared edge? |
| **acyclic** | with states collapsed and `state`/`back`/`side` dropped, is the forward graph a DAG? |
| **routes** | is every app screen drawn, and does every drawing have an app screen? |
| **app-flow** | do the app and the chart navigate alike, in both directions? |
| **copy** | is every word a dialog or a toast puts on screen drawn somewhere? |

Two things are exempt from the link checks and from the chart: edges marked
`state: true`, which are not journey steps, and the links inside the *underlay*
of a modal screen, which the modal blocks in the app.

**acyclic** is the one that cannot be eyeballed at all, and the one whose
failure is worst — see §6.

click-through and flow-complete are a pair and a set needs both:

- **Every declared edge is a real link**, or the chart is a diagram of an
  intention. A chart that claims Home leads to the store, on a Home whose pack
  tile is a `<span>`, is exactly that — and the whole reason to draw screens in
  HTML rather than a design tool is that you can walk the product.
- **Every link is a declared edge**, or the chart quietly under-reports the
  product. This one found 24 missing transitions across two migrated sets: "Play
  Again", "Continue playing", "Save & go home", the resume banner, both upsell
  paths.

**Serve the set over http to look at it**, never `file://`. The notes drawer
fetches Markdown, which `file://` blocks; and a plain static server without
`Cache-Control: no-store` will serve you a stale stylesheet and make every visual
check a lie.

---

## 13. Where each part comes from

**The canonical set lives in the repo named in `copies.source`** in
`.claude/canon.yaml`. It should exercise nearly everything in this guide: the
reserved flows, a few domain flows, modal screens, a state variant, and at least
one edge of each of the four kinds. If it draws one theme only, the estate names
a second reference for a two-theme palette. **Copy from those and from nothing
else** — other sets may be on older versions of the shared files, and copying
from them silently reverts the bar, the chart, or both. A migration that copied
from the nearest set would look finished and be a version behind.

`canon check` holds the copied parts equal to the source, and
`canon copies --sync` repairs a drifted one.

| Part | Where it comes from |
|---|---|
| `_chrome.js` | copied **byte for byte**. Never edited per product |
| `_gallery.js` | copied **byte for byte**. Never edited per product |
| CORE block of `shared.css` | copied **byte for byte** — everything above the PALETTE banner |
| `index.html` | copied; change the `<title>` and nothing else |
| `screenshots.html` | copied; change the `<title>` and nothing else |
| PALETTE + components in `shared.css` | written for this product |
| `tailwind.config.js` | copied, then this product's own colour groups swapped in — most of the file is the shared token keys. Every value `var(--token)` |
| `routes.js` | written for this product |
| `<flow>/<screen>.html` | drawn |
| `brand/` | this product's artwork |

Those five copied files are the whole reason a set is legible at a glance. If a
product needs one of them to behave differently, change it in the source repo
and sync — that is a change to every set, not a local edit in one.

**A formatter is an edit, and it is the one that gets past everybody.** One
repo ran `prettier --write` on every `*.js` through lint-staged, so every commit
silently rewrote `_chrome.js`, `_gallery.js` and `routes.js` — quote style,
trailing commas, wrapped object literals. Behaviour identical; bytes not. That
is how a set ends up the only one whose bar and chart do not match the others,
with nobody having decided anything, and it survives being fixed because the
next commit does it again. **Add the shared parts to the repo's
`.prettierignore`** (or its equivalent) in any repo whose tooling formats
JavaScript:

```
.context/designs/*/_chrome.js
.context/designs/*/_gallery.js
.context/designs/*/routes.js
```

Check for it before trusting a drift report: a set can be one `prettier --write`
away from looking like it has drifted a version when it has not, and one commit
away from drifting for real.

### Building a new set

1. Read the app's routes, components, theme file and i18n dictionary first. If
   there is no app yet, the designs are the spec and this step is the brief.
2. Copy the five shared parts from the canonical set, per the table above.
3. Write the PALETTE block. Role names only. Declare the reserved colours.
4. Write `routes.js`: every screen, every state, every edge.
5. Draw the screens, one per file, no prose.
6. Write a notes page for every screen that has notes.
7. Run `canon check`. Open the set in a browser at ≥640px and walk it.

### Migrating a set that predates this guide

A set with no `routes.js` and no bar is not "an existing set to fix" — none of
the machinery it would be checked with is there yet. Do it in this order; each
step is checkable before the next one starts, and going out of order means
drawing screens against a manifest that is still moving.

1. **Inventory first, change nothing.** List every `.html` under the surface,
   and for each one decide: a screen, a state of another screen, or a file that
   should not exist. Two things are always the third case — an `index.html`
   inside a flow (§5) and a second frame in one file (§5). Write the list down;
   it becomes `routes.js`.
2. **Pin the CDNs.** A pre-standard set usually loads `cdn.tailwindcss.com` and
   `lucide@latest` with no version. Pin every one to the versions in §3 in a
   single mechanical pass, before anything visual is judged — an unpinned set
   is not the set you are looking at tomorrow.
3. **Copy the five shared parts** from the canonical set, per the table above.
4. **Write the PALETTE and `tailwind.config.js`** from the colours the set
   already uses. Role names, no hues, every config value a `var(--token)`.
   This is where a pre-standard set usually has literals; §8 says why they
   cannot stay.
5. **Write `routes.js` — flows and screens first, the graph second.** Order the
   flows by the reserved order. Give every screen its `screen` name, `status`
   and `notes` slug.
6. **Derive the edges; do not recall them.** Scan the real `href`s in every
   screen and declare one edge per link — the `flow-complete` check of §12 run
   as an authoring step, and on a 40-screen set the only tractable way. Then
   classify each: plain forward, `side`, `back`, or `state`. A set migrated from
   memory under-reports itself by about a quarter.
7. **Add `data-chrome` and `data-file` to every screen**, and the `routes.js` +
   `_chrome.js` lines to its tail. A screen whose `data-file` disagrees with its
   path logs a warning and appears nowhere.
8. **Fold stray per-flow CSS into `shared.css`.** A `<flow>/<flow>.css` has no
   slot in §1 and no way to be checked. Its rules belong in the components
   block, or they are Tailwind classes that were never written as classes.
9. **Deduplicate the brand artwork.** Any mark pasted inline into more than one
   screen becomes one file under `brand/` (§3).
10. **Write the notes pages**, then run `canon check` and walk the set in a
    browser.

**If the product has no splash screen**, `flow.start` is the first screen the
app actually opens on — Home, or the first onboarding step. `start` is required
and is what the column rank counts from; a chart with no declared start ranks
every screen at zero and draws one column.

### Fixing an existing set

1. Run `canon check` first — it tells you what is broken before you look.
2. Diff the set against the app: icon names, data tables, copy strings, screen
   inventory, navigation. Most drift is here, and none of it throws.
3. Check the frame fits with no page scroll, and that the screenshots sheet has
   no gaps or clipped corners.
4. Check the bar and CORE match the canonical set (`canon check` reports drift).
5. Re-run `canon check` and walk the set.

---

## 14. Known-wrong patterns

Things that have already been done wrong once. Do not repeat them.

| Pattern | Why it fails |
|---|---|
| `transform: scale()` to fit the frame | does not change layout height; the page still scrolls |
| Several frames in one file | no URL, no route entry, no link, no tile |
| A prose sidebar beside the screen | competes with the thing under review |
| A literal hex in `tailwind.config.js` | the utility stops following the theme scope |
| Hue-named colours (`navy`, `gold`) | a repalette becomes a rename across 500 files |
| A class used but never declared | resolves to nothing, throws nothing, paints nothing |
| Unpinned CDN | every set restyles itself overnight |
| Per-tile semantic colours where the app tints by category | one shelf reads as four unrelated things |
| The bar reading a palette token | the same control looks like a different control per product |
| Drawing states as chart nodes | the same screen appears twice |
| Inventing a screen, a pack, or a string | the set stops being a reference and becomes fiction |
| A per-flow stylesheet beside the screens | loaded by some screens, checked by nothing |
| Copying shared files from whichever set is nearest | older sets are behind; the bar silently reverts |
| A data-driven SVG pasted into every screen that shows it | five copies of one geometry, and the datum is the only line that should differ |
| A component class named after a Tailwind utility | the utility wins the cascade and paints something nobody asked for |
| The same sentence in a screen file and in its wiki page | two copies of one decision, and §10 says there is one |
