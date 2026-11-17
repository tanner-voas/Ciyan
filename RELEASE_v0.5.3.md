# Cíyán v0.5.3 — version-stamped backups; clean development baseline

v0.5.3 is a small maintenance release on the exact v0.5.2 master collection.
There are **2,278 vocabulary words and 1,549 grammar entries**, with no changes to
card content, scheduling formulas, filters, or study modes.

## Full backups now identify their producing application version

Every full backup exported from v0.5.3 includes the top-level property:

```json
{
  "format": "ciyan-backup",
  "version": 2,
  "appVersion": "0.5.3",
  "exportedAt": "...",
  "state": {"appVersion": "0.5.3"}
}
```

`version: 2` remains the **JSON backup format version**; `appVersion` is the
**application release that created the backup**. The local state also records
`appVersion`, allowing the app to identify a fresh v0.5.3 installation.
Backup filenames include `v0.5.3` for easier identification in Files.

The backup-version adapter (`backup-versions.js`) has an ordered release-to-release
migration table. Future changes that actually need a data transformation must add
**one explicit adjacent-version step for every release transition**, including
identity steps when nothing changes. Every step operates on a staged copy in
sequence, never on the original backup; a missing step or a backup from a newer
release fails with an explanation instead of guessing. For the current release,
`0.5.2 → 0.5.3` is an identity step (no data changes). The previous app did not
include `appVersion`; unversioned backups remain accepted by schema validation
but receive **no guessed version-specific transformations**. They cannot be
reliably attributed to a particular release. Future migrations will use the
recorded producing version rather than heuristics over field values.

## No automatic historical value changes

Removed automatic historical correction from normal app loading and full backup
restoration. This includes:

- The v0.5.2 one-time conversion of stored tag weight `1 → 0`.
- The v0.5.1 inference-based update of old retry-interval defaults.
- The earlier automatic replay and rewrite of historical review scores.

Tag preferences, due dates, retry intervals and scores are **never modified on
loading merely because they resemble old defaults**. Normal validation and the
initialization of **missing** new-tag weights to zero still apply. Explicit
user-initiated scheduling changes continue to behave as configured.

## One-time clean start

As explicitly requested for this development release, the **first launch of
v0.5.3 discards the older local app state** (including settings, reviews and
in-progress sessions), loads the bundled master, and starts with empty learning
records and default settings. This is an intentional one-time reset, not a
silent migration. Subsequent v0.5.3 reloads **preserve the new state normally**.
Manually restoring a backup is a separate, explicit action and remains available.

This one-time clean-start rule belongs **only to v0.5.3**. Later releases should
not repeat it; their migration support should rely on recorded versions and
sequential tested transforms once real usage data exists.

## Validation and update guidance

Automated checks cover version stamps, a no-op sequential step, legacy unversioned
backups, rejection of unknown or future versions, preservation of custom weights,
retry intervals and scores, and first-launch reset versus same-version persistence.

The deployment includes the version adapter in its offline precache. Real iPhone
Safari visual validation is not performed by the build environment.

Because v0.5.3 intentionally resets previous local usage, export a v0.5.2 backup
first **if you want to retain any test progress**. Upload the Cloudflare deployment
ZIP to your existing Pages project, close old app windows, and reopen online.
