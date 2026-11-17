# Cíyán v0.6.1

## Drawing

Each revealed character can be graded Again, Hard, Good or Easy. Ratings are optional;
unrated characters are unknown, not inferred from the overall word grade. The whole
word still receives its own grade, which controls its due date.

Character scores replay the existing gradual score model across explicit reports from
all words. Old Forgotten/Difficult/Recalled reports map to Again/Hard/Good. Duplicate
characters in a review count once, using the weakest report. Invalid reports are ignored.
Only numeric/label evidence is kept; completed sketches are never archived.

Drawing selection multiplies existing overdue urgency by a bounded factor:
`1 + 0.5 × (1 − min(3, wordDrawingScore)/3) + 1.5 × (0.7 × maxWeakness + 0.3 × meanWeakness)`.
Unknown word scores use zero; unknown characters add no weakness evidence. Character
weakness uses the last 20 explicit grades, with weights 0.85 raised to the number of
newer attempts. Again contributes 1, Hard 0.5, Good/Easy 0. The weighted sum is divided
by total weight plus 2, smoothing sparse evidence. This is a heuristic priority measure,
not a probability of forgetting. The combined factor remains below 3×. Scores and
weakness are displayed separately; improving recent recall repairs weakness.

The existing score ≥2 vocabulary prerequisite, session filters, daily vocabulary limit,
and due-before-new rules remain in force. Shared weak characters do not make future-due
words immediately due. Both targeted Drawing and Auto Study use the weighting.

Stats ranks the weakest characters and shows score, evidence count and word coverage.
Word details and revealed drawing results identify the weakest links for that word.
Derived evidence means undo, record deletion, and backup restoration stay consistent.

## Grammar and particles

The prior 72 Particle Zoo exercises remain, including omission, accepted alternatives,
explanations, error categories, and family-based targeting. Grammar usage error rates
continue to use actual checked attempts. Drawing context continues to prefer familiar
sentences without leaking target characters.

50 additional authored examples bring the collection to 1,896 sentences. Three lexical
prerequisites were added, for 11,893 vocabulary entries. 3,335 words now have examples;
8,558 still do not. Segmentation, English and contextual readings were reviewed for the
new sentences. All original vocabulary, synonyms and grammar remain preserved.
Full coverage and exhaustive dictionary editorial review are still outstanding.

## Compatibility and exclusions

Backups from 0.6.0 and earlier supported versions retain their learning records and
settings. There is no automatic reset or cleanup. No writing hints, drawing history,
radicals or English-to-Mandarin mode were added.

## Validation

All 138 automated tests pass, covering scheduler, character transfer, recency recovery, gating, due priority,
backup, undo, content and UI-handler checks are in tests/. The distribution is built
by package.py. Chromium could not launch because its socket operation was blocked; real-browser and physical iPhone testing remain unverified. A full drawing pool with 11,893 eligible words and 10,000 character review records built in about 700 ms on the development host (not an iPhone benchmark).
