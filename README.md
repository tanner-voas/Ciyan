# Cíyán (词言) v0.8.8

Cíyán is an offline-first Mandarin learning PWA with flashcards, grammar,
FSRS review scheduling, a graded novel reader, drawing practice and
user-controlled typography.

## v0.8.8 — compact Due/New study progress

Every active study mode (Vocabulary, Grammar, Drawing, Particles, Listening,
Auto Study and Reader chapter flashcards) now shows the same unobtrusive bars:
**Due** counts only scheduled due reviews cleared from the study scope;
**New** counts distinct vocabulary words first encountered today against the
optional New vocabulary words per day limit. If the limit is unlimited, the
New bar is hidden; zero is a valid limit. The bars are intentionally separate
from total answered exercises and chapter-readiness percentage.

The study scroll anchor keeps the bars visible above the flashcard, and verbose
session counters are under an optional Session details expander. Existing
backup/study data is preserved by an identity migration from v0.8.7.

To develop from a fresh checkout, install Node.js 22+ and Python 3, run
`npm test`, `npm run build`, and `npm run serve` in the repository root.
Deploy using the built `dist/ciyan/` folder. No `npm install` is needed for
the application itself. The Git repository includes original history through
v0.8.4 and reconstructed release snapshots for v0.8.5–v0.8.7.

See `AUDIT_v0.8.8.md` for runtime testing details and limitations.

## v0.8.7 chapter expansion and UI audit

Panlong Volume 1 now ships **all 23 chapters**, including the twelve newly
provided original-text Chapters 12–23. They reproduce the supplied prose
exactly and contain dedicated chapter-specific terms and grammar; recurring
important terms are focused again when used in subsequent chapters. All
chapter packages are integrity-checked, and the novel remains one linear
sequence across the volume. The original 11 chapter JSON packages remain
unchanged. Build and curation inputs are in `reader/panlong/volume-1-*`;
`node tools/build-panlong-12-23.mjs` regenerates Chapters 12–23 from their
verbatim text and curated annotations, then `python3 tools/package-chapters.py`
regenerates the hosted ZIP archives and manifest.

Chapter Study now uses content-length-aware typography and accessible wrapping
for long grammar patterns and terms, with tested 428px, 390px, and 320px
viewports. Chapter readiness shows the current chapter's focused items (not
prior chapters' accumulated priorities), a compact progress summary, and a
prominent Study action. Words and Grammar topic filters remain collapsed by
default with the full options intact. Reader and drawing retain their existing
behaviors; the previous global pinch-zoom suppression was removed in v0.8.6.
See `AUDIT_v0.8.7.md` for test evidence and remaining native-iOS checks.

## Reader in v0.8.0

The **Reader** library has vertically stacked Novel, optional Volume, and
Chapter selectors, plus Upload chapter JSON. Novel names display as **author •
novel** in alphabetical order. Panlong Volume 1 is labeled `V01 · 盘龙之戒`
in the chapter metadata; a single volume omits the redundant volume selector. volume is only a navigation convenience and never changes the
global novel-to-chapter order, chapter unlocking or reading progress. The three
sample story entries are labeled TSK1, TSK2 and TSK3 collections, and have no
Volume selector. The Novel and Chapter selectors combine the master hosted
catalog (deployed with the app) with your custom chapter index. Selecting a
master chapter automatically downloads it and prerequisite chapters when
needed; downloaded text is cached for offline reading. Custom chapter metadata
is retained in full backups, while custom chapter **text is not**. If a custom
chapter is missing from the browser cache, Cíyán identifies the missing novel
and chapter and requests that exact JSON again; newer chapter revisions are
accepted. Back up and retain your own custom chapter JSON files separately.

In the reading view, **single tap** the prose to show or hide its controls.
**Double-tap an annotated Chinese word** for its dictionary entry. From the
entry, **Guide from here** (or **Read from here** when narration is enabled)
starts at that word; ordinary vocabulary entries can also be edited. The top
bar includes exit, previous/next chapter and table of contents. Those
navigation controls do **not** mark chapters complete. The button at the **end
of the chapter** explicitly marks it complete and opens the next chapter when
one is available.

