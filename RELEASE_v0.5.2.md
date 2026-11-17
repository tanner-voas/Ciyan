# Cíyán v0.5.2 — neutral tag weights and honest availability counters

## New vocabulary weighting

Tag preferences default to **0**, and may be any finite real number, including
negative and fractional values. Every not-yet-studied word has introduction
weight:

    max(1, 1 + sum(applied weights of its leaf tags))

This lets a tag decrease a word's chance without excluding it, and guarantees a
positive selection weight for all words, including untagged words. For example,
a word tagged HSK1 (-2.0) and Food (+0.75) has weight 1, whereas with HSK1
(+1.5) and Food (+0.75) it has weight 3.25.

The Settings table accepts negative numbers and decimals. Press **Apply** to save
and recompute the inclusive odds shown for each tag. The probabilities are based
on the clamped resulting *word* weights and are inclusive: a word with multiple
tags contributes its full selection probability to each tag. Odds will therefore
sometimes total more than 100% across the rows. Existing due reviews continue
to ignore introduction tag weights.

v0.5.1 filled every unconfigured leaf tag with a stored value of 1. During
upgrade, stored values of exactly 1 are converted to 0; other custom values
are preserved. A manually chosen 1 cannot be distinguished from the old default
and is also converted once. After the upgrade, explicitly assigning weight 1
will be preserved. Settings and this migration version remain in full backups,
never in the master word database.

## Availability counters

Vocabulary counts use the current session's word search/tag filters:

- **Due now:** filtered scheduled reviews that are due.
- **Started · not due:** filtered previously introduced words with future due
  dates. These are informational and do not count as available now.
- **New available:** the lesser of matching unstarted words and the unused daily
  new-vocabulary allowance. If unlimited, all matching unstarted words qualify.
- **Available to study:** due now + new available (or due only/new only when the
  session's pool explicitly selects one of them).

These rules apply both to standalone Vocabulary and the Vocabulary portion of
Auto Study. Other modes retain their own prerequisite and filter rules; their
eligible work contributes to Auto Study as before. The subtext distinguishes
new cards available today from the total number of unstarted matching words.

The daily limit and the actual scheduling selection logic were already correct
in v0.5.1; this patch brings the displayed counts and mode-start controls into
alignment with them. No card content, grades, or existing due dates are changed.

## Validation

105 automated tests pass, including regressions for negative/decimal preferences,
clamping and weighted odds, the one-time stored-default migration, backup
round trips, filtered/capped counts, due-only and new-only modes, and simulated
Study/Settings interactions. The master collection still contains 2,278
vocabulary cards and 1,549 grammar entries.

These tests use simulated UI events. A physical iPhone Safari test was not
possible in the build environment. The extracted Git repository and fresh
Cloudflare deployment archive are checked byte-for-byte before delivery.
