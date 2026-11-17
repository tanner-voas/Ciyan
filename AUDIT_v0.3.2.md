# Cíyán v0.3.2 — content and release audit

Baseline: Git v0.3.1. Objective: curated additions from a user-supplied Pleco word inventory, consistent HSK tagging, and full grammar coverage.

## Content decisions

- The Pleco export was treated as a **reference**, not a source of display definitions. It provided candidates and pronunciation/level reference. New English glosses and Mandarin grammar examples were independently written and normalized.
- Added 262 example rows for 259 distinct selected headwords across eight topical decks, plus 46 supporting rows. Some selected words already existed in v0.3.1. Existing vocabulary meanings are not overwritten by generated deck merges.
- The complete optional inventory now contains **2,277 distinct Chinese headwords** and **1,549 distinct grammar sentences**. It remains selective rather than an attempt to import the full Pleco export. High-value conversational connectors, interactions, work, errands, health, travel and advanced everyday expressions received priority.
- Every included vocabulary card (including starter cards) has at least one grammar sentence with its **exact `{word}` token**. Tests also check that each individual deck ships examples and required word/distractor cards. Structural tests do **not** guarantee every sentence is idiomatic; additional native-speaker editorial review is recommended, especially for automatically composed examples and ambiguous words.
- Existing geography, sports, food, climbing and slang decks and sentence library remain available; duplicate Chinese headwords share one canonical card across the all-in-one collection.

## HSK consolidation

One scheme only: `hsk1`, `hsk2`, `hsk3`, `hsk4`, `hsk5`, `hsk6`, `hsk7-9` (user-visible deck titles HSK1–HSK7-9). Exactly one band is attached to a headword when it occurs in `content/hsk-levels-032.json`, including words added from non-HSK topic decks. There are **no** duplicate HSK 3.0 or HSK 2021 tag families. Level assignments derive from the 2021-standard grouping in the user's supplied reference and are kept separate from the later revised examination syllabus. The HSK decks are selective and are padded with relevant sentence prerequisites, not guaranteed complete level inventories.

## No premature migration code

The project has no actual users or study records. This release intentionally does **not** add retagging of previously saved/imported v0.3.1 data or any new historical-upgrade path. New cards and new imports are consistently tagged at their point of creation. Existing earlier v0.1-v0.2 migration code is inherited from the baseline but not expanded in this release. When real study begins, plan backward-compatible migrations and test them before shipping breaking changes.

## Technical checks

The existing automated Node suite validates vocabulary/grammar import formats, one-band HSK tags, correct level-deck inclusion, complete exact-token coverage, grammar prerequisites, duplicate IDs, pinyin/tone alignment, non-destructive merges and backups, and worker precache resources. The tests are not a full Mandarin language quality review or physical iPhone test. `python3 build_decks.py` rebuilds the source-generated decks without internet access, and `python3 package.py` rebuilds the Cloudflare Pages upload directory. Both must be deterministic from an extracted Git release. The Cloudflare distribution must contain the deck manifest and all 38 individual deck files plus the all-in-one JSON.
