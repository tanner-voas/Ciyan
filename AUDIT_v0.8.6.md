# Cíyán v0.8.6 — second, deeper source and runtime audit

**Baseline:** `Ciyan_v0.8.5_Source.zip` supplied in the previous audit. This is a local source revision, **not a live deployment**. During this audit the publicly accessible `https://ciyan.tannervoas.workers.dev` still identified itself as v0.8.4. It has not been modified.

**Important testing distinction:** The Chromium environment blocks normal navigation to the public site, local HTTP servers, and file URLs. To exercise the *actual* app code rather than static imitation, a controlled test runner loaded the genuine `index.html` and CSS using Chromium's `set_content`, intercepted ESM requests and supplied the corresponding unmodified files from this repository. The runner provided browser storage/network shims and an integrity-preserving fixture for one hosted chapter; it did not execute live Azure requests or the real iOS Safari engine. The chapter-reading unlock was changed only in the test runner's in-memory copy; no application unlocking logic, learning history, or published content was modified.

## Screen capture and device geometry

**iPhone 13 Pro Max exact CSS viewport:** **428 × 926 CSS pixels**; pixel ratio **3**; resulting screenshot resolution **1284 × 2778**. Mobile emulation included touch input; all **13** captured states reported a 428-pixel document width (no horizontal overflow). The screenshot package contains the captured, unscaled PNGs:

1. Study home, 2. Study prompt, 3. Revealed study answer, 4. Words (filters collapsed), 5. Words (filters expanded), 6. Grammar (collapsed), 7. Grammar (expanded), 8. Reader preparation/gating, 9. Reader actual chapter prose, 10. Reader options, 11. Reading guide, 12. Reader after manual scroll, 13. Dictionary overlay.

Screenshots are Chromium approximations of the iPhone layout, **not native iPhone Safari screenshots**. Chrome's CJK fallback fonts can look different from the actual installed iPhone fonts.

## Source, build, and behavior checks

- **239/239 repository tests passed** (`npm test`), up from 236 before the changes. Added migration, gesture and collapsible-filter checks. All 14 hosted chapter ZIPs were extracted separately and their chapter JSON SHA-256 checked against the shipped manifest. The content itself was not editorially revised or independently compared to all source PDFs.
- The static deployment was successfully rebuilt with `python3 package.py`; the built content lives under `dist/ciyan` and is separately packaged in the deployment ZIP.
- Runtime startup and navigation through Study, Words, Grammar and Reader completed without JavaScript page errors. The test harness used a fresh simulated browser profile with the 11,893-word and 3,444-grammar-item production master.
- Runtime Auto Study successfully started, revealed a prompt, accepted a **Good** grade, added a history record, and finished the session. The study deck data and scheduling rules are unchanged.
- Runtime Words and Grammar initially each showed 20 entries on a collection page. Their filter panels expanded and collapsed, selecting a topic updated the displayed collection and active-filter summary without closing the panel, and Reset tags returned to the unfiltered state.
- Selecting Panlong chapter 1 downloaded the shipped chapter archive, decompressed it, verified the SHA-256 digest, parsed/stored the chapter, and displayed its study preparation gate. **The test harness alone temporarily set the chapter unlocked** to exercise actual reader text/rendering/guide interactions; no change to production unlock rules.
- Runtime Reader options opened, reading guide toggled on, paused manual scrolling moved the highlighted word, and, after the 350 ms write debounce, the saved chapter bookmark matched the new word (offset changed from 0 to 37). Double tap on an annotated word opened the dictionary overlay. No runtime page errors were emitted.
- Synthetic document-level `gesturestart` and two-touch `touchmove` events were **not** canceled after the code change. This tests the global cancellation bug, **not** an actual physical pinch gesture on iOS.

## Changes applied in v0.8.6

### 1. Restore mobile pinch zoom (high confidence, high impact)

v0.8.5 fixed the viewport and CSS configuration but unintentionally left event listeners in `app.js` that called `preventDefault()` on every Safari `gesturestart`, `gesturechange`, `gestureend` event and all two-finger `touchmove` events. They override the intent to permit pinch zoom. Those global blockers were removed. Drawing canvases and direct-manipulation targets retain their own scoped touch handling. This is a genuine code-level regression from the previous audit; the runtime synthetic-event test verifies the immediate mechanism is gone. Real iOS gesture behavior is still unverified.