The bottom reading dock adapts to your settings: its guide controls appear
when the reading guide is enabled and its Mandarin voice selector appears when
text-to-speech is enabled. Use the **•••** button for reading options. You can
also set the guide, narration and weak-word underline defaults under Settings
→ Reader. Settings groups are independently collapsible and closed by default,
except for About. The new default weights for TSK/TSK1 through TSK/TSK9 are
2560, 1280, 640, 320, 160, 80, 40, 20 and 10, respectively. Previously
customized weights are preserved.

Panlong Volume 1 now includes Chapters 1–23. Chapters 4–11 retain
the text of the supplied PDF-verified source, including unusual historical
glyphs; the first three JSON and chapter hashes are unchanged, preserving your
previous study work. All new chapter ZIPs are deployed automatically alongside
the index. Author, volume and original chapter metadata can be retained in
custom-index full backups; chapter text itself is never backed up.

Both Cloudflare Pages and Cloudflare Workers deploy from the same
`dist/ciyan` build, as documented below.

## Speech and listening in v0.8.3

Open **Settings → Speech** to choose a Mandarin voice and set reading speed, pitch, Azure lookahead and paragraph pauses. The reader and study screens share these preferences. Each voice remembers its own CPM and pitch. Existing settings carry forward for the previously selected voice. Azure fetches two upcoming sentences by default and reuses up to eight decoded clips by default. Set Maximum cached sentences to adjust this limit, including zero to disable caching. Transport controls can restart speech at any annotated word.

To use Yunxi or Yunyang, expand **Azure credentials**, enter the region and key, and save your speech settings. Choose a four-digit PIN when prompted. Opening or reloading the app starts a new locked session. Unlocking once allows playback and credential edits until the session ends. Full backups include the encrypted credentials alongside readable study progress. On a new device, restore the backup, then use the PIN to unlock speech. Under **Reset & recovery**, change the PIN after unlocking or reset secrets to erase the key and choose a replacement PIN. The region is an ordinary speech setting.

Listening uses the same sentence prerequisites as Grammar and maintains its own mastery. Replay the audio, optionally reveal the English hint, then reveal the Chinese, pinyin and translation to grade your recall. Using the hint caps the grade at Good. Enable Listening in Auto Study for the current session when you can play audio.

## Chapter preparation and study

**Reader** automatically checks distinct annotated words in each chapter,
plus chapter-critical terms and grammar from its focus list. There is no
authored-vocabulary mode; HSK1–4 vocabulary is assumed as the starting base
unless a recorded low score overrides that assumption. Each required item qualifies with a saved score of 1.5,
three Good grades or one Easy during this app run. Study prioritizes due
reviews, new items and then early practice. Early practice leaves the saved
schedule and history untouched. Study lists also offer earlier due items and
full-chapter preparation. Vocabulary reviews use the main vocabulary schedule.
Terms and grammar belong to the novel. Opening an eligible chapter unlocks it
permanently. Reading progress, chapter completion and the custom chapter index
travel in the full backup. Chapter prose remains in the hosted package or
browser cache, not in full backups.

The optional reading guide starts paused at 120 characters per minute. Step
through words or play continuously. While playing, the bookmark follows the
highlighted word. When paused, manual scrolling seeks to the first visible
annotated word, so the guide can resume from that point.

In Settings, **Clear learning records** resets review data and reading
progress, **Clear settings** restores default preferences, and **Clear
dictionary** keeps vocabulary and grammar entries with learning evidence.
**Reload cards** restores the bundled master. The backup carries the records
of studied custom items removed by Reload cards.

### Chapter authoring and verification

