# Cíyán v0.5.5 — expanded bundled vocabulary and synonym navigation

This is a vocabulary-content update to v0.5.4 with one new UI feature.
No review scoring, due-date, tag-weight, session-selection, grammar exercise,
Particle Zoo, drawing, or backup schedule adjustments are performed.

## Master collection

- **11,760 distinct vocabulary words** (the original 2,278 plus 9,482 new
  entries from the HSK 3.0 expanded word list).
- **1,549 unchanged grammar entries.** The added vocabulary intentionally
  does not require grammar examples. Existing examples and their stable IDs
  remain intact.
- Existing cards retain the same Chinese headwords, IDs, pinyin, English
  definitions, tags, and metadata. Existing review IDs remain valid.
- Every new entry has Chinese characters, tone-marked pinyin, an English
  definition and its correct HSK 3.0 band where available.
- **2,682 newly added entries** additionally carry appropriate existing
  topical tags. Tags are conservative: if there was no clear, relevant topic
  match, an entry remains HSK-only. Personal tags such as "visited" are
  never inferred. Categories use the existing paths, not a new taxonomy.

## Synonyms

- The project includes the audited v3 database's **3,088 undirected pairs**.
  They appear as 6,176 reciprocal, scored links in the master dictionary.
- Synonym relations use only `{id, similarity}` in the app's card schema;
  audit evidence, explanatory reasons, confidence labels and verbose senses
  are deliberately not included. No limit is imposed on number of synonyms
  per entry.
- Open a vocabulary card from Words or the review view. **Below the
  existing grammar context**, tap a synonym to open its vocabulary details,
  including pinyin and score (e.g., `0.97`). A Back button returns to the
  previous entry. Navigation supports multiple steps.
- Only existing linked IDs are displayed, so deleting a custom card cannot
  leave an invalid clickable destination.
- Similarity is a reviewed heuristic of shared lexical meaning, not a
  probability that two words can replace each other in every sentence.

## Stored data and updates

- The Cloudflare package includes a single master asset, `master-data.js`,
  plus the full HSK lookup. No optional topic-deck UI is added.
- Updating v0.5.4 does **not** reset, normalize, or migrate review scores,
  scheduling data, settings, or history. Existing saved local data is read as
  before. On launch the bundled master replaces visible content by the same
  existing v0.5.4 behavior; matching word IDs keep their schedules.
- Full backups continue to include the current cards, settings, and progress.
  Version-stamped v0.5.4 backups have an identity migration to v0.5.5.
  Session filters remain excluded from full backups.
- Manual content edits are still visit-scoped. Export a complete master and
  manually reload it after a refresh if you want to reapply those edits.

## Reproducible content sources

The repository retains the exact old master (`content/v055_base_master.json`),
new vocabulary (`content/v055_new_words.json`) and 3,088 concise synonym
pairs (`content/v055_synonym_pairs.json`). All three omit audit reasoning.
Run `python3 build_expanded_dictionary.py` to regenerate `decks/all-decks.json`,
`master-data.js`, the comprehensive HSK lookup and internal catalogue. The
legacy internal topic-deck generator calls this builder before completing, so
it cannot silently revert the shipped master to 2,278 words.

The Cloudflare distribution contains only the static app, icon assets, and
bundled master. No separate synonym file is needed at runtime.

## Testing

Automated tests verify 11,760 unique IDs and Chinese headwords; retention
of all original word details and the full grammar collection; every HSK band;
2,682 new topic-tag assignments; all 3,088 reciprocal, sorted, score-matched
synonym pairs; malformed-data handling; full-backup roundtrip and version
compatibility; and UI synonym navigation with a working Back trail.

Physical iPhone/Safari layout and touch behavior were not verified in the
build environment. Export a full backup before upgrading the Cloudflare Pages
deployment, open the site online, close previous app windows and reopen it.
