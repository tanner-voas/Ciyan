# Cíyán v0.6.5 — Drawing, mobile UX, and Chinese font levels

## What changed

1. **Study session filters moved to the bottom of the Study screen.** The session pool, Auto Study, and mode controls now appear first. Filter behavior and session-only persistence are unchanged.
2. **Drawing uses one grading row per character.** The revealed sketch-versus-character comparison no longer contains its own four-button feedback controls, the optional writing-diagnostic panel, or a separate whole-word grade. Instead, a compact bottom panel places the character in the left column and Again / Hard / Good / Easy in four colored columns. A selection highlights itself and dims the other options in its row. Users can change a selection while other characters remain unrated. Once all characters are rated, the app **atomically** records every character's grade and uses the **minimum** grade to schedule the whole word. One-character words advance after a single press. No sketches enter the permanent grade history, and Undo restores the scheduling/history snapshot.
3. **Particle Zoo statistics** use a stacked label and attempts/error count, avoiding extremely narrow columns on iPhone. Other stats panels are unchanged.
4. **Your files** actions use a fixed-width icon gutter and left-aligned text so longer buttons wrap under their labels rather than under their icons.
5. **Case-insensitive confirmation:** `delete`, `Delete`, `DELETE`, or `dElete` (and variants with surrounding whitespace) all authorize clearing records. The full confirmation dialog and irreversible-data warning remain.
6. **Four Chinese font difficulty levels** under Settings: Beginner (one clean font), Intermediate (Songti, Kaiti, Mixed), Advanced (HanziPen, Xingkai, Mixed), and Expert (Wawati, Weibei, Mixed). A font is chosen *within* the level; switching levels resets to that level's first font. The setting applies to Chinese glyphs throughout the app, including modals, flashcards, drawing, grammar, vocabulary lists, and Particle Zoo. Latin UI text retains the normal system font.
   - Mixed chooses between the two styles for each individual Chinese character. Selections are pseudo-random but **stable for a given text and character position**, preventing reshuffling after every rerender or grade.
   - Styles are resolved from **locally installed iPhone system fonts**, not fetched from Google Fonts or a web font server. The app remains offline-friendly and does not bundle proprietary font files. If a style isn't available on the device, Chinese glyphs use a clean fallback; the actual handwriting appearance may vary between iOS versions/devices.
   - All fonts inherit the app's original size and line metrics; the preview lets users compare the same sentence.

## Data integrity

- **No master dictionary changes:** 11,893 words and 3,444 bundled grammar entries remain identical to v0.6.4, including all synonyms, tags, and contexts.
- **No scheduling curve changes** outside the requested minimum-of-character-grades rule for drawing.
- Full backup JSON includes `fontDifficulty` and `fontChoice`; older versions migrate to Beginner / Clean print. No new backup schema is required.
- The original v0.6.3 mock backup was successfully parsed and re-exported: 11,893 words, 3,469 grammar entries, 23,527 vocabulary reviews, 792 grammar reviews, 656 skill reviews. Sampled vocabulary score was preserved exactly. The newer bundled master is not allowed to delete those historical grammar records when restoring.
- Content and progress retain the v0.6.4 split/chunked IndexedDB storage and existing explicit export-to-iPhone-Files workflow.

## Tests and limitations

- **160 automated Node tests pass**, including new end-to-end handler tests for one-character and two-character drawings, the minimum-grade result, persistent font settings, older backups, session filter placement, and particle-stat presentation.
- Static 320-pixel and 430-pixel Chromium layout checks found no horizontal overflow in the redesigned drawing grades, particle rows, and file actions.
- Physical iPhone Safari testing and live Chromium navigation were unavailable in this environment. System-font availability, native touch interactions, and performance on an actual device still need checking.
- Export a full backup *before* uploading this release to the same Cloudflare Pages site. On iPhone, close old Safari/Home Screen app windows and reopen online once to fetch the updated service worker. Keep a separate backup in Files.

## Build

```
npm test
python3 package.py
```

Upload the contents of `dist/ciyan` to Cloudflare Pages. The tagged Git ZIP includes source, tests, history, and the packaging script. The deployment ZIP contains only the PWA runtime.
