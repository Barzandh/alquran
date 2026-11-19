# AlQuran — instructions for Claude
Technical notes only (this repo is public). Owner's preferences, history and lessons: private playbook repo
`Barzandh/claude-playbook` → `projects/alquran.md`, `lessons/`.

## What this is
Offline Quran / prayer-times / azkar app. Web app (GitHub Pages, installable PWA) + Android APK (WebView wrapper with
native alarms) + Cloudflare Worker for lock-screen notifications and diagnostics.

## Layout
- `index.html` — the whole app (UI, i18n packs, data loaders). Key areas: `REM_DEFAULTS`/`remList`/`remOccur`/`remFire`
  (reminders), `apkSchedule` (Android alarms), `DX` (diagnostics), `PUSH` (server push schedule), `RBX`/`RB_THEMES`
  (home board themes), `I18N`/`AR`/`KU`/`KB` + `<script id="i18n-xx">` packs.
- `sw.js` — offline cache with per-file fingerprints (`HASH`), patch updates, push + notification handlers.
- `version.json` — what the app checks for updates.
- `data/`, `fonts/`, `icons/` — content and assets. `android/` — APK wrapper. `tools/` — data build scripts.
- `push/` — Cloudflare Worker `alquran-push` (see `push/README.md`).

## Build / test / publish
1. Edit with exact-match patches (assert match counts).
2. Bump `BUILD` (sw.js) and `__BUILD__` (index.html) to the same `YYYYMMDD.HHMMSS`, then regenerate fingerprints
   (`HASH` in sw.js + `version.json`) with the playbook's `swhash.py` logic: sha256[:16] of every SHELL file.
3. Tests: `cd push && npm test`; `python3 push/test/e2e_app.py` (Chromium, local Worker); syntax-check every inline script.
4. `git fetch`; require `HEAD..origin/main` = 0; commit; push `main` and `main:gh-pages`. Never force-push.
5. Worker changes: deploy through the Cloudflare API connector (download live modules, patch, verify SHA, upload with
   `keep_triggers`), then run the `live-check` workflow with the new BUILD.

## Rules
- Visual/design changes: preview first, apply only what was approved.
- APK (`apk.yml`, manual dispatch) only for major final builds.
- Cloudflare must stay on the free plan; keep per-minute work tiny (indexed queries, one round trip when idle).
- No secrets in this repo.
