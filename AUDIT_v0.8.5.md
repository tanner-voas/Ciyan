# Cíyán v0.8.5 — source, UI and release audit

**Basis:** the user's `Ciyan(1).zip` repository at v0.8.4 and the linked public Workers site. The site identified itself as Cíyán v0.8.4 during a web lookup, but this environment prevented scripted browser navigation and runtime interaction with it. The application was **not** redeployed. This report distinguishes verified source/build/test findings from untested device behaviors.

## What I verified

- The baseline Node unit/integration suite passed **233/233** before edits. After changes, **236/236** passed (`npm test`); the added coverage targets delayed double tap, paused-guide seeking and bounded settings/accessibility. A number of existing assertions were updated for the new app version.
- The production bundle rebuilt successfully with `python3 package.py`. It contains **14 hosted chapter ZIP archives** and the shared static files for the Cloudflare Pages/Workers deployment. The bundle is approximately 5.2 MB on disk; this is not a measured network transfer size.
- `node tools/verify-reader.mjs` verified the original source locks and exact text reconstruction for the three locked Panlong chapters. Other chapter integrity and package checks are covered by the repository test suite; I did **not** independently compare all chapter texts against their originating PDFs.
- I rendered the app's actual generated HTML/CSS using a headless rendering harness at a **390 × 844 mobile viewport** and a **1280 × 800 desktop viewport**, reviewing the Study home, Reader library, Settings and vocabulary-card states. These are offline **static renderings** with mock browser data, not screenshots of the live deployed application and not touch-interaction tests.
- `node --check` syntax checks and `git diff --check` completed without errors. The patch applies cleanly to the uploaded v0.8.4 repository base.

## Fixes made in v0.8.5

### Reader — functional, high priority

**Delayed double taps could be lost.** The single-tap timeout was 285 ms while the double-tap window was 360 ms. A second tap in that 75 ms gap was treated as a new first tap instead of opening the dictionary. Both are now aligned to 360 ms; a regression test covers a second tap at 300 ms.

**Paused reading did not reliably track intentional scrolling.** With the guide enabled and not playing, manually scrolling elsewhere previously left the reading pointer at its old word. The guide now highlights and bookmarks the first visible annotated word. Playback-follow behavior and its three-second touch grace period remain unchanged.

### Study — usability, medium priority

**Auto Study was unnecessarily buried.** On the mobile Study screen, users had to scroll past introductory and pool-selection content to reach the main action. A prominent Start Auto Study button and due/new summary now appear near the top, while the full control panel remains available below. Both use the same eligibility predicate; review selection and mode weights are unchanged.

### Speech — safeguards, medium priority

**Unbounded cloud prefetch and decoded caches were possible.** Azure sentence lookahead is now limited to 12; decoded sentence cache to 64. The limits are enforced in the UI, preference normalization, backup migration and playback, while the defaults remain 2 and 8. This reduces exposure to unexpectedly heavy requests and excessive memory use, but **does not guarantee a particular Azure bill or quota**.

### Accessibility — low-to-medium priority

**Pinch zoom was obstructed.** The `maximum-scale=1, user-scalable=no` viewport properties and the global `touch-action:pan-x pan-y` rule are now corrected. `touch-action:manipulation` allows pinch zoom while preserving deliberate double-tap interactions on annotated words.

## Remaining risks and recommended next checks

1. **iOS Safari / PWA gestures and audio output — high priority, unverified.** Device testing should cover double tap on the same Chinese word, horizontal/touch scrolling, guide follow after the three-second grace period, guide seek while paused, all TTS voices **without headphones**, Bluetooth/headphone changes, and background/resume behavior. These require a real iPhone. Previous reports of speaker-only issues cannot be ruled out by the present tests.
2. **Cloud narration word alignment — medium priority.** `reader-cloud-speech.js` estimates the spoken word from elapsed playback time and a proportional character offset, not per-word audio timestamps. Audible emphasis and reader highlight may diverge when syllable duration varies. Azure word-boundary timing or a forced-alignment approach warrants separate investigation.
3. **Cold-start performance and on-device memory — medium priority.** `master-data.js` is approximately **4.39 MB uncompressed**, and the app contains 11,893 vocabulary entries and 3,444 grammar examples. There are no measured iPhone parse, memory or interaction timings in this audit. Profile an empty-cache launch on an actual device before changing loading architecture or promising performance gains.
4. **Custom chapter recovery — medium priority, existing documented limitation.** Custom chapter metadata is exported in the full backup, but chapter text is not. Preserve imported chapter JSON separately, especially before clearing browser data or moving to a new phone.
5. **End-to-end coverage — medium priority.** Current tests mostly exercise modules and simulated browser state; add a repeatable device/browser test suite for reading a hosted chapter, importing/restoring backup, completing a review, voice setup/unlock and voice playback. A Cloudflare staging deployment would make this safer.
6. **Azure key security — existing consciously accepted tradeoff.** The four-digit PIN is a casual protection for local encrypted credentials, not a defense against a determined attacker with access to the backed-up secret. I did not change the vault or credentials model.

## Release and upgrade notes

The revision is **v0.8.5**, not a hosted release. It retains the existing dictionary, chapter payloads, item IDs, stored learning history and user voice-profile structure. A bounded Azure cache/lookahead preference may be lowered on migration if it was previously above the new ceilings. Export a complete backup before updating or testing on your primary phone. This repository uses `npm test`, `python3 package.py` and `npm run deploy:worker`; for the connected Workers site, preserve its existing Cloudflare project/worker configuration rather than creating a new origin.

The supplied `.patch` upgrades the source repository; the `Source.zip` includes the full modified source without its `.git` directory; the `Deploy.zip` is the generated **static content only**, not a full Wrangler project. The screenshot ZIP contains selected static test renderings labeled as such.