The package is UTF-8 JSON. Each paragraph is a stable ID and a token sequence. Literal strings supply punctuation and spacing. A one-element array identifies a dictionary entry whose Chinese headword supplies the visible text. An optional second array element preserves an alias such as a full name while sharing the same item and score. Automatic chapter study derives vocabulary from all annotated spans. The `focus` list contains only chapter-critical terms and grammar, which receive six times the ordinary selection weight. Legacy `authored` lists remain importable but cannot limit vocabulary selection. Novel IDs and item IDs should be reused across chapters. Increment the revision when changing a released file.

The exact uploads are in `reader/panlong/original/`. Clean references remove paragraph-end website counters, trim surrounding indentation and use one blank line between paragraphs. Dates and numbers within the narrative are preserved. SHA-256 digests in `locked.json` pin those references. Run from the repository root:

```sh
node tools/verify-reader.mjs
node tools/build-reader.mjs
node tools/build-panlong-extended.mjs
node tools/refresh-reader-focus.mjs
node tools/verify-reader.mjs
npm test
python3 package.py
```

The builders use the bundled vocabulary, supplemental glossaries, the versioned `reader/focus-grammar.json` focus specification, and Node’s Mandarin word segmenter. The committed packages can be imported directly. Use Node 24 to rebuild. The verifier checks both the raw-to-clean transformation and reconstruction through the reader’s own token model.

Fonts continue to download and cache on demand, with a manual upload fallback.
Font bytes are not part of the Git ZIP, deployment or learning backup.

The bundled master contains 11,893 vocabulary entries and 3,444 grammar
examples. User content and learning records persist across releases and are
included in full JSON backups exported to Files.

## Context matching

Every vocabulary word can match authored grammar by **exact token**, a sequence of
**complete adjacent tokens**, or a substring **inside a single token**. No match
may cross a token boundary with only part of either token. Exact matches are
preferred, followed by complete-token combinations, then contained substrings.
The context interface shows the rule and literal source tokenization.

Example: `{没}{关系}` can match 没关系, 没, 关系, 关, and 系, but not 没关.
`{汉子}` can match 子. An existing independent `{没关系}` example remains
preferred for that word.

At **v0.6.2**, the master contained 2,761 grammar examples; subsequent releases
expanded this to 3,444. The context-matching rules remain unchanged. Contained-
character matches indicate visible written usage, not necessarily the same
standalone definition or pronunciation.

See [v0.6.2 release notes](RELEASE_v0.6.2.md),
[coverage report](content/context-coverage-summary-v062.json), and
[per-word coverage](content/context-coverage-v062.csv).

Build the master reproducibly with `python3 build_v062.py`; package the site
with `python3 package.py`. No writing hints, saved drawing history, radical
lessons, or English-to-Mandarin mode are included.

## Development and Cloudflare Git auto-deployment (Pages or Workers)

Cíyán is a static PWA. The repository root contains source, test files,
release history and packaging tools, so **do not publish the repository root**.
Both deployment targets use the exact same static output: `dist/ciyan/`, built
by the dependency-free Python packager. The generated site includes
`index.html`, the service worker, `_headers`, the manifest, icons, hosted
chapter ZIPs, and application JavaScript. No server-side runtime, app secrets
or Azure credentials are part of the deployable site.

To verify the shared build (requires Node.js and Python 3):

```bash
npm test
npm run build
# Inspect dist/ciyan/index.html and dist/ciyan/chapters/*.zip
```

### Option A: Cloudflare Pages (Git integration)

Create a Cloudflare **Pages** project linked to `tanner-voas/Ciyan`, then set:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | `None` |
| Root directory | `/` (repository root) |
| Build command | `npm run build` |
| Build output directory | `dist/ciyan` |
| Environment variables | None |

Cloudflare Pages deploys the directory automatically on each push to `main`.

### Option B: Cloudflare Workers with static assets (Git integration)

The repository also contains `wrangler.jsonc` for a scriptless static Worker.
Its `assets.directory` points at **the same `dist/ciyan` folder**. The
configured Worker name, `empty-dawn-08a7`, matches the existing deployment;
if you use a *different* Worker, change `name` in `wrangler.jsonc` to match its
project name before enabling automated deployment. This configuration makes
no changes to the app's JavaScript or local storage.

