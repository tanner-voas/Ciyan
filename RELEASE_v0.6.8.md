# Cíyán v0.6.8 — Font Checklist and Per-Occurrence Mixing

Final planned release before the v0.7.0 graded reader.

## Chinese typography

- The difficulty and font dropdowns, and all old **Mixed** choices, are replaced by **seven independent checkboxes**. The options are Beginner (iPhone default), xiaowei, HappyZcool-2016, YRDZST, Ma Shan Zheng, Muyao-Softbrush, and Zhi Mang Xing. They remain visually grouped by their former difficulty for convenience, but selections can cross groups freely.
- **No selection means Beginner.** Beginner can also be checked alongside any number of custom fonts, and participates in random mixing.
- Checkboxes modify **only a draft**. The displayed font and saved settings change only when the user presses **Apply font**. **Discard changes** restores the last accepted selection.
- On Apply, the app verifies **every checked custom font**. It downloads and caches any missing web-font file from the existing working v0.6.7.dev2 sources. If a file cannot be downloaded or decoded, none of the draft selection is saved: the dialog offers **Keep previous fonts** or **Upload font file**.
- If a single font is selected, it applies normally via CSS with **zero extra character spans**. With multiple fonts, each Chinese character **occurrence** independently draws one font from the selected pool. Repeated characters can receive different fonts; the pool is not restricted to one difficulty level. Adjacent runs of the same face are merged into one span to reduce DOM size. No non-Chinese text nodes are needlessly rewritten; form inputs, SVGs, canvases, and editable text are excluded.
- Mixing uses a new random selection when the content is rendered, rather than assigning a permanent font to each Unicode character.
- The 400+ KB historical Unicode-range CSS and its generator have been removed. The download cache persists in a separate IndexedDB database and is available offline after a successful Apply.

## Backups and compatibility

- The new setting is `settings.enabledFonts`, an array of selected IDs. Empty means the default Beginner rendering.
- Older backups containing `fontDifficulty` / `fontChoice` are migrated: a single old font becomes one checked font, the old within-level Mixed choice becomes both fonts from that level, and Beginner becomes its checkbox.
- The font file **bytes are not included** in learning backups. If browser font storage is cleared, Cíyán can download again on the next Apply or offer file upload. This retains the compact full-backup format.
- No changes were made to the bundled 11,893 vocabulary entries, 3,444 grammar entries, study algorithms, schedules, history schema, or main dictionary identifiers.
- Prior v0.6.6–v0.6.7 content-preservation and backup-reliability fixes remain in place.

## Packaging

Use `python3 package.py` to create `dist/ciyan` for Cloudflare Pages. `npm test` runs the regression suite. The repository is committed and tagged `v0.6.8`.

**Font binaries are not redistributed** in the repository or static deployment. The PWA uses the working on-demand download/cache approach demonstrated on the user's iPhone in v0.6.7.dev2, with a manual file-upload fallback.

## Release cautions

Automated browser-independent tests verify settings, migration, DOM text preservation and independent per-occurrence selection, download caching, and backup parsing. This environment has not completed a physical iPhone Safari end-to-end validation of the new multi-font rendering. Export a full progress backup before deploying.
