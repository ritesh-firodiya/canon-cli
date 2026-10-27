# Store listing

How an app's App Store and Play Store listing lives in `.context/listing/`.
Opt in with `standards: [store-listing]`.

`listing/` is outside the app's `assets/`, so it is never bundled into the app.

## The tree is fastlane's, verbatim

```
.context/listing/
├── listing.md                 the authored source — fenced blocks generate the .txt files
├── goldie.config.ts           screenshot and preview capture
├── android/metadata/          supply metadata_path — ONLY locale folders
│   └── en-US/
│       ├── title.txt ≤50 · short_description.txt ≤80
│       ├── full_description.txt ≤4000 · video.txt (a YouTube URL)
│       ├── changelogs/<versionCode>.txt · default.txt ≤500
│       └── images/icon.png · featureGraphic.png
│                  phoneScreenshots/NN-<screen>.png
│                  sevenInchScreenshots/ · tenInchScreenshots/
├── ios/
│   ├── metadata/              deliver metadata_path — ONLY locale folders + review_information
│   │   ├── copyright.txt · primary_category.txt · secondary_category.txt
│   │   ├── app_rating_config.json    the advisory keys fastlane has no .txt for
│   │   ├── review_information/*.txt
│   │   └── en-US/name.txt ≤30 · subtitle.txt ≤30 · description.txt ≤4000
│   │             keywords.txt ≤100 · promotional_text.txt ≤170 · release_notes.txt
│   │             support_url.txt · marketing_url.txt · privacy_url.txt
│   ├── screenshots/<locale>/      deliver screenshots_path
│   ├── app-previews/<locale>/     15–30s, 886×1920 H.264
│   └── iap.md
└── out/                       gitignored — the capture tool's raw output, before the mapper
```

The leaf names are **not ours to choose**. `supply`, `deliver`, `screengrab`,
F-Droid and IzzyOnDroid all parse these exact strings — `full_description.txt`,
`phoneScreenshots`, `changelogs/<versionCode>.txt`. Rename one character and a
zero-maintenance upload becomes a custom transform kept up in every repo
forever.

**Each store folder is self-contained, and `metadata/` is why.** Both tools
treat every *directory* inside `metadata_path` as a locale — deliver's
`Loader.language_folders` hard-errors on any subdirectory that is not a language
name (`deliver/lib/deliver/loader.rb:167`), and supply's `all_languages` is
literally `Dir.entries(metadata_path)`. Worse, deliver runs
`FileUtils.mkdir_p(screenshots_path)` *before* it validates, so putting
`screenshots/` directly inside `ios/` would have deliver create the offending
folder and then abort on it, on a clean clone.

So the locale tree gets its own `metadata/` level, and everything else a store
needs is a sibling of it, inside that store's folder:

```ruby
supply(metadata_path: ".context/listing/android/metadata")
deliver(metadata_path:     ".context/listing/ios/metadata",
        screenshots_path:  ".context/listing/ios/screenshots",
        app_previews_path: ".context/listing/ios/app-previews")
```

Files at `metadata/` root are fine — only directories are validated.

## Rules

1. **`listing.md` is authored; the `.txt` files are generated from it**,
   committed, and never hand-edited.
2. **`listing/ios/` is canonical for Apple.** A repo-root `store.config.json` is
   generated from it or deleted. One format for both stores, and
   `deliver download_metadata` pulls the **live** listing down so you can diff
   it, which EAS metadata cannot do.
3. **deliver infers the device from image resolution**, not folder name, so a
   screenshot one pixel off lands on the wrong device silently.
4. **Screenshot file names are `NN-<screen>.png`, zero-padded.** fastlane uploads
   in alphanumeric file name order, so `10.png` sorting before `2.png` is a real
   bug, not a cosmetic one.
5. **A locale appears in `listing/*/metadata/<locale>/` and nowhere else**, and
   adding one means adding it to *both* stores or writing down in `tasks.md` why
   not. An app that ships three languages with an English-only listing is a gap,
   and it has to look like one.
6. **Store images are exports.** `listing/*/images/` is generated from
   `designs/brand/` (see `design-sets` §1).

## Screenshots and previews

They are captured by **goldie** (`goldie all --config
.context/listing/goldie.config.ts`). Its output axes are inverted from
fastlane's, so a mapper moves them:

| goldie output | fastlane destination |
|---|---|
| `out/screenshots/pixel-10-pro/<locale>/` | `android/metadata/<locale>/images/phoneScreenshots/` |
| `out/screenshots/iphone-6.9/<locale>/` | `ios/screenshots/<locale>/` |
| `out/previews/iphone-6.9/<locale>/preview.mp4` | `ios/app-previews/<locale>/` |

Run it as `pnpm listing:capture`, never `goldie all` alone: goldie writes only
to the gitignored `out/`, and the command's last step is the mapper.

**The store art has a house style**, the same in every app: `template:
"showcase"`, `layout: "classic"`, `screenOnly: true`, Merriweather, the
`17-pro-silver` frame. Only the background is the app's own. It is written in
`goldie.config.ts` and again in `goldie.design.json` — the file `goldie studio`
saves and the CLI lays over the config. An estate check should fail when an app
differs from the reference repo's style or when its two files disagree.

## Release notes come from `features/`

A feature page carries `release: x.y.z` and a `## Store copy` blockquote (see
`context-layout`). `pnpm listing:notes` (`scripts/release-notes.mjs`, copied
from the reference repo) collects the blockquote from every feature with that
release and writes both `listing/ios/metadata/en-US/release_notes.txt` and
`listing/android/metadata/en-US/changelogs/<versionCode>.txt`. That makes the
board the *source* of the What's New text, so it earns its keep every release
instead of rotting the way every roadmap document does.

## Store files outside `listing/`

- `legal/declaration.yml` — the single source for privacy declarations, in
  Apple's `NSPrivacyCollectedDataType` vocabulary. The legal pages and
  `legal/play-data-safety.csv` are produced from it, never hand-edited.
- `metrics/aso/keywords.yml` (authored) and `metrics/aso/scans/<date>/ranks.csv`
  — keyword tracking.
- `listing/ios/iap.md` — the in-app purchases as the store shows them.
