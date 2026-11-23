# Cíyán v0.9.9 — aligned Panlong Volume 1 editions and dictionary enrichment

Base: **Ciyan v0.9.8**, commit `1a91e3f12038293cc1eb63c1710212955d61950d`.

## Reader editions

The 23 chapters of 《盘龙》 Volume 1 now offer **Original**, **HSK4 + TSK8**,
**HSK5 + TSK10** and **HSK6 + TSK12**. The three graded manuscripts
use the latest four-edition cross-audited text, corrected token boundaries,
contextual definitions and forty aligned grammar notes per graded level.
Original source prose and paragraph IDs remain unchanged. The original
Chapter 2 `历史上传说中` is now annotated as `历史 / 上 / 传说 / 中`, without
changing its text; Chapter 2 advances to revision 47 so installed copies
may update without corrupting reading progress. Earlier catalog digests
remain recognized for migrated installations.

## Dictionary and grammar

The refactored v0.9.8 dictionary is retained as the base. A guarded merge
adds 886 previously absent ordinary vocabulary cards from the four
reader editions and curated MOBI dictionaries, bringing the bundled master
from **12,505** to **13,391** words. Five reviewed grammar exercises bring
the grammar master from **3,444** to **3,449**. The bundled dictionary
now includes **4,374 scored reciprocal synonym pairs** (0–1 semantic
overlap). Strong and weak semantic overlap is informational and does not
in itself authorize automatic reader substitutions. Reader-specific and
contextual topic tags are added without replacing existing classifications.
Every annotated ordinary reader word has a master entry with nonempty
Pinyin and English; novel-specific terms are kept separate.

## Existing profiles and upgrade safety

Existing card IDs, scheduling data, history, user-created words, edited
meanings, noncanonical tags and manually adjusted synonym scores are
preserved. Only individually reviewed Pinyin/English corrections are
applied when the local value still equals the exact expected old value.
New synonym links are additive and reciprocal, including when custom
card IDs differ from bundled IDs. Explicitly imported user dictionaries
remain authoritative and are not silently replaced. Older JSON backups
migrate through a v0.9.8 → v0.9.9 identity step.

## Reproducibility and verification

`python3 tools/build-panlong-v099.py` recreates all 69 graded chapters
from the editorial source files in `reader/panlong/v099/`.
`python3 tools/package-chapters.py` regenerates the chapter catalog and
portable chapter archives.

Verification performed in the v0.9.8 working tree:

* All 69 graded overlays pass `validateChapter()`; every one of the 23
  original chapters and all 1,648 source paragraphs are preserved.
* All dictionary and grammar cards pass native normalizers, with no
  missing ordinary reader vocabulary in any of the four editions.
* All **302** Node regression tests pass.
* `python3 package.py` builds both the standalone PWA and the standalone
  app-only module for AppLauncher.
* A full 93-file reproduction check of the 69 graded assets, chapter
  catalog and 23 original ZIPs yields byte-identical output.

The patch is for the **Ciyan repository only**; it does not modify
AppLauncher or the shared Google Drive submodule.
