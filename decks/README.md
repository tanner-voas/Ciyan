# Cíyán optional decks — v0.3

Open **Home → Explore optional decks** (also in Settings). Load one deck, inspect the proposed additions, and confirm. Existing cards and reviews are preserved; matching words receive additional tags only. You can also import any of these JSON files through Settings. To load everything at once, choose **All optional decks** or import `all-decks.json`.

There are 1,580 unique vocabulary entries and 24 new grammar entries, with overlap between topics and HSK decks. Counts below are per-deck counts, not additive.

| Deck | Words | Grammar |
|---|---:|---:|
| China: meals & street food | 64 | 0 |
| Ingredients, vegetables & fruit | 111 | 0 |
| Ordering, flavors & cooking | 71 | 0 |
| Global foods & drinks | 60 | 0 |
| Activities, sports & exercise | 82 | 0 |
| Body, muscles & recovery | 70 | 0 |
| Climbing | 76 | 0 |
| China: provinces & major regions | 38 | 0 |
| Cities in China & abroad | 64 | 0 |
| Countries & world geography | 71 | 0 |
| Daily life, errands & conversation | 182 | 0 |
| Everyday foundations: people, numbers & time | 143 | 0 |
| HSK 3.0 (2021), selected level 1 | 180 | 0 |
| HSK 3.0 (2021), selected level 2 | 180 | 0 |
| HSK 3.0 (2021), selected level 3 | 160 | 0 |
| HSK 3.0 (2021), selected level 4 | 140 | 0 |
| Practical grammar starter | 83 prerequisites | 24 |

## Study a particular topic

On Words, select a topic tag (green includes it; red excludes it), then tap **Study matching words**. This selects new or due words only. If a session is already open, finish it first. Multiple green tags are combined with AND, not OR. Session size remains configurable; there is no daily new-word cap.

## Content choices

HSK tags refer specifically to the 2021 Ministry of Education grading standard, GF 0025–2021. These are selected subsets, not full HSK lists and not the newer exam-specific syllabus. Candidate selection prioritized common words using the source frequency ranking, then filtered ambiguous readings and edited problematic dictionary senses. The exact selected lists and level reference are included under `content/` for reproducible builds. HSK topics are secondary to practical spoken use.

Pinyin uses spaced syllables and citation tones. For example, 一 is `yī` and 不 is `bù` in vocabulary cards; connected-speech tone sandhi is not tested. Neutral-tone usage can vary by speaker and context. 儿化 is represented with a separate neutral `r` where the word includes 儿, matching the app's per-character input. Countries and regions are vocabulary labels, not a political-status taxonomy.

Grammar provides a deliberately small first set. It includes all required word and distractor cards, so it can be imported independently. It unlocks only when each prerequisite reaches the existing 75% knowledge threshold. The activity compares the card's target order; it is not a general Chinese grammar judge. Repeated identical tiles are interchangeable. Usage-risk scoring remains 0%, while attempts are recorded.

The all-in-one import overlaps the starter deck. Existing starter text is deliberately preserved by the additive import policy; the new grammar file contains 24 entries but a sentence already in your collection will not be duplicated.

## Rebuild and attribution

Run `python3 build_decks.py` from any directory to regenerate JSON and the catalog from local sources. Then `python3 package.py` builds `dist/ciyan/`. Both scripts require only Python's standard library. All decks are cached with the app for offline use after a successful install. See `ATTRIBUTION.md` for sources and data licenses.
