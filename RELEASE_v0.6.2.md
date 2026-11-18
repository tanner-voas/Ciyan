# Cíyán v0.6.2 — Rule-Aware Grammar Contexts

## What changed

1. **Shared context matching.** Vocabulary reviews, word details and drawing
   contexts use the same matcher. A word is linked when it is:
   - **Exact**: the complete content of one `{token}`.
   - **Whole-token phrase**: a sequence of two or more **contiguous complete**
     `{tokens}` with no punctuation or fixed text between them.
   - **Within one token**: a contiguous substring contained entirely inside one
     `{token}` (including one Chinese character).

   Hybrids spanning a full token plus a partial neighbor, or crossing
   punctuation, do **not** match. Thus `{没}{关系}` matches 没关系 but not 没关;
   `{汉子}` matches 子. A different example with `{没关系}` matches it exactly.

2. **Visible original tokenization.** Word details and revealed vocabulary
   examples show `Exact token`, `Complete adjacent tokens` or `Inside one token`
   and the *literal* brace-wrapped source tiles. Grammar details show all source
   tiles. Large lists are paginated. Prefer exact examples before whole-token
   combinations and within-token fallbacks. Only genuine grammar tokens and
   distractors affect grammar-learning eligibility; substring matches do not
   fabricate proficiency data.

3. **Drawing contexts.** The same matching is available for drawing practice.
   Candidate construction no longer repeatedly picks context for every eligible
   word: it selects a word first, then resolves one valid context, preserving
   character-level review prioritization and existing due-date gates.
   Other unmatched tokens containing the target characters remain excluded
   from drawing-context selection to avoid unintentional visual leaks.

4. **Content integration.** The 805 authored grammar sentences from the
   November 18 expansion are included. Of the existing examples, 25 were
   removed: 24 metalinguistic placeholders discussing how to “use” a word
   instead of using it, and one unnatural `不客气，没关系` pairing.
   Added **85 original contextual examples**, including distinct apology and
   thank-you exchanges with exact `{没关系}` and `{不客气}`. No vocabulary
   definitions, word IDs, tags or synonym scores were changed.

## Actual coverage

| Metric | Value |
|---|---:|
| Vocabulary | 11,893 |
| Grammar entries | 2,761 |
| Preferred exact-token context | 4,784 words |
| Preferred whole-token context | 31 words |
| Preferred contained-token context | 560 words |
| **At least one matched context** | **5,375 words (45.19%)** |
| No matched context | 6,518 words |
| HSK1 / HSK2 structurally matched | 497/497; 747/747 |

Matching a character inside a longer word is intentional per the requested
rule, but **does not prove that the full sentence illustrates the standalone
meaning or pronunciation** of the shorter word. This is especially important
for isolated character cards and ambiguous words. Such examples are labeled
`Inside one token`. Complete, semantically precise examples remain preferable.

The expanded content has not received exhaustive native-speaker review. The
uncovered entries are reported honestly; there are no invented, templated
sentences inserted solely to force a 100% coverage figure.

## Preservation and deployment

- The tag is `v0.6.2`; application version and service-worker cache are bumped.
- An explicit identity migration supports v0.6.1 backups without changing
  scores, schedules, preferences or review history. Missing historical
  grammar entries are not deleted from users' prior history or forced to
  inherit the scores of other entries.
- Current matching uses a memoized inverted index keyed by grammar content,
  with clone-safe reuse and reindexing when content changes.
- Current IndexedDB data remains protected by the existing backup/export
  flow; users should export a full backup before deployment.
- No handwriting recognition, drawing history, writing hints, radicals or
  English-to-Mandarin study mode.

## Build & verification

```
python3 build_v062.py
node audit_context_v062.mjs
npm test
python3 package.py
```

See `content/context-coverage-v062.csv` for all 11,893 per-word results and
`content/pruned-context-ids-v062.json` for the exact removed sentences. Device
and physical Safari testing remain unverified in this environment.
