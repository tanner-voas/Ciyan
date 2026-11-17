# v0.4 release audit

Base: uploaded Ciyan_PWA_Git_v0.3.2(1).zip, with existing Git history retained.

Implemented: drawing with per-character vector pads, adaptive mixed sessions,
independent skill records, 12 authored Particle Zoo exercises plus import schema,
slash-path tag trees, configurable score intervals with geometric interpolation,
FSRS alternative, adaptive overdue/upcoming histogram, expanded statistics.

Validation:
- 54 automated tests pass, including existing content coverage and core tests.
- New tests cover parent/descendant filtering, exclusion precedence, tag boundaries,
  fractional interval arithmetic, settings updates and due-date recalculation,
  independent skill records, prerequisites, disabled modes, scheduling fairness,
  immediate drawing-cue avoidance, particle choices and insertion positions,
  full backup restoration, clear-record behavior, histogram counting and resizing,
  normalized drawing strokes and pad navigation/reveal in UI handlers.
- Existing offline tests verify service-worker assets and obsolete-cache cleanup.
- Package rebuilt with the no-argument Python packager. Release extraction and
  byte-for-byte deployment comparison are checked during packaging.
- Expanded vocabulary and grammar are compared with v0.3.2 after excluding tag
  fields: content and IDs are unchanged. Only tag paths change inside those decks.

Limitations:
- Physical iPhone/Safari and visual browser testing remain unverified. Headless
  Chromium launch fails because the runtime denies its socket operation. No visual
  validation is claimed. UI tests use DOM/IndexedDB mocks; canvas tests use a
  drawing-context stub and exercise pointer logic, not pixel rendering.
- Handwriting is self-graded. Particle tests use authored accepted answers.
- FSRS memory estimates, score smoothing and cross-mode balancing are not fitted
  to this user's history and do not guarantee a particular retention level.
- Built-in Particle Zoo is a focused starter set, not comprehensive coverage.
