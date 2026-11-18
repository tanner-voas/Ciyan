# Cíyán v0.6.4 — responsiveness and storage optimization

## What changed

- **20-entry pagination** in both Words and Grammar, with First / Previous / Next / Last navigation, total page count, and filtering that returns to page 1. No more growing lists of 80+ rows or rendering thousands of grammar entries at once.
- **Fast grammar indexes**: grammar tags use a cached vocabulary Map instead of repeatedly scanning all words; grammar usage scores index recorded attempts once instead of filtering the complete history per sentence.
- **Search-result caching**: pagination reuses filtered/sorted results until content, scores, or filters change. Word and grammar ID lookups also use cached maps.
- **Smaller in-memory transactions**: studying clones only mutable progress structures; the large master dictionary and immutable historical review objects remain shared between snapshots. Editing content still takes a full safe copy.
- **Atomic, segmented IndexedDB persistence**: the master content is stored independently from active progress, and review logs are stored in 256-record chunks. Normal grading updates only changed chunks and the compact state metadata. All changes remain synchronously awaited and committed in an atomic IndexedDB transaction, not merely cached in memory.
- **Faster Stats**: activity totals, upcoming review forecasts, and particle-error counts use one-pass aggregation and short-lived cached indexes rather than repeatedly scanning histories.
- **Backup format unchanged**: independent full JSON export still includes every word, grammar entry, setting, and review. Previous backups through v0.6.3 can be imported. A first save after updating from v0.6.3 performs a one-time atomic conversion of existing local data, not a cleanup or reset.

## Performance measurements (local Node benchmark with the v0.6.3 HSK4 mock backup)

- Grammar tags across 3,469 mock grammar entries: **approximately 1,249 ms → 21 ms**.
- Full-state clone: **approximately 170–220 ms** before optimization; mutable-progress clone: **approximately 6–10 ms** after optimization.
- DOM render size: **20 visible collection items per page**, rather than 80 words or every matching grammar entry.

These are local benchmark figures, not iPhone Safari timings. Review persistence also avoids rewriting the entire historical log, though device-specific latency depends on Safari and storage performance.

## Data integrity

- The bundled v0.6.3 dictionary, synonym mapping, context sentences, and scheduling algorithms are unchanged.
- No mock backup or debug history is bundled in this repository or the Cloudflare Pages distribution.
- The new storage layout stays in IndexedDB and does **not** eliminate the need to export a separate full backup to iPhone Files.
- Do not downgrade an already-updated local database to v0.6.3. Export a fresh full backup before installing this release.

## Validation

151 automated tests pass, including a simulated IndexedDB persistence reload, chunked log append/deletion, backward backup migration, pagination interactions, and review session regressions. No physical iPhone Safari benchmark was run in this environment.
