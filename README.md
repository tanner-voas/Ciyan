# Cíyán (词言) v0.7.7

Open the Reader tab and choose a hosted chapter from the catalog, or import your own JSON. The app fetches chapter ZIPs relative to its own installation, verifies their contents, and keeps opened chapters available offline. Each hosted chapter retains the same identity as the original JSON.

Tap a word for its dictionary entry. With the guide on, **Read from here** moves the guide to that occurrence. Enabling **Read aloud in Mandarin** starts narration from the current word. System Mandarin lets the browser resolve the language even if its voice list is empty. Other listed voices can be selected explicitly. Voices marked “network” may send speech text to the voice provider. CPM is approximate during narration.

Offline-first Mandarin flashcards, grammar, Particle Zoo, drawing practice,
advanced SRS scheduling, and user-controlled Chinese typography.

## Reader narration in v0.7.6

Use the sliders menu to enable the guide. Transport controls stay in the bottom bar while the menu is closed. Enable **Read aloud in Mandarin** to show the voice selector. Equivalent system voices are grouped. When the browser identifies them, region and installed voice quality distinguish variants.

The two additional male Mandarin voices, Yunxi and Yunyang, use Azure Speech. Select a voice in the bottom bar, enter your Azure Speech resource region (such as `eastasia`) and resource key in the menu, then close the menu and tap Play. Use a free-tier F0 resource for the free allowance. The app sends the current sentence directly to Microsoft's regional synthesis endpoint. Credentials stay in the open reader and are omitted from exports. Native audio continues to work without Azure.

## Latest release

Open **Reader → Load chapter file** and select the first `.json` package. The three 《盘龙》 packages are in `reader/panlong/chapters/`. Import new chapters in order. You can reload an earlier chapter at any time.

**Settings → Reader** selects the reading gate. Authored uses the writer’s selection of vocabulary, terms and grammar. Auto checks all distinct annotated words and terms. Each required item qualifies with a saved score of 1.5, three Good grades or one Easy during this app run. Study prioritizes due reviews, new items and then early practice. Early practice leaves the saved schedule and history untouched. Study lists also offer earlier due items and full-chapter preparation. Vocabulary reviews use the main vocabulary schedule. Terms and grammar belong to the novel. Opening an eligible chapter unlocks it permanently. Reading progress and flashcards travel in the full backup. Reading text stays in the chapter package and device cache.

The optional Reading guide starts paused at 120 characters per minute. Step through words or play continuously. Tap a word for its definition and choose Read from here to move the active guide. With the guide active, the bookmark follows the highlighted word. Manual scrolling saves the first visible paragraph.

In Settings, **Clear learning records** resets review data and reading progress, **Clear settings** restores default preferences, and **Clear dictionary** keeps vocabulary and grammar entries with learning evidence. **Reload cards** restores the bundled master. The backup carries the records of studied custom items removed by Reload cards.

### Chapter authoring and verification

The package is UTF-8 JSON. Each paragraph is a stable ID and a token sequence. Literal strings supply punctuation and spacing. A one-element array identifies a dictionary entry whose Chinese headword supplies the visible text. An optional second array element preserves an alias such as a full name while sharing the same item and score. The authored list can include grammar prompts. Auto derives its list from every nonliteral span. Novel IDs and item IDs should be reused across chapters. Increment the revision when changing a released file.

The exact uploads are in `reader/panlong/original/`. Clean references remove paragraph-end website counters, trim surrounding indentation and use one blank line between paragraphs. Dates and numbers within the narrative are preserved. SHA-256 digests in `locked.json` pin those references. Run from the repository root:

```sh
node tools/verify-reader.mjs
node tools/build-reader.mjs
node tools/verify-reader.mjs
npm test
python3 package.py
```

The builder uses the bundled vocabulary, authored study lists, supplemental glossaries and Node’s Mandarin word segmenter. The committed packages can be imported directly. Use Node 24 to rebuild. The verifier checks both the raw-to-clean transformation and reconstruction through the reader’s own token model.

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
