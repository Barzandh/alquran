# alquran-push — lock-screen notifications + diagnostics server

Cloudflare Worker + D1 (free plan). Code: `src/`. Tests: `npm test` (unit + simulated week) and
`python3 test/e2e_app.py` (real app in Chromium ↔ this Worker on Node). Both also run on GitHub (push-tests).

## Resources (Cloudflare account of Barzandh)
- D1 database `alquran-push`, id `068dccbe-b39b-43fd-8685-0a7e2db2d880` (EEUR). Schema is created by the Worker itself.
- Worker `alquran-push` — live at https://alquran-push.barzandh.workers.dev (account workers.dev subdomain: barzandh). Cron * * * * *.

## Deploy (fully automated, through the "Cloudflare API" connector = https://mcp.cloudflare.com/mcp)
Use its `execute()` with the Workers API (JSON, no wrangler needed):
1. Account id: `GET /accounts`.
2. Upload the script as ES modules: `PUT /accounts/{id}/workers/scripts/alquran-push` (multipart: metadata
   `{ main_module: "index.js", compatibility_date: "2025-09-01", bindings: [{ type: "d1", name: "DB", id: "<D1 id>" },
   { type: "plain_text", name: "SUBJECT", text: "https://barzandh.github.io/alquran/" }] }` + `index.js` + `webpush.js`),
   or the JSON Workers API (`/workers/workers` → `/versions` with base64 modules → `/deployments`).
3. Cron: `PUT /accounts/{id}/workers/scripts/alquran-push/schedules` body `[{ "cron": "* * * * *" }]`.
4. workers.dev address: `POST /accounts/{id}/workers/scripts/alquran-push/subdomain` `{ "enabled": true }`;
   subdomain from `GET /accounts/{id}/workers/subdomain` → URL `https://alquran-push.<subdomain>.workers.dev`.
5. Check `GET <URL>/v1/health`.

## After deploy
- Put the URL in `PUSH_URL_DEFAULT` in `index.html`, bump BUILD (sw.js + `__BUILD__`), run `swhash.py`, publish to main + gh-pages.
- Live check: register a test device, `/v1/test`, then read `diag` / `events` in D1 through the connector.
- Diagnostics: `SELECT * FROM diag WHERE code = '<6-letter code>' ORDER BY at DESC` (code shown in the app under More).

## Free-plan budget
Cron 1440 runs/day, ~2 rows read per idle query; a push ≈ 1–2 ms CPU (limit 10 ms), max 6 per run.
Schedule sync writes only changed rows. Account has no payment method, so nothing can be billed.
