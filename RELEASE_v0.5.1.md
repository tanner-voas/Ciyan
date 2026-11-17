# Cíyán v0.5.1 — weighted introductions and qualifying contexts

Built from the uploaded v0.5 Git repository. The master collection remains **2,278 vocabulary cards and 1,549 grammar entries**, unchanged. Only study code, settings, tests, documentation and service-worker assets change.

## Scheduling default

Default score anchors are **0 = 10 minutes, 1 = 6 hours, 2 = 3 days, 3 = 2 weeks**. The existing geometric interpolation and extrapolation above score 3 remain unchanged. When upgrading from v0.5, only an *unchanged* v0.5 default (2-day score-2 anchor) becomes 3 days. Customized anchors are preserved. Previously scheduled due dates are deliberately left untouched, as with a **future-only** timing change. To update existing due dates, use Settings → Review timing → Recalculate existing schedules after preview.

## Due-review weighting

For a due card, its draw weight is:

    max(0, current_time - last_reviewed_at) / stored_scheduled_interval

Both operands use the same units. For example, last reviewed 13 hours ago, with a scheduled 2.34-hour interval: **13 / 2.34 = 5.5556**. There is no logarithmic compression or upper cap. New/unstudied items do not use overdue weighting. Selection remains random, weighted by these values within a mode; Auto Study also uses the enabled mode proportions and average due-review weight to select a mode. In *New only* sessions, tag weights affect choice of vocabulary **within** vocabulary mode, not the mix of Auto Study modes. Previously scheduled intervals are used even if the user has changed future-only timing settings.

## Introduction weights from leaf tags

Settings has a separate **New vocabulary · tag weights** area, collapsed into expandable tag groups. The leaf tags come from the currently loaded master content. All newly introduced tags start at weight **1**, and every editable weight must be a finite number between 1 and 1,000,000. The weight of a new vocabulary card is the **sum of the applied weights of its distinct leaf tags**. An untagged word receives weight 1 so it remains reachable.

**Apply tag weights & recalculate odds** validates all inputs, saves the preferences and updates the displayed percentages. Editing numbers alone does *not* recalculate or apply. For every unstudied vocabulary card `c`, let `W(c)` be the card's total tag weight. Each tag's displayed odds are:

    100 × sum(W(c) for every unstudied c carrying that tag)
          / sum(W(c) for all unstudied vocabulary c)

Cards may carry multiple tags, so these tag-membership percentages **need not sum to 100%**. If no unstudied words remain, displayed odds are 0.00%. The odds are global for the unstudied collection (not adjusted for the current session's tag filters or daily quota), as requested.

Results are cached for the Settings screen. Recalculation occurs on the first opening, on Apply, when the *set* of newly introduced word IDs changes, or when words/tags/the master/backup change. Unrelated settings edits do not trigger a full new-word odds calculation. The settings are saved in IndexedDB and the **full progress backup**; they are not stored on the vocabulary cards or in the exported master-collection JSON. Loading a master with additional leaf tags initializes those new tags to 1 without clearing previously configured preferences.

## Vocabulary reveal context

For a vocabulary word, find grammar examples where the word is an **exact grammar token**. Evaluate each example using the same grammar-study prerequisites: all involved answer and distractor words must have vocabulary scores ≥ 1.0 and their mean must be ≥ 2.0. If any examples qualify, show **all qualified examples** in the revealed answer with Chinese, pinyin and English. Otherwise show **one highest-quality example**, prioritizing both its minimum-word knowledge and mean knowledge; exact ties are randomly broken. If the word has no linked grammar examples, show no context. This also works for resumed legacy review sessions.

## Unchanged

The single master collection, hierarchical filters, independent skill records, daily new-word limit, continuous study, undo/skip/postpone, self-graded drawing and Particle Zoo content are unchanged. No new optional decks or audio modes were added.

## Validation

New tests cover default intervals, exact elapsed/scheduled interval weighting, random due selection, tag-sum weighting, multi-tag inclusive odds, odds changes after introducing words, empty/untagged cases, malicious or invalid weights, settings backups, qualified/fallback grammar contexts, and the Settings UI's Apply/refresh behavior. Existing v0.5 regression tests remain in the suite. Physical iPhone testing is not available in this build environment; a real-device visual check is still recommended after deployment.
