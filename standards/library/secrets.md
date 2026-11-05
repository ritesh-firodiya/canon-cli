# Secrets

Every secret is backed up the moment it exists. Opt in with
`standards: [secrets]`. The principle is C-10.

Keep one offline backup folder for every credential, outside every repo. It is
not a repo and never will be — that is what makes it safe to hold plaintext
credentials. It mirrors the path layout of the repos, so restoring a file is a
straight `cp` back. The owner decides where it lives and writes that path in
the `CLAUDE.md` above the repos.

**Whenever a secret is created, rotated, or first needed, copy it into the
backup folder in the same run and add its line to the folder's `INVENTORY.md`.**
Not "later", not "once it works" — a secret that exists in only one place is
already a lost secret. This covers:

| Trigger | What lands in the backup |
|---|---|
| New app scaffolded | its `.env`, `eas.json`, `app.config.ts` skeleton |
| EAS project created | `eas env:list --format long` per environment |
| RevenueCat configured | the `EXPO_PUBLIC_REVENUECAT_*` keys |
| iOS signing set up | `.p12`, `.p8`, `.mobileprovision`, `credentials.json` |
| Play Console wired | `play-service-account.json` |
| Android signing set up | `keystore.jks` and its passwords |
| AdMob wired | the `*_AD_ID` values |
| Firebase project added | `google-services.json`, `GoogleService-Info.plist` |
| Any new API key or token | the `.env` it lives in |

Rules that go with it:

- `INVENTORY.md` records **key names only**. Never write a secret value into a
  Markdown file, a commit message, or a chat reply.
- Never commit a real secret to a repo. `.env.example` is committed; `.env` is
  not. If one is already tracked, untrack it — do not just add it to
  `.gitignore` and move on.
- The folder is a snapshot, not a sync. Re-copy after every rotation.
- A secret-leak scan must not start failing because of a new secret.
