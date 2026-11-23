# Ciyan v0.9.11 — Smaller cloud backups and clearer status

- Dictionary/grammar content remains in its own content-addressed chunks, independent of review schedules, settings and reader progress. Opening a chapter may still genuinely add new vocabulary or change reader lexicon tags.
- Reader bookmark notifications that equal the saved position and playback settings no longer create an unnecessary local revision.
- Cloud library v0.1.5 stores each reader's stable catalog, per-chapter content, bookmarks and reader-level cursor/progress in independently hashed sections; skill schedules are split by record across buckets.
- Backups show red only on errors, yellow when pending, a yellow-rimmed pie filling green for acknowledged upload sections, and green after confirmed backup. Accessibility labels report acknowledged/total sections.
- Home/Refresh avoids a network request when the active cloud profile revision is already verified; the manual Sync button still explicitly checks for changes.
- Service-worker cache version derives from package.json instead of using a hard-coded old version.

**Upgrade behavior:** The first post-upgrade sync may write new reader and skill-scheduling partitions once. Old cloud revision layouts remain readable; existing dictionary/history object hashes are reused where unchanged. No profile or backup migration is required.

**Deployment order:** Publish PWA-GoogleDrive v0.1.5; let the Ciyan dependency Action update its submodule; then apply Ciyan v0.9.11 and let AppLauncher update from Ciyan. Do not manually advance the AppLauncher gitlinks.
