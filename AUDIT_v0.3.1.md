# Cíyán v0.3.1 — deck-only release audit

Baseline `v0.3` / Git commit `5060849`. **No changes to the app's study screens, storage logic, scheduler, or import behavior.** Only deck sources/build outputs, test cases, version metadata, and the service-worker cache identifier have changed. The cache identifier is bumped solely so an existing Cloudflare deployment downloads the new static deck files while keeping its IndexedDB review data.

## Inventory

- 2,002 distinct vocabulary entries in `all-decks.json`, including the 52 starter words.
- 1,287 grammar entries in the all-in-one deck, including the original 24 with their IDs preserved.
- 26 individual topical, HSK, or grammar decks; overlapping prerequisite cards are intentional, and all can be merged safely. 
- All 50 US states and Washington, DC; all 27 EU country-capital pairs; 34 Chinese province-level entries; Asia, Oceania, Russia, South Africa, and UK's constituent-country capital examples.
- Geography from the user-provided visited list is distinguished from general-reference places. Nanchang is Jiangxi; Enshi is Hubei. The user's spelling variants were normalized.
- Two slang decks: expressions from friend chats and modern non-rude colloquial/online usage.

## Coverage and checks

`npm test`: **39 automated tests passed** at release preparation. Tests verify exact-token coverage, all grammar cards normalize successfully, all answer and distractor vocabulary exists, HSK source selections match the 2021 level map, all 50 states and the EU pairs are present, geography/slang coverage, additive imports, default-card preservation, per-topic usage examples, tone parsing, backups, scheduling, and existing app behavior.

Every vocabulary word appears in one or more grammar sentences via exact `{word}` markup, rather than an accidental substring. The builder fails if any optional word lacks an example or if a sentence references missing vocabulary. It also checks per-topic original word coverage. A few prerequisite/distractor words in the original 24-card `practical-grammar` deck have no usage example **in that small starter deck itself**; their proper sentence examples exist in the all-in-one library and other topical decks.

## Editorial review and limits

Grammar ranges from custom-authored sentences illustrating word order, aspect, particles, complement, comparison, and contrast, to natural-topic templates for shopping, food, geography and travel. This release explicitly reviewed and corrected many awkward template collocations and English glosses. The 1,287 sentences are not all individually copy-edited by a native speaker; structural and coverage checks cannot prove idiomatic correctness. Any questionable sentence should be fixed in the source template or editorial override and rebuilt, not changed in the runtime program.

The same caveat applies to geographic transliterations and culturally specific slang: some written forms or pronunciations may vary by source/region. HSK selections are from the 2021 grading standard, not a claim of complete newer HSK exam coverage. In particular, the 2026 status of Indonesia's capital transition may evolve. Content should be treated as practice material.

No real iPhone browser testing was performed in this environment. The existing v0.3 application already supports loading optional decks from a static JSON catalog; upgrading the same Cloudflare origin should preserve IndexedDB. Export a backup before deployment, then close and reopen all old PWA windows to activate the new cache. A complete backup to Files remains the only durable independent copy of progress.

The ZIP packaging procedure re-extracts the committed Git repository, reruns the deck generator and `package.py`, checks Git cleanliness, and byte-compares deployment files.
