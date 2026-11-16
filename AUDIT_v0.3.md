# Cíyán v0.3 — audit and release notes

Date: 17 November 2026 (Shanghai). Baseline: v0.2, commit `ede9edd`.

## Result

The existing v0.1.0 and v0.2 Git history is retained. v0.3 adds optional vocabulary/grammar decks and fixes defects without changing the database name, schema version, FSRS weights, unlimited daily introductions, or reserved 0% grammar usage-risk scoring.

There are 1,580 unique optional words across 17 individual decks, plus an all-in-one deduplicated deck and 24 grammar exercises. New content is opt-in. Existing starter content and user-edited cards are preserved on import. Food and practical daily language take priority; HSK selections use the explicitly labeled 2021 GF 0025–2021 standard. The four HSK subsets contain 660 entries total. Climbing contains 76 entries; activities/sports 82; anatomy/muscles/recovery 70.

## Findings addressed

| Finding | Change | Evidence |
|---|---|---|
| Identical grammar tiles were marked incorrect if their IDs differed | Grade visible word text; apply the same comparison to feedback highlighting | Regression covers swapped duplicates and a distractor identical to the correct word |
| Sentence links matched substrings inside longer words | Link exact marked word tokens | Regression excludes 间 from 时间 |
| Imported distractor text could become HTML in a detail modal | Escape rendered distractor summaries | Interaction test checks an HTML injection string |
| Syllable splitting ignored explicit boundaries and numeric tone digits | Honor separated pinyin syllables and numeric tones; prevent two accents entering one inferred syllable | All 1,580 generated words have matching syllable/character counts and expected per-character tones |
| Damaged numerical memory states could crash statistics or scheduling after restore | Reject invalid stability, difficulty, repetition and grade values; reject reserved object keys as card IDs | Corrupt schedule and reserved-ID tests |
| Two open tabs could silently overwrite each other's progress | Compare revision inside the same IndexedDB transaction before writes | Simulated stale-tab test verifies newer content survives and failed review does not advance |
| Immediate worker activation could mix release assets mid-session | Wait until old app clients close; scope obsolete-cache deletion to Cíyán | Service-worker lifecycle tests |
| Large collections rendered every word at once | Render 80 rows initially and expand on demand | Interaction test checks 80/160-row views |
| Topic decks were difficult to use from a phone | Built-in catalog with merge actions, downloads, and whole-library import | Interaction test loads all decks and repeats import without duplication |
| Study could not focus on a filtered topic | Study matching new/due words using the current word filters | Interaction test checks the queue contains only climbing cards |
| A sample template pointed its distractor at the wrong word | Changed 要 distractor from index 1 to index 2 in 我想喝咖啡 | Source audit |
| HSK dictionary order sometimes surfaced names or obsolete senses first | Edited common-use glosses, including 家, 等, 大学, 元, 周, 药, 满, 成功, 金 and 局 | Editorial review of all 660 selected HSK rows |
| Selective HSK candidates omitted some essential polyphonic/basic words | Added a separate foundations deck with explicit intended readings | Content coverage review |

## Verification

- 30 automated Node tests pass: existing scheduler, migration, import/export and session tests, plus new content, injection, concurrency and offline asset tests.
- Every deck validates against the actual import normalizers. Importing repeatedly is idempotent. Learning records and customized word content survive additive imports.
- The grammar deck includes every answer word and distractor. Token indices validate.
- HSK membership is checked against the local 2021 reference map. The list is selective and does not claim complete exam coverage.
- App and service-worker JavaScript pass syntax checks.
- The distribution contains only deployable files, including all offline deck assets. `package.py` uses only Python's standard library and ignores the caller's working directory.
- Final release packaging checks extract the Git ZIP, verify the release tag and clean tree, rebuild from the extracted copy, and compare its files against the deployment ZIP byte for byte. `dist/` remains ignored.

## Limits and next testing

A real-browser automation run was attempted but could not launch: Chromium was blocked by a process/socket restriction in this environment, and a WebKit executable was unavailable. The UI tests execute the actual app handlers with mocked DOM and IndexedDB; they are not browser rendering tests. Offline tests validate the worker's requests and cache lifecycle in a mock, not Safari's cache implementation. No visual, physical iPhone, share-sheet, or touch-drag verification is claimed.

On iPhone, export a backup first. Deploy to the existing origin, open online, close all old app windows/tabs, reopen, and confirm v0.3 in Settings. Load a small topic deck; study it through the tag filter; test tone input; finish and save to Files; reopen offline; restore a copy of that exported backup if you wish to test the restore path.

Grammar still checks a card's canonical word sequence, not every valid Chinese paraphrase or word order. The UI now states that distinction. No adaptive distractor learning was added. Knowledge remains the existing heuristic built on rating, repetition count and estimated recall; it is not a calibrated fluency measurement. The FSRS equations were retained and tested for basic invariants, not replaced or independently re-certified.

Vocabulary pinyin uses citation tones. Connected-speech changes to 一, 不 and third tones are not tested. Some regional food and climbing terms vary; the concise glosses explain the chosen sense. Existing words are intentionally not overwritten when a new deck supplies a different gloss or pinyin.

Browser-managed storage is still the working copy. The independent JSON in Files remains the durable backup. This release does not add cloud synchronization or automatic writing into iPhone Files.
