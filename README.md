# Cíyán (词言) — Mandarin SRS PWA, v0.3.1

A dependency-free, offline-first Mandarin flashcard PWA for iPhone. Two independent card types: **vocabulary words** and **grammar sentence puzzles**. Review records, FSRS scheduling, settings, vocabulary and grammar all live in the device's IndexedDB database. You export an independent JSON backup to the iPhone **Files** app after every study session.

**Privacy and data safety:** There are no accounts, server APIs, analytics or background uploads. IndexedDB usually survives phone restarts but may be cleared by iOS. **Only the separate JSON file that you save in Files (or iCloud Drive) protects your learning data against that loss.** The app cannot automatically save to Files or verify a download was actually saved.

## Build a Cloudflare Pages upload

From this Git repository, run:

```sh
python3 package.py
```

This regenerates **`dist/ciyan/`**, including `index.html` at its root. The entire `dist/` directory is Git-ignored. You can upload the folder to **Cloudflare Pages → Direct Upload**, or zip the contents of `dist/ciyan/` (not the `ciyan` parent directory) and upload that ZIP. No Node modules, bundler or Python packages are required for production.

**Upgrading to the v0.3.1 deck refresh:** Export a full backup before deployment. Upload the new distribution to the same Cloudflare project/URL. Open online once so the new service worker can install, then close every open Cíyán window (including Safari tabs and the Home Screen app) and reopen. The app may still label its unchanged study interface v0.3 in Settings; the Git/deck release version is v0.3.1. The new worker waits for old windows to close so a release does not swap scripts mid-session. Existing v0.1 migration remains supported; v0.2 data uses the same schema and database name. Optional decks are never added automatically.

## Deck-only update in v0.3.1

The existing app logic is unchanged. The optional library now contains **2,002 distinct words and 1,287 grammar examples**, including exact-token usage coverage for every vocabulary entry and the original starter words. Geography now includes visited places from the supplied list, all 50 US states, 27 EU member country-capital pairs, 34 Chinese province-level names and the requested world capitals; additional decks cover contemporary non-rude slang and familiar friend-chat expressions. New data is opt-in through **Explore optional decks**. The service-worker cache version is bumped to refresh offline JSON assets. See `decks/README.md` and `AUDIT_v0.3.1.md`.

## New in v0.3

There are **1,580 unique optional vocabulary entries**, **24 grammar cards**, and **17 individual decks** plus an all-in-one import. Topics include Chinese meals, ingredients, ordering, global food, activities/sports, muscles/body/recovery, climbing, provinces/regions, cities, countries and everyday life. Four selected HSK decks contain 180 / 180 / 160 / 140 entries respectively, verified against the **2021 HSK 3.0 grading standard**, not the later exam syllabus.

Use **Home → Explore optional decks** or the same button in Settings. You can load any topic directly, download its JSON, or use the separate decks ZIP. Imports preserve existing words and progress. On Words, set tag filters and use **Study matching words** for focused new/due reviews. Large word collections initially show 80 rows, with a Show More button.

Audit fixes: identical grammar tiles now grade by visible text; grammar links match complete tokens; imported distractors are HTML-escaped; explicit pinyin syllable boundaries and numeric tones are honored; invalid numeric memory states are rejected on restore; stale tabs cannot overwrite newer revisions; offline caches are scoped to this app. See `AUDIT_v0.3.md` for evidence and limitations, and `decks/README.md` for deck counts, conventions and attribution.

Deck source content and licenses are checked in under `content/`. To edit/rebuild deck content, run `python3 build_decks.py`, then `python3 package.py`. Normal deployment needs only `package.py`; generated decks are already checked in.

## Install on iPhone

