# Cíyán (词言) v0.4.1

An offline-first Mandarin flashcard PWA for iPhone, with one bundled master
collection, local progress, and explicit JSON backups to Files.

See [RELEASE_v0.4.1.md](RELEASE_v0.4.1.md) for current behavior and validation.
It supersedes earlier scheduling, session and optional-deck notes.

## Run and package

```bash
npm test
python3 package.py
```

The no-argument packager writes `dist/ciyan/`, ready for Cloudflare Pages.
`dist/` remains Git-ignored. The distribution ZIP has index.html at its root.
The Git ZIP includes history and release tags.

For local development, `python3 -m http.server 8765` serves the repository.
`python3 build_master.py` rebuilds the single runtime content asset from the
consolidated source. No runtime npm dependencies or remote content requests are
required. Older topic files are development sources, not optional app downloads.

## Study

Vocabulary, grammar assembly, drawing and Particle Zoo each have their own
scheduling record. Auto Study mixes enabled modes. Continuous study, undo,
skip, postpone and finish controls are available. Ratings preview their actual
predicted intervals using gradual scores and geometric interpolation.

Settings offers interval anchors, a live curve, a change-impact preview and a
choice between future-only application and recalculating existing due dates.
Auto Study weights and actual-versus-preferred distribution are visible.

## Content and progress

The full bundled master loads on refresh. In-app content edits are for the
current visit: export a complete master and manually load it after refreshing
if you want those edits. Learning records persist automatically in IndexedDB.
Export a full progress backup after each session to protect against browser data
loss. Full backup restoration resumes records and current input, with a fresh
undo boundary. Loading a master is content-only and never imports review records.

When updating an existing deployment, export progress, upload to the same address,
open online, close all old app windows, then reopen and confirm v0.4.1 in Settings.
The service worker waits for existing windows to close before activating.

## Testing limits

Automated tests exercise algorithms and UI handlers with DOM/IndexedDB mocks.
Browser launch is blocked in the build runtime; visual and physical-iPhone testing
remain unverified. Drawing is self-graded. Particle answers are explicitly authored.
