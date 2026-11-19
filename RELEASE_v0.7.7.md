# Cíyán v0.7.7 — Cloudflare Pages Git deployment

This is a **deployment-only** release; no reader, deck, learning or scheduling
behavior changes. It keeps user data in the browser as before.

- Add `npm run build` as a stable Cloudflare Pages build command, invoking the
  same vetted source-to-static-asset packaging logic as manual deployments.
- Configure Cloudflare Pages Git integration with `main`, no framework preset,
  repository root `/`, build command `npm run build`, and output `dist/ciyan`.
- Bump the app, package and PWA document versions to 0.7.7; rotate the offline
  service-worker cache to `ciyan-shell-v7.7` so releases do not mix cached code.
- Add an identity-only upgrade step for v0.7.6 backups; no user data migrates.
- Update version-aware tests and document the difference between Cloudflare
  Pages and the existing Worker dashboard and the risk of domain changes.

Verification: run `npm test` and `npm run build`. The built directory must
contain `index.html`, `sw.js`, `_headers`, `chapters/index.js`, and all chapter
ZIP files, but not source documents, tests or reference chapters.
