# Cíyán v0.9.5 — dual graded editions for 《盘龙》 Volume 1

This release finishes the originally intended two-level reader integration:

- **Original** — unchanged source chapter.
- **HSK5 + TSK10** — frozen, editorially finalized 23-chapter adaptation from `Panlong_Volume1_HSK5_TSK10_FINAL.zip`.
- **HSK6 + TSK12** — the polished v0.9.4 edition, unchanged in this release.

The reader's Edition selector switches between these three options. Old backups with `editionPrefs.graded: true` continue to open HSK6 + TSK12; choosing HSK5 explicitly records `editionPrefs.level: 'hsk5'`. Switching levels clears stale per-token automatic-simplification overrides, but retains chapter source digests, bookmarks, progress, study history, chapter completion, term IDs and grammar IDs.

## HSK5 content

All 23 chapters have 1,648 original-aligned paragraphs and 40 grammar examples, with the same 198 protected novel-specific terms (including the three short names/concepts appearing only nested inside longer terms). The frozen HSK5+TSK10 vocabulary baseline is 4,582 entries. Against that baseline the finalized manuscript has **952 distinct unfamiliar ordinary words** across **3,728 unfamiliar occurrences** (12.33% of 30,227 ordinary annotated occurrences).

The HSK5 manuscript's token boundaries, source-character anchors, glossary, grammar notes, and protected term register are included in `reader/panlong/hsk5-final/` to allow deterministic rebuilding. Generated native assets are in `chapters/graded-v095-hsk5/`; HSK6 assets remain in `chapters/graded-v094/`. Original chapter JSON and ZIPs remain unchanged. Each HSK5 asset is verified against the corresponding original chapter digest before use.

## Build and test

```sh
python3 tools/build-panlong-hsk5.py
python3 tools/package-chapters.py
npm test
npm run build
```

289 automated tests pass, including all 23 source-digest and HSK5 manuscript comparisons, chapter validator checks, all 40 grammar notes, selector switching, legacy HSK6 preservation, old bookmark/progress behavior and v0.9.4 backup migration. Both Ciyan standalone and AppLauncher module builds pass.

No change to the AppLauncher repository is required. This release does not add an HSK4 edition; it adds the finalized HSK5 edition while retaining the polished HSK6 edition.
