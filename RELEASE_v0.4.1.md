# Cíyán v0.4.1

## Gradual scores and accurate interval previews

Scores start at zero. A first response moves 18% toward its rating target
(Again 0, Hard 1, Good 2, Easy 3). Thus a first Good gives 0.36 and a first Easy
0.54, not 2 or 3. Again reduces an existing score by 20%, without resetting it.

For later successful responses:

    spacing = min(1, elapsed_seconds / max(21600, previous_interval_seconds / 2))
    alpha = 0.08 + 0.12 * spacing
    new_score = old_score + alpha * (rating_target - old_score)

This gives short retries less credit than spaced recalls. For example, Again
followed by Easy one minute later yields approximately 0.241, not 3. These
coefficients are a transparent heuristic, not fitted learning parameters.
Vocabulary knowledge gates now also use the gradual score rather than treating
one Easy as mastery. Existing FSRS timing remains an explicit alternative.

The four configurable interval anchors are unchanged. Geometric interpolation
uses the *predicted resulting score* for each button. Preview and grading call
the same scheduler. Default first-review labels are 1.0m / 1.5m / 2.3m / 3.5m.
Intervals use a single largest applicable unit and exactly one decimal place.

When complete v0.4 review history is available, its inflated scores are rebuilt
once with the gradual rule, preserving events and FSRS memory fields. Due dates
in score mode are corrected from the last recorded review; postponements are
respected. Incomplete histories are not guessed or deleted.

## Vocabulary layout and context

The Chinese-to-English heading is in normal document flow, fixing the absolute
positioning that overlapped the tone instructions in the supplied screenshot.
Revealed vocabulary includes a linked example in Chinese, pinyin and English.
Long content wraps; the word card expands naturally. Tag display names are
cleaned up (e.g. Chinese food) without changing saved paths or filter semantics.

## Session controls

Undo reverses the schedule, review event, session counts and adaptive timing
estimate. Up to 20 recent answers can be undone in the current session, including
the last answer from the completion screen. Starting another session, importing
content, clearing data or applying timing settings creates an undo boundary.
Restoring a backup resumes input and records but starts a fresh undo boundary.

Skip makes no review record and excludes that item for the remainder of the
session. Postpone explicitly offers 5 minutes, 30 minutes, 1 hour or 1 day. It
records no grade or failure and does not mark an unseen item as learned.

Continuous study can run beyond the configured batch length. When no next item
is available, it displays the next eligible time or explains exhausted work or
vocabulary/context prerequisites. It automatically checks again while open;
finish and export are always available. iOS may suspend background timers, so
the Check again button is also provided.

Auto Study shows actual practice-time shares versus preferred weights, readiness
counts and prerequisite blockers. Preferred weights are editable in Settings and
normalized across enabled modes; due/relearning work still takes priority.

## Reviewable scheduling settings

A live logarithmic score-to-interval curve accompanies the anchor controls.
Preview reports additional items due now and currently due items that move later.
Nothing changes until choosing either:

- Use for future reviews only: existing due dates stay unchanged.
- Also recalculate existing schedules: recompute from each item's last review.

Cancel makes no changes. History and scores are preserved by these settings edits.

## One master collection

All 2,277 words and 1,549 sentences ship in one master-data.js asset and load by
default. The app has no optional topic-deck catalogue. Existing topic tags remain
available for filtering. Internal content-source files remain in the Git repository
for development, but the distribution ships no collection of optional deck files.

Add/edit/delete remain available. They affect the current visit. Export complete
master saves all current content without learning records; Load complete master
replaces the whole content for that visit, preserving records of matching words
and sentences. Refresh loads the bundled master again. To use custom edits after
a refresh, manually load the saved master file. Learning records save automatically.
Full backups continue to include content plus progress and can be restored.

The bundled master retains the v0.4 content and tag paths. No vocabulary expansion,
Particle Zoo expansion, per-character assessment or English-to-Mandarin mode is
included in this patch. Those remain deferred; English-to-Mandarin will need
purpose-built prompts with accepted alternatives.

## Validation

66 automated tests cover core scheduling/content plus gradual-score previews,
short-retry credit, non-resetting lapses, score correction from prior history,
undo across skills and after completion, skip/postpone, continuous backup state,
non-mutating settings previews, future-only application, master replacement,
friendly labels, UI context and offline asset coverage.

Browser launch was attempted but blocked by the runtime's socket restriction.
No visual browser or physical-iPhone validation is claimed. The CSS overlap fix
is grounded in the screenshot and the conflicting absolute-position rule.
The release package is extracted and rebuilt to verify its deployment byte for byte.
