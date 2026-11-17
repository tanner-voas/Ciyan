# Cíyán v0.5.4 — No automatic local-data reset

This is a narrow safety correction to v0.5.3. It does **not** change the
bundled master collection (2,278 vocabulary words / 1,549 grammar entries),
timing rules, study sessions, tag weighting, or review records.

## What changed

The v0.5.3 startup routine incorrectly treated any local state with an older
`appVersion` as an instruction to create a fresh state. That discarded review
history, skill schedules, tag preferences and other user settings on the first
launch after updating. **This behavior has been removed.** The request was that
the user would choose when to clear local progress or browser storage manually.

v0.5.4 creates a new empty state **only when IndexedDB contains no saved state**.
If a state exists, it is loaded and structurally normalized while retaining
review history, due dates, scores, settings, and user choices. A mismatching
app-version string alone never deletes or resets anything. Loading an existing
state does not write it back merely because its app version differs.

A subsequent user-initiated save records `appVersion: "0.5.4"` in the local state
metadata, without changing existing learning records. The explicit
**Settings → Clear learning records** action remains the way to reset progress.
Clearing Safari website data or reinstalling remains under the user's control.

## Backup version rules

New full backups record `appVersion: "0.5.4"`. The sequential backup-migration
registry includes a reviewed **identity step** `0.5.3 → 0.5.4` in addition to
the earlier identity step `0.5.2 → 0.5.3`. Neither modifies saved scores,
retry settings, tag weights or learning records. An unstamped historical backup
continues to receive no guessed version-specific transformations.

The application/backup format version remains `2`.

## Limitations and recovery

This patch **prevents future automatic resets**. It cannot restore records that
v0.5.3 might already have deleted when launched. If needed, use a manual full
backup taken before that reset. Back up the current state before updating the
Cloudflare Pages deployment; close previous app windows and reopen once online.

## Verification

Automated tests check preservation when upgrading from an older local version,
retention across refreshes, preservation of review history, schedules and
settings after a normal user edit, fresh initialization only on an empty
store, version-stamped backups and identity-only migration. Tests also include
the app's existing regression suite. These are simulated browser tests; actual
iPhone Safari deployment remains unverified.
