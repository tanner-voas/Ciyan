# Cíyán (词言) v0.5

Offline-first Mandarin study PWA for iPhone. **Study is the home page.**
Includes vocabulary recognition, sentence assembly, self-graded handwriting,
particle/classifier placement and weighted-random Auto Study. The single
bundled master currently contains **2,278 words** and **1,549 grammar cards**.

Read [RELEASE_v0.5.md](RELEASE_v0.5.md) for the current, authoritative details
on eligibility, continuous session behavior, daily caps, score scheduling,
filters and backups. Previous release notes remain in the Git history as
historical design references; they are not the current specification.

## Deployment

From this repository, run:

```bash
npm test
python3 package.py
```

Upload the contents of `dist/ciyan/` to Cloudflare Pages (or use the separate
Cloudflare ZIP, with `index.html` at its root). The packager requires only the
Python standard library and can run from any working directory. `dist/` is
Git-ignored. The PWA caches the static app and master content for offline use.

**Existing installation:** Export a full progress backup first, deploy to the
same Cloudflare URL, open once online, close all old app/Safari windows, and
reopen to confirm v0.5 in Settings. All progress is locally stored in IndexedDB;
manual JSON backups to iPhone Files remain the durable independent copy.

## Master collection

The app always loads one bundled master content file. It has no optional-deck
management interface. Vocabulary/grammar edits are for the current visit:
export the complete master and explicitly reload that saved file after a
refresh if you want the edits. Reviews and settings save automatically.

`python3 build_master.py` regenerates the bundled runtime asset from the
consolidated source (`decks/all-decks.json`, a historical source pathname).
The individual archived topic-source files in Git are not shipped in the PWA.
No runtime npm dependencies are required.

## Data protection and limitations

Full backups include review histories, independent skill schedules and current
settings. Session filters are excluded. Full backup restoration uses the
backup's settings. Offline storage can be evicted by the browser; export often.

Automated tests cover logic and UI handlers, but do not substitute for physical
iPhone validation. Drawing is deliberately self-graded. Particle exercises
have authored, context-specific accepted answers and explanations.