### 2. Make Words and Grammar immediately browseable (UI; verified)

The full expandable topic tree and rating/knowledge filters previously occupied much of the first mobile screen, pushing the actual 20-entry collection far down. Both screens now start with a **Filters & topics** disclosure panel **collapsed**. The panel exposes a compact summary (`All entries` or active-filter count). Existing filters, tag-tree expansion, rating/knowledge controls, Reset tags, search, and pagination are preserved. Topic filtering remains session-only and does not change the backup or study data. A duplicate call that reapplied fonts to collection entries was also removed from `updateCollectionPage`.

### 3. Versioning and upgrade safety (verified)

Application identity is advanced from **0.8.5 to 0.8.6**, the shell service-worker cache is versioned for the new release, and backup versioning explicitly carries a **data-preserving identity migration** from 0.8.5 to 0.8.6. Content IDs, chapter files, FSRS records, language fonts, and speech settings were not migrated or changed. A regression assertion checks migration retains old backup data.

## Remaining risks, prioritized

### High — Actual iPhone audio/gesture testing

The prior user-observed issue of system voices producing audio only with headphones **has not been reproduced or cleared**. Chrome/desktop emulation does not model the iPhone audio route, mute switch, Siri/voice settings, Bluetooth, interruptions, or Safari's speech/audio-session policies. Test device speaker playback without headphones using a system Mandarin voice, then with headset/Bluetooth, then screen lock and background/resume. Likewise, confirm pinch zoom directly in Safari and the added-to-home-screen PWA, and verify that guide lock defers for three seconds after the finger lifts.

### High — Real backup/restore and storage pressure

The automated suite tests backup and migration logic, and the simulated runtime tests review persistence. A native iPhone destructive restore/restart test is still essential because CacheStorage, IndexedDB storage eviction, Files export/import and PWA storage lifetime differ from this test harness. The existing design deliberately omits **custom chapter text** from full backups. Keep custom chapter JSON files separately.

### Medium — Azure narration timing fidelity

`reader-cloud-speech.js` highlights the current word by proportionally mapping elapsed audio duration to text character offsets. It is **not** aligned to real spoken word timestamps, so pronunciation timing and highlighting may visibly diverge. The cloud implementation also requires a live Azure key and iOS device to validate actual quota use, audio-session interactions, and player pause/resume. No cloud TTS change is made in this release.

### Medium — Initial load and collection filters

The production master-data module is approximately 4.4 MB uncompressed. Cold-start parsing, memory footprint, iOS cache lifetime, and energy use were not directly benchmarked on a phone. Although the new filter disclosure hides the topic tree, the tree is still constructed on collection navigation; lazy rendering it could further improve responsiveness if native profiling shows a bottleneck. Do not infer Safari startup times from controlled desktop Chromium.

### Medium — VoiceOver and small controls

The reader contains many annotated `<span role="button">` words with a keyboard path and an English `aria-label`, but the outer document is English (`lang="en"`); mixed Chinese pronunciation in VoiceOver needs checking. Some compact transport/icon controls fall below the often-recommended ~44 CSS-pixel touch target size. Enlarging hit regions without disrupting the dock would be an appropriate later UI pass.

### Lower — Typography snapshot consistency

The Chromium-rendered reader shows differences in Chinese glyph appearance between adjacent passages despite the same computed font-family. That is likely due to the test machine's CJK fallback/font coverage, not evidence of a source-text change. Do not alter user-selected font randomness or the novel's original characters based on emulator screenshots alone. Validate typography on the target iPhone and installed fonts.

## Deployment and rollback

Export a complete progress backup first. Deploy either the full source using your existing Wrangler configuration or the separately packaged static build through your established Cloudflare flow. Retain the current Worker name/domain; these files **do not** deploy automatically. Test app version v0.8.6 after reload and ensure existing chapter progress survives. If reverting, keep the backup and deploy the prior v0.8.5 source/build. Be careful that PWA service-worker updates can wait for existing tabs to close or for the app's explicit update flow.

This release focuses on a verified accessibility regression and navigation friction. It does **not** claim to have resolved the outstanding iPhone speaker/audio issue or to have conducted live Cloudflare/real-device end-to-end testing.