1. Deploy `dist/ciyan` using Cloudflare Pages (https://developers.cloudflare.com/pages/get-started/direct-upload/).
2. Open the provided HTTPS `pages.dev` URL in Safari.
3. Tap **Share → Add to Home Screen → Open as Web App → Add**.
4. Launch Cíyán from its Home Screen icon. After online installation and caching, it works offline.

## Core features (introduced in v0.2)

- **Words** contain only Hanzi, pinyin, English, tags and metadata. Grammar sentences live separately.
- **Grammar** cards contain Chinese token markup, pinyin, English, and optional indexed distractors. Linked word tags are calculated automatically from words that occur in the sentence. Tapping a word shows all matching grammar sentences sorted by combined score.
- **Knowledge** (0–100%) derives from each word's latest rating, review count and FSRS recall estimate; new words score zero. On grammar cards, the knowledge score is the average across answer and distractor words. The grammar mode unlocks when **each** required word reaches at least 75% knowledge. A confidently answered first review (Good or Easy) normally qualifies while Hard / Again do not.
- **Usage risk** is explicitly **0%** in v0.2, with multiplier `(1 - usageRisk)`; grammar errors are recorded with their incorrect word positions for future learning. Combined score = knowledge × (1 - usage risk). Grammar lists sort by combined score.
- Words and Grammar both have **tri-state, multi-tag filters**: tap once to include (green), twice to exclude (red), three times to clear. Active tags move to a separate row. **Reset tags** clears all chosen tags. Word rating filtering compares `>`, `>=`, `=`, `<=`, `<` against the **latest review grade** (`Unseen=0`, `Again=1`, `Hard=2`, `Good=3`, `Easy=4`). Grammar has separate Knowledge and Usage Risk percentage comparisons.
- **Vocabulary study:** optional Tone Test: four vertically stacked checkboxes below each Hanzi character. No checked box = neutral tone (0). Written pinyin is used for validation. Optional Enforce Tones disables **Easy** on a tone mismatch; **Good** or lower remain available. The test does not expose pinyin on the front, even if "show pinyin" is also enabled.
- **Grammar lab:** English → Chinese sentence assembly. Tap shuffled tiles in order, or drag/drop (including a touch-drag fallback). Tap a placed tile to remove it. Distractors are mixed into the bank. Submit to check ordering and selections, view the correct sentence and save an attempt with mistaken positions. Only unlocked grammar is offered. Every submission is saved locally.
- New words per day: **unlimited**. Session size (1–500) controls batch length, and you can start as many new sessions as you want.
- **Editing** offers explicit Cancel / Save; duplicate Hanzi and duplicate grammar markup are rejected. Deleting shows a confirmation, and changing a previously studied word/sentence also prompts a warning. Settings has **Clear learning records** with a mandatory typed `delete` confirmation; all words, grammar, and settings are kept.
- **Import** is additive by exact Chinese word or exact grammar markup: never overwrite existing cards, schedules or learning history. Existing word tags may be merged. **Full backup** exports everything, including all current word and grammar content and records. A **deck** is the same two card collections without review records; exportable from Settings. Imported full backups used as decks are also treated as content-only. A separate **Restore full backup** replaces the complete database, with confirmation.

## Grammar deck format

Each grammar sentence uses `{...}` for a movable word tile and punctuation outside braces that stays fixed. The sample below has five word tokens, numbered **1, 2, 3, 4, 5**. `4: [多]` offers 多 as a distractor at the position occupied by 都 (the fourth word).

```json
{
  "format": "ciyan-deck", "version": 2, "records": false,
  "cards": [
    {"id":"word-suibian","hanzi":"随便","pinyin":"suíbiàn",
     "english":"Whatever; any is fine","tags":["social","food"]}
  ],
  "grammar": [
    {"id":"example-eat","markup":"{吃}{什么}？{我}{都}{随便}。",
     "pinyin":"Chī shénme? Wǒ dōu suíbiàn.",
     "english":"What should we eat? Anything is fine with me.",
     "distractors":[{"index":4,"word":"多"}]}
  ]
}
```

Import can also read arrays of legacy word cards, `{cards:[...]}`, `{grammar:[...]}`, v0.1 backups as a **deck**, and v0.2 backups as either decks (merge without history) or full restores (replace everything). For grammar mode to unlock, create vocabulary cards for all `{...}` words **and** any distractors.

## The four FSRS review ratings

These are **not** mastery stages. **Again**: you did not recall the word (1-minute relearning). **Hard**: you recalled it with difficulty (often a 10-minute short step for a new card). **Good**: you remembered normally (ordinary FSRS interval). **Easy**: effortless recall (longer FSRS interval). Last Rating filters are numeric comparisons against the last action, not a continuous grade; the separate Knowledge percentage is a rough learning-confidence estimate. The underlying vocabulary scheduler remains the self-contained FSRS-4.5 model from v0.1.

## Data export, restore, and maintenance

Every vocabulary rating and grammar answer is stored in IndexedDB before moving on. The Session Complete page prominently reminds you to export. Use **Save to Files (share sheet)** where available; otherwise download JSON, find it in Files and move it to a location you trust. Only confirm "I saved this file in Files" **after** actually checking. Importing a deck does not overwrite existing study progress. Restoring a full backup **does**, and asks before proceeding. After Clear Learning Records, export a new backup to preserve the reset state.

The repository includes test files under `tests/`. Run `npm test` using Node 20+ (no `npm install` necessary). To host a local preview, `python3 -m http.server 8765` and open `http://localhost:8765/`.

**Limitations:** The app has no hosted sync, no push reminders, no spoken-answer detection, no grammar-error-derived usage scoring yet, and no iOS-native filesystem permission. The tone test uses pinyin syllables and the written tones rather than all possible tone sandhi changes. Touchdrag may behave differently in Safari; tapping the word tiles is supported independently. The app has not been tested on a physical iPhone in this development environment.
