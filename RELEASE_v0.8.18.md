# Cíyán v0.8.18 — standalone deployment restored

Ciyan now builds both distribution targets from a single codebase.

- **AppLauncher submodule:** `dist/ciyan/` stays app-only. AppLauncher v0.1.2
  continues importing this Ciyan module and supplies the My Workspace PWA shell.
- **Standalone Worker:** `dist/standalone/` contains `index.html`, Ciyan
  assets, manifest, viewport lock, update mechanism and its own service worker.
  It opens directly to Ciyan Study (no launcher Home Screen).
- `wrangler.jsonc` points Workers Static Assets at `./dist/standalone` and
  retains the existing Ciyan worker name. Run `python3 package.py` (or
  `npm run build`) before `npx wrangler deploy` in Cloudflare Workers Builds.
- The Ciyan Settings Save & Exit control appears only within AppLauncher;
  standalone Ciyan keeps its normal settings and bounded update/reload button.
- Content-hashed standalone service-worker caches replace earlier Ciyan shell
  caches but do **not** delete chapter-content/font/study storage.
- The 0.8.17 → 0.8.18 backup migration is an identity migration; user progress
  and existing local data are not transformed or reset.

Cloudflare Workers Builds: build command `python3 package.py`, deploy command
`npx wrangler deploy`. For Cloudflare Pages, use `dist/standalone` as the
build output directory.

Study data in distinct installed iOS web apps does not sync. Use Ciyan's
full backup export/restore to move learning progress between installations.
