# Cíyán v0.4 study design

Built directly on v0.3.2. Its 2,277 optional vocabulary cards and 1,549 grammar
entries retain their IDs, wording, pinyin, translations, examples and distractors.
Tags are converted to slash paths; no expanded deck content is removed. The
Particle Zoo starter exercises are separate application content.

## Modes

Vocabulary tests recognition. Grammar tests word order and distractor selection.
Drawing tests a word's character recall, with English, pinyin, character count and
an available contextual sentence. A separate pad per character supports arrows,
undo, clear, pointer/touch drawing, and persisted vector strokes. Reveal displays
small drawings beside the actual characters. The user grades handwriting; no OCR,
stroke-order diagnosis, pronunciation or audio is involved. Mixed-script words
are excluded from drawing rather than dropping non-Han characters silently.

Particle Zoo tests a choice plus a gap in a sentence. Its 12 initial authored tests
cover completed-event 了, changed-situation 了, 太…了, 的, 得, 地, 过, 吗, 呢, and
次/个/本. These are target construction exercises, not assertions that one Chinese
sentence has only one possible meaning. Context and explicit instructions constrain
the task. Multiple accepted choice/gap pairs are supported. Incorrect machine
checks cap the self-rating at Hard. Normal grammar retains tap and touch/desktop
dragging. Answers are stored on rating, not merely on reveal.

## Skill records

Vocabulary retains `schedules` and `history`. Grammar, drawing and particles each
have their own map under `skillSchedules`; writing one word never advances the
recognition schedule or the schedules of its context's other words. Grammar logs
stay in `grammarHistory`; drawing and particle attempts go in `skillHistory`.
`mixedSessions` stores sessions run through the new engine. `activePractice` stores
the current exercise and input, including pads and particle selections. Full
backups preserve these; deck exports omit learning records. Clearing learning
records retains content, tests, settings and tags. Local persistence is still
browser managed: export to Files at the session-end reminder.

## Tunable score scheduler (default)

Display ratings are 0 Again, 1 Hard, 2 Good, 3 Easy. Historical storage keeps the
existing grade encoding 1–4, with a separate continuous `score` field.

First review: score = rating − 1.
Subsequent non-Again review: score = 0.65 × (rating − 1) + 0.35 × previous score.
Again: score = 0. This intentionally resets a lapse instead of retaining a long
interval on the strength of past successes. The smoothing weights are a transparent
product policy, not fitted parameters.

Defaults: 0 → 1 minute, 1 → 10 minutes, 2 → 3 days, 3 → 2 weeks.
Each anchor accepts a positive number and seconds/minutes/hours/days/weeks. Anchors
must be nondecreasing, between one second and ten years. For fractional score x,
with lower anchor a and upper anchor b:

    interval(x) = interval(a) * (interval(b) / interval(a)) ** (x - a)

At 2.5 with 3-day and 14-day anchors, the interval is sqrt(42) = 6.4807407 days.
Saving timing settings recalculates existing due dates from the last review time;
it does not move every due date relative to now or erase overdue work. The settings
apply to every skill, each using its own score. Future ratings use the saved policy.
FSRS-4.5 is an alternative method. Memory-state estimates remain available under
both methods, but are not calibrated accuracy measurements. FSRS mode returns to
the model interval retained at the last review; score tuning does not alter it.

## Auto Study

Enabled modes are persistent checkboxes. With none enabled Start is disabled.
Selection is recalculated after each graded exercise:

1. Generate new or currently due candidates, excluding future schedules.
2. Apply prerequisites. Grammar requires every answer/distractor word at >=75%
   estimated vocabulary knowledge. Drawing requires target knowledge >=75% and
   mean surrounding context-word knowledge >=60%. Particle Zoo requires mean
   base-sentence vocabulary knowledge >=60%; its tested particles are not gates.
   Missing vocabulary contributes zero. Manual drawing/particles permit ungated
   practice; manual grammar retains its vocabulary prerequisite.
3. Prefer due relearning, then other due work, then new work. Within a mode, rank
   by due status, estimated recall shortfall and capped overdue age.
4. Use weighted fair queuing in estimated seconds. Soft shares are vocabulary
   60%, grammar 20%, drawing 12%, particles 8%. For an available candidate:

       virtual_finish = (seconds_spent_in_mode + estimated_cost)
                        / (mode_share * min(2, urgency))

   The smallest virtual finish wins within the current due/new priority class.
   Initial costs are 12/35/50/25 seconds. Observed duration is bounded to 2–180
   seconds; cost estimates use an exponential moving average, clamped to
   0.5–2 times the initial cost for selection. Unavailable modes do not block others.
5. Do not draw a target appearing in the last three exercise word sets. This
   avoids immediately testing a character the previous exercise just exposed.
   No exercise repeats within a minute. Sessions can end before the requested
   count if no eligible work remains; no artificial early review is inserted.

This is a documented heuristic layered on independent schedulers, not an
experimentally optimized curriculum. Vocabulary remains the largest allocation;
a due backlog may override the nominal mix. There is no daily new-word cap.

## Hierarchical tags

JSON tags use paths such as `HSK/HSK2`, `Food/ingredients`, `Places/us-states`.
A card can belong to many paths. Branch arrows expand/collapse independently of
selection. Tapping a label cycles require → exclude → neutral. Parent paths match
all descendants with a slash boundary (HSK1 never matches HSK10). Required tags
combine with AND, preserving the previous app's multi-tag behavior; exclusions
win. Active filters remain in a separate row; Reset clears them all. Grammar tags
are inherited from its token-linked words. Legacy flat topic tags map into
broad roots; custom slash paths are preserved. Explicit HSK paths are respected;
when absent, the existing HSK headword reference supplies the level.

## Statistics

Retains the previous app's weekly activity, streak, memory estimate and session
list. Inspired by the uploaded Python apps' interval distributions and summary
statistics, v0.4 adds skill-specific attempts/success/due/recall, 28-day activity,
particle mistakes and a seven-day due forecast. The overdue → next-due chart
stacks all four skill types. It chooses time bins from seconds through years,
anchors a boundary at now, and targets 5–18 bars depending on viewport width.
Resize rebuilds the chart. Exact bucket counts are also available as a table.
Unstudied items are excluded because they have no scheduled due date.

## Next modes (planned, not implemented)

1. English → vocabulary recall without pinyin: the most useful next step for
   active conversational retrieval; needs a separate skill schedule.
2. Contextual word choice: contrast near-synonyms in an authored sentence,
   with accepted alternatives and short explanations.
3. Sentence correction: repair a specific grammar error, only after cards have
   authored errors, valid repairs and explanations. Never generate scored errors
   from unconstrained text alone.

No audio or pronunciation modes are planned for this release.
