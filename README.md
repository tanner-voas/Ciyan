# Cíyán (词言) — Mandarin SRS PWA, v0.2

A dependency-free, offline-first Mandarin flashcard PWA for iPhone. Two independent card types: **vocabulary words** and **grammar sentence puzzles**. Review records, FSRS scheduling, settings, vocabulary and grammar all live in the device's IndexedDB database. You export an independent JSON backup to the iPhone **Files** app after every study session.

**Privacy and data safety:** There are no accounts, server APIs, analytics or background uploads. IndexedDB usually survives phone restarts but may be cleared by iOS. **Only the separate JSON file that you save in Files (or iCloud Drive) protects your learning data against that loss.** The app cannot automatically save to Files or verify a download was actually saved.

## Build a Cloudflare Pages upload

From this Git repository, run:

```sh
python3 package.py
```

This regenerates **`dist/ciyan/`**, including `index.html` at its root. The entire `dist/` directory is Git-ignored. You can upload the folder to **Cloudflare Pages → Direct Upload**, or zip the contents of `dist/ciyan/` (not the `ciyan` parent directory) and upload that ZIP. No Node modules, bundler or Python packages are required for production.

**Existing v0.1 users:** export a full progress backup from v0.1 **before** deploying v0.2. Deploy v0.2 to the **same Cloudflare Pages origin/URL** so its local IndexedDB is accessible. It migrates existing words, schedules, review history and settings, converts every existing word example into an independent grammar sentence, and adds the new starter grammar vocabulary without overwriting any existing words. Reopen the site online and refresh once if the old service-worker-cached version is initially still visible. Check that v0.2 appears in Settings before studying. Avoid changing deployment URL or clearing website data until after exporting a v0.2 backup.

## Install on iPhone

1. Deploy `dist/ciyan` using Cloudflare Pages (https://developers.cloudflare.com/pages/get-started/direct-upload/).
2. Open the provided HTTPS `pages.dev` URL in Safari.
3. Tap **Share → Add to Home Screen → Open as Web App → Add**.
4. Launch Cíyán from its Home Screen icon. After online installation and caching, it works offline.

## What's new in v0.2

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