In the Cloudflare dashboard, open **Workers & Pages → empty-dawn-08a7 →
Settings → Builds**, connect `tanner-voas/Ciyan` and configure:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `/` (repository root) |
| Build command | `npm run build` |
| Deploy command | `npm run deploy:worker` |
| Environment variables | None |

The deploy script runs `npx --yes wrangler@4 deploy` and uses
`wrangler.jsonc`. Cloudflare Workers Builds normally supplies deployment
credentials itself; do not commit API tokens or Azure credentials. Python 3
is available in Cloudflare's build environment. For an optional manual
Worker deployment after authentication, run:

```bash
npm run build
npm run deploy:worker
```

**Important:** Deploying to the named Worker replaces its current deployed
Worker version. Verify that it is the correct project and that it currently
only serves the Cíyán static PWA before connecting the automated deploy.

### Choosing one or both

Either platform can be connected to the same GitHub `main` branch. Connecting
both triggers two independent builds/deployments on each push; connecting
only one deploys only that target. Adding `wrangler.jsonc` does **not**
automatically enable either Cloudflare Git integration; connect the project
once in its dashboard. `dist/` is Git-ignored and rebuilt for every deploy.
The existing `python3 package.py` workflow remains supported.

**Preserve learning progress:** Cloudflare Pages (`*.pages.dev`) and Workers
(`*.workers.dev`) have different browser storage origins. Existing IndexedDB
progress will not transfer just because the code is identical. If the current
Worker address is in use, continuing to deploy to that Worker preserves its
origin. Export a full Cíyán backup before changing domains or installations.

To regenerate the default collection from its compact, reviewed sources:

```bash
python3 build_expanded_dictionary.py
```

The original 2,278 cards are preserved in `content/v055_base_master.json`, the
9,482 new vocabulary entries in `content/v055_new_words.json`, and the 3,088
symmetric pairs in `content/v055_synonym_pairs.json`. The runtime master carries
only concise target IDs and numeric similarity; it does not carry evidence or
reasoning prose. The large imported HSK vocabulary does **not** need grammar
examples. Existing 1,549 examples were preserved.

## Learning records and backups

The app reads and saves progress locally in IndexedDB. Full backups include
content, settings and review history, and should be exported regularly to
Files/iCloud Drive. Updating the app never intentionally wipes reviews.
Session-only filters are excluded from backups. The new version does not alter
scheduling behavior or reset scores.

For an existing Cloudflare installation, export a full backup first. Upload
the new deployment to the **same project**, open it online, close any previous
Safari or Home Screen app windows, and reopen to activate v0.7.7. Browser
storage can be evicted by iOS, so keep your independent JSON backups.

Automated tests do not replace physical iPhone/Safari testing.

## Historical font versions

Previous v0.6.5–v0.6.7 font selections used one difficulty/choice and
codepoint-based Mixed styles. The v0.6.8 checkbox set supersedes them and
is migrated automatically during startup and backup restoration. The working
v0.6.7.dev2 downloader is preserved and now provides all six custom web-fonts.

The old `FONT_INSTALLATION_v0.6.7.md` and release notes remain as historical
references, not instructions for the current font selector.

See `RELEASE_v0.6.9.md` for font-size controls and `RELEASE_v0.6.8.md` for the original checklist/mixing policy.


## My Apps launcher (v0.8.14)

The site's root now shows **My Apps**, containing Cíyán. Click Cíyán to open the same Study screen that previously opened at launch. In Cíyán Settings, select **Save & Exit to My Apps** to commit pending reader preferences/bookmarks, verify the local state and return to the launcher. The current study session is preserved. The underlying IndexedDB, Cache Storage, PWA manifest ID, and URL origin have not changed. Visit `/?app=ciyan` to launch Cíyán directly; future apps can be registered in `launcher.js` with separate storage namespaces.
