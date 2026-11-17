# Cíyán (词言) v0.5.3

An offline-first Mandarin flashcard PWA with a **single master collection**, local progress, four study modes, continuous sessions and JSON backups to Files. This release retains **2,278 vocabulary cards and 1,549 grammar entries**.

Read [RELEASE_v0.5.3.md](RELEASE_v0.5.3.md) for the version-stamped backup design, removal of automatic historical value adjustments and one-time clean state reset. [RELEASE_v0.5.2.md](RELEASE_v0.5.2.md) covers the previous release. The previous release notes are in [RELEASE_v0.5.1.md](RELEASE_v0.5.1.md) for the v0.5.1 changes, including overdue weighting, new-vocabulary tag weights and grammar-context selection. [RELEASE_v0.5.md](RELEASE_v0.5.md) documents the underlying continuous study and session behavior.

## Develop and package

```bash
npm test
python3 package.py
```

The packager needs no arguments and creates `dist/ciyan/` from any working directory, ready for Cloudflare Pages. This folder is ignored by Git. The full Git archive includes `.git` history and release tags.

## Settings and backup

Settings → Review timing configures score anchors. Settings → **New vocabulary · tag weights** shows one configurable weight per leaf tag (default 0, including negative and fractional numbers), with inclusive global odds for drawing an unstudied vocabulary word from each tag. **Apply** explicitly updates the weights and recalculates odds. These preferences persist through full progress backups; they are not part of the master content export.

Scores are independently scheduled for vocabulary, grammar, drawing and Particle Zoo. Full backups include review history and settings, but not temporary session filters. Every v0.5.3 full backup records `appVersion: "0.5.3"` separately from the JSON format version. See `backup-versions.js` for the explicit adjacent-version migration registry. Export progress to iPhone Files regularly; the browser's local data can be removed by iOS.

## Update procedure

**v0.5.3 intentionally starts clean on the first launch from any earlier build.** Export a backup first if you wish to preserve even test progress. Upload the Cloudflare ZIP to the same deployment, then close all old PWA windows and reopen online. Check Settings for **v0.5.3** before resuming. Subsequent v0.5.3 refreshes preserve new usage normally. The service worker does not forcibly take over existing tabs mid-session.

Automated tests cover algorithms and simulated UI interactions. Physical iPhone/Safari visual validation remains unverified in the build environment.
