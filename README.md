# Cíyán (词言) v0.5.4

Offline-first Mandarin flashcards, one bundled master collection, four
independent study modes, continuous sessions, and local JSON progress backups.
The master contains **2,278 vocabulary words and 1,549 grammar entries**.

**Current release:** [RELEASE_v0.5.4.md](RELEASE_v0.5.4.md). This fixes an
incorrect first-launch reset from v0.5.3. **Updating does not automatically
clear local study progress or settings.** New data is created only when there
is no saved local database. Clear progress only through the explicit Settings
action or by clearing website storage yourself. If an older release already
deleted records, restore from an earlier full backup; the new version cannot
reconstruct missing records.

Earlier notes: [v0.5.3](RELEASE_v0.5.3.md) documents versioned backups;
[v0.5.2](RELEASE_v0.5.2.md) covers neutral leaf-tag weights and study counts;
[v0.5.1](RELEASE_v0.5.1.md) covers weighted new vocabulary and due selection;
[v0.5](RELEASE_v0.5.md) covers continuous study.
The v0.5.3 one-time-reset instruction is historical and **superseded** by v0.5.4.

## Development and deployment

```bash
npm test
python3 package.py
```

The no-argument packager writes the Cloudflare-ready static site to
`dist/ciyan/`, regardless of the current working directory. The directory is
Git-ignored; the Git ZIP includes the repository history, release tags,
tests and the packaging script.

## Backups and settings

Progress is saved in IndexedDB. Export full backups to iPhone Files to protect
against accidental browser data removal. Every current full backup records
`appVersion: "0.5.4"`, in addition to backup format `version: 2`. Restore
migrations are ordered release-to-release, with explicit no-op steps when
nothing needs converting. No automatic value correction or clearing occurs
based solely on a saved app version.

Tag weights, scheduling controls, scores and histories are part of full backups.
Temporary study filters are not. Content edits are exported or reloaded as one
master collection; the app bundles the canonical master by default.

For updates: export a full backup, deploy the Cloudflare ZIP to the existing
project, close old PWA windows, and reopen online to let the updated service
worker activate. Physical iPhone/Safari visual verification was not possible in
the build environment.
