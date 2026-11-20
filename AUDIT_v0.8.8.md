# Cíyán v0.8.8 — fourth mobile UI and study progress audit

Date: November 20, 2026. Baseline: full v0.8.7 source. This is a targeted study UX and regression audit, not a claim of native iOS Safari certification.

## What changed

1. **Compact Due and New rows in all study views.** Two short rows use a left-aligned **Due** or **New** label, a 7 px progress track, and a right-aligned completed/total count. A11y: each bar has an accessible name and value. Neither requires scrolling to a separate Stats screen.
2. **Due excludes new introductions.** On the study home screen, the Due numerator uses *distinct due review items completed today* and the denominator includes those plus items still due in enabled practice modes. During continuous practice, Due is based on the due-at-start set plus newly due exercises in that session, excluding new introductions, and reflects items still due. Skipped/postponed exercises are **not** treated as reviewed. Chapter Study uses only scheduled due keys in the selected chapter study scope. The chapter readiness percentage and the Due percentage measure different things and are not conflated.
3. **New only with a configured limit.** New reports the number of unique vocabulary words first encountered on the user's local calendar day against `settings.newWordsPerDay`. It includes words introduced via both normal practice and the Reader, because both record the same vocabulary history. Unlimited (`null`) suppresses the second bar. A limit of zero is valid and displays a zero-cap bar. **Important:** the existing setting limits new vocabulary, *not* new grammar, term-only chapter cards, or new drawing/particle exercises. This release does not change scheduling policy or unlock logic.
4. **Focus-first mobile presentation.** Fixed auto-scroll to anchor the new bar instead of scrolling it offscreen when a new card appears. Moved the formerly prominent 3× session counters to a collapsed **Session details** expander below answer/grade controls, reducing vertical clutter. The flashcard remains the dominant element. Fixed a high-contrast white particle gap background in dark mode.
5. **Offline and backup correctness.** Updated the service worker cache version and included the new progress module in its precache, preventing offline failure after upgrading. Added an explicit identity migration from v0.8.7 to v0.8.8, preserving all study data and settings. Updated package/version metadata and documented the reconstructed history.

## Verified tests and browser rendering

- **254/254 Node.js automated tests pass**, including 8 additional tests for due scope, duplicate reviews, skip, fresh cards, daily caps (null, zero, finite, over limit), local-day history, backup migration and offline asset inclusion.
- Executed the real application JavaScript in isolated Chromium with mocked IndexedDB, Cache API, and local chapter downloads. Tested home with unlimited cap (Due only); home with 2 due and 2 of 10 new introductions (two rows); active vocabulary due 0/2; reveal; Good review updates Due to 1/2 without changing New 2/10; chapter archive loading and Reader due 0/1; chapter reveal; extra-long chapter term at 428, 390 and 320 CSS px; all five individual practice renderers; unlimited cap during active practice; and dark mode.
- **17 full-resolution screenshots** captured. iPhone 13 Pro Max viewport: 428×926 CSS px and DPR 3 (1284×2778 image pixels), plus 390px and 320px narrow-device cases. Document width never exceeded viewport; no uncaught page JavaScript errors in the controlled tests.
- All 23 existing Panlong chapter JSONs and archived ZIPs are **byte-for-byte unchanged** from v0.8.7. All study logic changes are backward-compatible; no user content was reset.
- The original uploaded `.git` contained 39 existing commits ending at v0.8.4. `git fsck` passed. The provided complete repository preserves those objects, branches and tags, adds separate reconstructed source snapshots for v0.8.5, v0.8.6 and v0.8.7, then commits v0.8.8. The Git origin URL is sanitized to a plain HTTPS GitHub URL without stored tokens. It can be cloned and built locally.

## Remaining device-only risks and deeper observations

- System Mandarin speech without headphones remains unverified on a real iPhone. The controlled Chromium browser sometimes reports a `speechSynthesis` failure because this environment has no genuine output audio device, which is not evidence of a native Safari fix or regression.
- Azure narration can have estimated word-to-audio timing drift. Real audio playback, VoiceOver, PWA background/resume, and iOS storage eviction/backup restoration still require physical-device tests.
- The Due row intentionally represents **scheduled reviews currently cleared**, not all cards answered and not the chapter's readiness threshold. If a reviewed item becomes due again, progress can move backwards; this matches its genuinely outstanding status. The denominator may increase as items newly become due. This is not a fixed-length session quota.
- An older saved legacy session uses global daily due progress for its vocabulary or grammar mode rather than a reconstructed session-start snapshot. Newly created continuous sessions have their own due snapshot. Historical pre-v0.8.8 session due baselines were not present to reconstruct exactly.
- All code/content-dependent tests pass, but independent native Mandarin linguistic review of chapter-specific term meanings and grammatical contexts remains valuable.

## Developer and deployment steps

- Source and complete Git history: `Ciyan_v0.8.8_FullGitRepo.zip`; unzip, then `cd Ciyan && git status && npm test && npm run build`.
- Deployment only: `Ciyan_v0.8.8_Deploy.zip`, which contains the built Cloudflare static folder contents.
- The public Workers URL is **not** updated by these artifacts; deployment remains a separate action.
