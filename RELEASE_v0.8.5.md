# Cíyán v0.8.5 — targeted audit fixes

Based on the uploaded v0.8.4 repository. No chapter text, item IDs,
learning schedules, Azure keys, or previously saved voice profiles are changed.

## Reader controls and navigation
- Fixed the double-tap race: a dictionary lookup within the advertised 360 ms
  window no longer gets interpreted as two single taps after 285 ms.
- When the guide is enabled but paused, scrolling now moves its bookmark and
  highlighted word to the first visible annotated word. Playback can resume
  from the position the reader deliberately scrolled to. The existing
  touch-hold and 3-second follow suspension during playback remain intact.

## Study and accessibility
- Added a compact Start Auto Study action near the top of the Study screen,
  using the **same eligibility calculation** as the existing Auto Study panel.
  The study pool, mode weights, priorities, and review behavior are unchanged.
- Removed the page-level pinch-to-zoom restriction and corrected the
  global touch-action setting to permit pinch zoom while still avoiding
  double-tap browser zoom. Reader follow already suspends while the visual
  viewport is zoomed.

## Azure speech limits
- Limited configurable Azure sentence lookahead to 12 and decoded clip cache
  to 64. Restored legacy settings beyond these limits are clamped; playback
  also independently enforces these limits. This protects quota and memory
  against accidentally excessive values. The defaults remain 2 and 8.
- Updated documentation to remove an obsolete reference to an authored
  vocabulary mode.

## Validation
- Existing automated unit/integration suite (Node test runner).
- Reader chapter integrity checks and deploy-package assembly.
- Static mobile and desktop HTML/CSS snapshots for visual inspection.

**Testing limitation:** Headless Chromium navigation is restricted by this
execution environment, including access to the public live URL and localhost.
The snapshots render real app-generated markup and CSS but are not a substitute
for interactive iOS Safari testing. No hosted deployment was performed.
