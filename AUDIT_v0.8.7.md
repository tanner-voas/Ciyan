# Cíyán v0.8.7 — independent third UI and content audit

Date: 20 November 2026. Baseline: v0.8.6 supplied from the prior completed audit. Target device: **iPhone 13 Pro Max, 428 × 926 CSS pixels, DPR 3 (1284 × 2778 rendered pixels)**. Desktop or native iOS Safari is **not** claimed as tested.

## Summary and result

**246/246 Node.js automated tests passed**, including 7 new v0.8.7 content and compatibility tests. A controlled Chromium runtime loaded the actual JavaScript, styles, app state, and chapter archives; 13 interaction/render screenshots were captured (11 views at 428px plus two narrow-width cases). The app executed without JavaScript page errors or measured horizontal document overflow. The 12 new Panlong Volume 1 chapters 12–23 were integrated, and the 11 original chapter JSON and ZIP assets are **byte-identical** to v0.8.6.

### A. UI findings and changes

1. **Oversized chapter Study prompts (fixed).** Original Chapter Study reused a short-word hero style (54–86 px). Longer names and grammar constructs could wrap badly or spill outside the card. Added independent `reader-study-prompt` sizing using actual character count and grammar type. Four responsive styles adapt short, medium, long, and extended prompts. Added word-breaking, balanced wrapping, compact pinyin and translation presentation, readable 48px-min grade actions, and split metadata/footer. Real chapter 13 grammar prompt `……只有……才……` and a synthetic long term were exercised. The latter fits with no overflow at both 390px and 320px widths; synthetic term is **not** part of shipped story content.

2. **Chapter readiness overload (fixed).** The previous large explanatory paragraph and numerous separate controls pushed the main action down the viewport. Replaced with concise readiness %, progress track, three activity metrics, visible Study and conditionally enabled Read buttons, and collapsed optional guidance. The currently selected chapter's focus count is correctly based on its own `c.focus.length`, not the accumulated earlier-chapter weighted analysis pool. Actual Chapter 23 showed 29 focus items (22 terms and 7 grammar entries).

3. **Chapter navigation density (improved).** The reader now hides the Volume dropdown when there is only one volume and keeps the novel/chapter choices vertically stacked, with a less dominant 'Import chapter JSON' action. The full chapter sequence remains global 1–23.

4. **Long entries within Chapter vocabulary (fixed).** Long headwords use a narrower-screen one-column layout rather than squeezing Chinese, pinyin, and meaning into inadequate columns.

5. **Words/Grammar filters (verified).** The preceding release's collapsible filter panels remain intact, making collection entries available on the first mobile screen.

### B. Content additions and checks

All 12 requested chapter text files were read from the supplied archive. The conversion strips **only the volume-line header** for the app's narrative title convention and preserves the chapter title, original prose, punctuation, spacing, paragraph divisions, and unusual glyphs exactly. Reconstruction `chapterText(JSON)` was compared byte-for-byte against the normalized input (UTF-8 with CRLF normalized). No narrative has been rewritten, translated, or simplified.

| Chapter | Paragraphs | Annotated items | Focus terms | Focus grammar |
|:--:|--:|--:|--:|--:|
| 12 | 53 | 517 | 18 | 7 |
| 13 | 66 | 497 | 21 | 7 |
| 14 | 67 | 544 | 18 | 7 |
| 15 | 44 | 486 | 24 | 7 |
| 16 | 78 | 498 | 16 | 7 |
| 17 | 67 | 495 | 17 | 7 |
| 18 | 72 | 583 | 20 | 7 |
| 19 | 76 | 459 | 28 | 7 |
| 20 | 79 | 500 | 16 | 7 |
| 21 | 54 | 474 | 33 | 7 |
| 22 | 74 | 500 | 26 | 7 |
| 23 | 92 | 593 | 22 | 7 |

Totals: **822 paragraphs**, **259 chapter-specific term appearances** (88 unique term IDs), and **84 chapter-specific grammar entries** (7/chapter). Coverage is intentionally **not** deduplicated across chapters: character names, magic-system concepts, and other key terminology recur in later chapters' focus lists whenever present. Among the reappearing examples are 林雷, 德林柯沃特, and 圣域魔导师. Individual chapter priority lists range from 23–40 items including grammar. All other annotated words appear through auto vocabulary rather than an authored-vocab bypass.

