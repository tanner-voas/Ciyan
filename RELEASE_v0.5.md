# Cíyán v0.5 — continuous study, eligibility and scheduling

This release builds directly on v0.4.1, preserves the original Git history and
review records, and retains the single bundled master collection. It adds one
missing Particle Zoo prerequisite, 地 (de), so there are **2,278 vocabulary
words** and **1,549 grammar sentences**. No grammar examples or Particle Zoo
questions were added or rewritten.

## Exactly what can be studied

Eligibility uses the **continuous recognition score** recorded for each word,
not the last button pressed and not a predicted-recall percentage. An unseen
word has score 0. A score can exceed 3 through repeated Easy reviews.

| Mode | Eligibility |
|---|---|
| Vocabulary | Every word in the current tag/search selection; no recognition-score prerequisite |
| Drawing | Each focus word must have score **≥ 2.0**; other sentence words do not gate drawing |
| Grammar | Every distinct answer and distractor word must have score **≥ 1.0** and their arithmetic mean must be **≥ 2.0** |
| Particle Zoo | Every distinct base-sentence word and particle/classifier choice must have score **≥ 1.0** and their arithmetic mean must be **≥ 2.0** |

Missing vocabulary is score zero, so a grammar/particle test with a missing word
cannot unlock. Duplicate occurrences count once toward the average. Manual,
targeted, and Auto sessions use identical gates. If no cards pass, the mode
shows **zero eligible**; no unqualified examples are offered.

Study has the same hierarchical require/exclude tag selection as Words. A
vocabulary/drawing candidate must itself match the selected tags. A grammar or
particle exercise needs **at least one** involved word which (a) has score ≥ 2
and (b) matches the complete tag/search filter. Other words in that same
sentence may be excluded by the tag filter without excluding the sentence.
With no study filter, all score-eligible exercises can participate.

Each study mode displays **Due now**, **Started but not due**, and **Eligible
total**. It also shows the eligible-but-unseen count. The total counts all
prerequisite-valid items in the filtered collection, including new and future
due records; it is distinct from what can be asked immediately in a Due-only
session or under the daily new-word quota.

## Continuous sessions and Auto Study

There are no fixed-length study sessions. Start with one mode or Auto, and choose:

- **All:** due reviews first, globally across enabled modes; only when none is
  due may a new card be introduced.
- **Due only:** previously started items currently due, never new.
- **New only:** not-yet-started items, explicitly ignoring due reviews.

The latter is an intentional exception to the ordinary due-first policy.

The picker is rerun after *every* graded exercise and sees cards that became
due in the meantime, including a card/mode already reviewed during the current
session. Auto chooses a mode randomly using preferred mode shares multiplied by
average overdue urgency, then chooses a card randomly within that mode weighted
by overdue age and recall shortfall. This avoids consistently selecting the
single most overdue card and prevents large mode collections from swamping
smaller ones. Mode shares remain editable in Settings.

Sessions finish automatically when there is no due/new item available under the
selected pool, filters, prerequisites and daily vocabulary quota. Future reviews
are not silently pulled forward. The user can Finish at any time. An in-session
Postpone may temporarily leave the session on a waiting screen, with an automatic
check and a manual Check Again button. iOS background timers may be suspended.

**Skip** excludes exactly that item/mode for the remainder of the current
session; no grade or history is recorded. **Postpone** also records no grade but
only defers the item within this session. It drops unfinished drawing strokes
or selections, leaves the original due date unchanged, and allows the item to
return after two other turns or roughly fifteen seconds (whichever happens
first). Skips and postponements are not permanent schedule edits.

The **New vocabulary words per day** setting accepts a nonnegative integer;
blank means unlimited. It counts distinct first vocabulary reviews made on the
device's local calendar date. Other skill modes do not consume this word quota.
Undoing a first review restores the allowance. A cap of zero prevents new
vocabulary but not scheduled reviews. A finished session can be started again
whenever eligible work exists.

## Score-to-interval settings

The default anchor values are now:

| Score | Retry interval |
|---|---|
| 0 | 10 minutes |
| 1 | 6 hours |
| 2 | 2 days |
| 3 | 2 weeks |

Scores between neighboring anchors use geometric interpolation. Scores above
3 extend **linearly** from the final anchor:

    interval(score >= 3) = interval(3) × (score − 2)

For example, 3.20 produces 14 days × 1.20 = **16.8 days**. Easy always
increases the current score by at least **0.20**, even from 3.0 or higher.
Other ratings retain gradual evidence accumulation, with Again reducing rather
than resetting established scores.

Every rating button shows its predicted **single-unit interval** (one decimal)
and the resulting **Score (two decimals)**. Its preview uses the same function
as the committed review.

A v0.4.1 installation whose retry settings still exactly match the old default
(1 minute, 10 minutes, 3 days, 2 weeks) is migrated to the new default once,
without moving already-scheduled dates. Customized anchors remain unchanged.
Importing a full backup preserves the settings actually stored in that backup.
The existing Settings preview still offers future-only or recalculation of
existing schedules on explicit request.

## Study is Home

The Home tab and redundant home screen are gone. Launch opens **Study**;
navigation consists of Study, Words, Grammar, and Stats. Study begins with the
session filters and All / Due only / New only selection. The useful daily
metrics from the former Home screen are displayed on Stats.

## Backups and continuity

Active-session filters and selected word IDs are deliberately omitted from
**full JSON backups**; they are not learning data. All other settings, including
mode shares, retry anchors, and the daily word cap, remain in backups and are
restored. A current browser tab may retain its active session filter until the
session ends; restoration uses an unfiltered session by default. Undo records
restore the actual schedule, histories, time totals and daily-introduction count.

No accounts, cloud sync, deck-management UI, automatic handwriting scoring,
or pronunciation/audio modes were added. The Particle Zoo family expansion and
richer per-character assessment are deferred.

## Verification

- Unit and DOM-handler regressions cover prerequisite gates, tag matching,
  due/new/future counts, single-mode and mixed selection, bounded/randomized
  overdue weighting, same-session retries, grade-free skip/postpone,
  mathematical intervals and predicted scores, quota counting, backup settings
  and filtering exclusions, master content, and offline caching.
- Full deploy packages are rebuilt after extracting the Git repository, and
  compared byte-for-byte with the Cloudflare ZIP. `package.py` still takes no
  arguments; `dist/` remains ignored.
- Physical iPhone/Safari and rendered-browser visual checks are **not** claimed
  without a working browser executor. In particular, test touch interactions,
  resume after suspension, and the search/filter tree on an iPhone before relying
  on it as the only copy of learning progress.

Keep a full JSON backup in Files before updating the existing Cloudflare origin.
Close all installed-app/Safari windows after loading the update once online,
then reopen to activate the new service worker and confirm v0.5 in Settings.
