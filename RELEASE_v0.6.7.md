# Cíyán v0.6.7 — Font Apply Workflow, Backup Safety & Scheduler Audit

The final planned v0.6.X release before the graded reader (subject to successful iPhone testing).

## Font selections

Select difficulty and font independently, then tap **Apply font**. Until Apply, the current Chinese font and saved setting remain unchanged. The font choice selector updates with the chosen difficulty without trying the first font prematurely. **Discard changes** restores the applied selection. Apply tests the requested font; Mixed tests both. A failed check shows an error and reverts the controls to the last accepted font, with no database write. The current applied font remains visible in the preview.

The local names reported on the user's iPhone replace the old guessed font names, both in the visible list and as first aliases in the font declarations:

| Difficulty | First font | Second font | Mixed |
|---|---|---|---|
| Beginner | iPhone default | — | — |
| Intermediate | `xiaowei` | `HappyZcool-2016` | Both |
| Advanced | `YRDZST` | `Ma Shan Zheng` | Both |
| Expert | `Muyao-Softbrush` | `Zhi Mang Xing` | Both |

No font binaries are bundled. CSS-only deterministic per-character mixing is retained with stable sizes and no thousands of character `<span>` elements. The 405 KB Mixed stylesheet compresses in ZIP. **Installed iOS fonts may still be inaccessible to Safari/WebKit**. Physical iPhone verification is necessary; the app refuses an unverified font rather than silently using a fallback.

## Backup and restore reliability

- Full backup export first serializes and reparses its JSON using the actual backup validator. Counts of words, grammar, vocabulary/grammar/drawing histories, sessions, all skill schedules, and selected font settings must survive before the app offers the file to save. Invalid or oversized exports show an error, not a false success.
- Full backup JSON uses compact serialization, which reduces size and parsing overhead. The HSK4 mock produced approximately **21.7 MB**, versus approximately 34 MB if prettified. The same 40 MB import size limit is enforced for exported files.
- Restoring a backup retains content already in the current and bundled masters, while the backup remains authoritative for historical learning records and settings. ID collisions are reported, not silently overwritten. The merge has independent regression tests.
- After restoring and merging content, the app treats the result as **not yet independently backed up** and asks the user to export a new snapshot. No data is deleted on a failed validation or failed database transaction.
- Backup migration from v0.6.6 → v0.6.7 is an explicit identity-safe step. Historical review records, scores, character ratings, and tags are not rewritten merely because the app version changes.

## Scheduling calibration

A mature word graded **Again** previously kept a high gradual score and could be scheduled days later despite being forgotten. The score remains gradual, but a score-mode Again review is **due within the configured grade-0 interval**, and Hard within the configured grade-1 interval. These caps also apply when recalculating existing schedules, so scheduling previews and actual deadlines agree. Good/Easy continue to use the configured geometric interpolation and extrapolation. FSRS mode is unchanged.

No global refit to historical user data or speculative change to the graded scores was made; more comprehensive recalibration should await real longitudinal recall histories.

## Performance

- The Study tag-odds cache now uses stable state-object identities instead of sorting and joining all schedule IDs each render.
- Existing paginated word/grammar lists, chunked IndexedDB review logs, and content caches remain in place.
- Compact backup JSON avoids expensive whitespace generation and reduces mobile file transfer/storage overhead.
- The full 11,893-word / 3,444-grammar built-in collection was used for a matcher performance probe. Results are hardware-dependent and are **not** a physical iPhone benchmark.

## Verification

- **171 automated tests passed, zero failures.**
- Real HSK4 mock full-backup round trip retained 11,893 words, 3,469 grammar entries, 23,527 vocabulary reviews, 792 grammar reviews, 656 skill reviews, 114 mixed sessions, all schedule counts, and stable word/grammar IDs.
- Drawing and Particle Zoo remain unchanged except for shared backup and rendering infrastructure.
- `python3 package.py` produces `dist/ciyan` for Cloudflare Pages; `dist` remains Git-ignored.
- v0.7.0 graded reader is not included.

### Installation caution

Export your existing v0.6.6 progress backup before deploying. On the iPhone, open Settings → Chinese typography, choose both selectors, then tap **Apply font**. Test each font and Mixed. iOS installation alone cannot guarantee availability in a webpage; bundling properly licensed font assets remains a possible future solution if Safari prevents access.
