# Cíyán v0.6.0 — implementation preview, content milestone incomplete

This is a working preview of the combined v0.6–v0.8 scope. It is not the completed release requested: 8,718 vocabulary entries still lack a linked example. Do not mistake schema coverage in the earlier draft for usable language coverage.

## Implemented

- 72 Particle Zoo exercises (12 preserved, 60 additional), covering 了, 的/得/地, 过, 着, 吗/呢/吧, classifiers, and omission.
- Explicit omission choice and accepted alternatives; feedback distinguishes marker choice, placement, omission and unnecessary insertion. Prerequisites ignore the omission sentinel and retain the existing minimum 1.0 / mean 2.0 rules.
- Family-level feedback over the latest 20 checked answers. A bounded multiplier increases selection weight for families with errors among eligible exercises. Due-first selection and preferred mode weights remain in force.
- Grammar usage error rate replaces the placeholder zero. Checked correctness is separate from the subsequent ease rating, and details show the evidence count. This is observed task performance, not a calibrated measure of language proficiency.
- Explicit alternative sentence orders for authored cards; no automatic acceptance of arbitrary reorderings.
- Optional Recalled / Difficult / Forgotten feedback per character, alongside the overall drawing grade. Character statistics combine reports across words. Unrated characters are not inferred. Duplicate characters count once per review using the weaker report.
- Character feedback survives backup/restore and is reversed by undo. Completed strokes are not stored in new undo snapshots. Only an unfinished active drawing may be retained to resume it; there is no drawing-history collection.
- Drawing context selection excludes sentences whose other tiles reveal characters from the target; familiarity and length still guide selection.
- No writing hints, radicals, handwriting recognition, or English-to-Mandarin mode.

## Content and quality

| Measure | Count |
|---|---:|
| Vocabulary | 11,890 |
| Existing vocabulary retained unchanged | 11,760 |
| Added, topic-tagged sentence prerequisites | 130 |
| Grammar sentences | 1,846 |
| Existing grammar retained unchanged | 1,549 |
| Additional checked examples | 297 |
| Vocabulary with linked examples | 3,172 |
| Vocabulary without linked examples | 8,718 |
| Unreviewed template candidates excluded from deployment | 9,056 |
| Preserved unique synonym pairs | 3,088 |

The new examples include reviewed draft material, newly authored contextual sentences, and standalone particle examples. Explicit segmentation avoids erroneous links such as 先进 in 先进行. Pinyin, translations, token prerequisites and the limited accepted alternatives were checked. Dictionary-based pinyin construction is deterministic; the audit does not establish lexicographic perfection across the entire existing dictionary.

`content/coverage-v060.csv` reports the exact per-word gap. The next content task is to author or thoroughly revise examples for those 8,718 words, preserving existing IDs and scores. The rejected generic templates have not been silently enabled.

## Validation and practical limits

132 automated tests passed in the final full run, including character feedback and omission interactions. These tests include UI handlers using a simulated DOM/IndexedDB; they are not screenshots or real Safari tests.

Real Chromium launch failed because the environment denied a required socket operation. Real-browser layout, touch interaction, and offline launch were therefore not verified. Service-worker behavior is covered by automated tests.

Backup changes are additive. The 0.5.5 → 0.6.0 migration is an identity step; existing scores, timing settings and learning history are not reset. The internal numeric version is 0.6.0 for backup compatibility; the ZIP filenames and Git tag explicitly identify this as a preview.

## Rebuild

Run `python3 build_v06.py` to rebuild the checked master and coverage ledger from the committed content sources. Run `npm test` for automated validation, then `python3 package.py` for `dist/ciyan`. All dependencies for building and testing are Python and Node standard libraries. The browser validation script requires Playwright and Chromium and was not successful in this environment.