Preserved existing term IDs and glosses where available, extended the lexicon with authored proper-noun/magic-system terms and missing single-Hanzi English glosses, and supplied chapter-evidenced grammar structures with pinyin and English explanations. Each grammar pattern was checked for a matching trigger in its own chapter source. **Limit:** trigger evidence confirms a form appears, but not every use of a word is a fully instantiated two-clause pattern; language-teacher review remains valuable. Pinyin and morphology, particularly ambiguous multi-reading characters, may still have exceptions.

New builder and source files:

- `tools/build-panlong-12-23.mjs`, reproducible deterministic JSON/tokenizer builder
- `reader/panlong/volume-1-raw/012.txt` … `023.txt`, unedited supplied text
- `reader/panlong/volume-1-ch12-23-terms.tsv` and `volume-1-ch12-23-characters.tsv`, original terms / character glossary with translations and pinyin
- `reader/panlong/volume-1-grammar-12-23.json`, per-chapter grammar curriculum
- `reader/panlong/chapters/012.json` … `023.json`, app-readable source
- `chapters/panlong-12.zip` … `panlong-23.zip`, production hosted content (generated)

The hosted catalog now contains **26 entries: 23 Panlong chapters plus 3 sample readers**. All packaged ZIPs are verified against SHA-256 digests and exact uncompressed JSON bytes. Importing chapters 1–23 sequentially preserves existing item identities and returns chapter 23 as the current chapter. Versioned backup migration from 0.8.6 to 0.8.7 is an identity migration, preserving study history.

### C. Exact runtime testing boundary

The Playwright harness intercepted a local test domain and loaded the **actual app** in Chromium with mocked offline storage/cache/network. This is closer to a browser execution test than static HTML screenshots. Interactions exercised: app navigation to Study, Words, Grammar, and Stats; chapter selectors and sequential background loading through 23; actual chapter ZIP inflation, digest check, and preparation; reader Study card rendering, grade/question modes and real grammar focus; unlocked chapter prose rendering with a **test-only local unlock fixture**; 428, 390, and 320 CSS pixel viewports. Native unlock gates were not altered in production. Screenshot dimensions at 428 are 1284×2778 physical pixels.

The harness is not a substitute for Safari on an actual iPhone 13 Pro Max. It does **not** prove Web Speech API sound routing, physical speaker vs Bluetooth, Azure latency and payment quota, offline restart after iOS process eviction, pinch/gesture handling, or VoiceOver. Do not treat mocked networking as live hosted-site verification. Hosted deployment is not changed by this audit.

### D. Remaining issues ranked by importance

1. **High — iOS speech output.** The reported non-Azure speaker-only audio failure requires testing on iOS Safari/PWA with real user gestures, silent mode, media session, output routing, and spoken utterance state.
2. **Medium — TTS alignment.** Native Web Speech boundaries are used when available, otherwise estimated by elapsed character rate. Azure audio does not supply exact per-word timing to the guide, so highlight drift can accumulate.
3. **Medium — chapter pronunciation.** Manually authored new terms and character fallback should have targeted native Mandarin reading/meaning review; deterministic segmentation and gloss coverage does not guarantee ideal phrasing.
4. **Medium — offline pressure and cold starts.** The master dictionary/module size and 23 growing chapter archives could merit profiling on lower-memory iPhones. Chapter text caches and full backup restoration should be stress-tested after iOS storage eviction.
5. **Low — collection/reader UX polish.** Some three-button vocabulary tab labels wrap at narrow widths. The reader is functionally usable but could benefit from a focused accessibility pass (screen reader labels, touch target sizes, dynamic type) rather than a broad redesign.

### E. Release and rollback

Use `Ciyan_v0.8.7_Deploy.zip` to deploy static built files to Cloudflare, or `Ciyan_v0.8.7_Source.zip` for the complete source. A binary-safe Git patch against **v0.8.6** is also included. Do not apply this patch on top of v0.8.4 or v0.8.5. After deployment, verify new catalog offers CH0012–CH0023, chapter archives are served with the correct MIME type, and locally saved progress survives the service-worker update.

To reproduce after changing authored inputs: `node tools/build-panlong-12-23.mjs`, `python3 tools/package-chapters.py`, `npm test`, then `python3 package.py`.
