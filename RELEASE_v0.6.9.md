# Cíyán v0.6.9 — Independent Chinese Font Sizes

This release builds directly on the working v0.6.8 seven-checkbox font selection and preserves the successful automatic web-font downloader and offline font cache. All changes are limited to Chinese typography and settings persistence.

## Typography controls

- **Master Chinese text size** is a slider, default **1.00×**, range **0.70–1.60×** in 0.01 increments. It multiplies the sizes of all enabled fonts.
- **Relative size per font** is a second slider beside each of the seven font entries, range **0.65–1.60×** in 0.01 increments. These values remain editable even when that font isn't currently checked, so you can pre-calibrate a future selection.
- Initial per-font sizes are conservative estimates chosen to compensate for different visible glyph dimensions: **iPhone default 1.00×, xiaowei 1.05×, HappyZcool-2016 0.98×, YRDZST 1.04×, Ma Shan Zheng 1.08×, Muyao-Softbrush 1.03×, Zhi Mang Xing 1.10×**. Adjust to your own iPhone rendering preferences; these are not laboratory measurements.
- **Effective size of a Chinese character = existing local text size × master multiplier × its randomly selected font's relative multiplier.** Three identical characters can still use three independently chosen font faces and their corresponding sizes.
- Only Chinese learning content is scaled: flashcard characters, the word/grammar collection, study contexts, drawing answers, sentence-building tiles, Particle Zoo learning text and the preview. Pinyin, English translations, navigation, ordinary buttons, settings labels, grades and statistics controls retain their existing sizes. The custom *font families* otherwise behave just as in v0.6.8.
- **Apply font** is still required for changes to the checkbox list *or either size slider*. Sliders edit the local draft only. **Discard changes** reverts all pending font choices and sizes. If a selected font fails download/validation, nothing is applied or saved and the previous selection and sizes remain active.
- Single-font Beginner with an effective size of exactly 1.00× keeps the zero-span CSS fast path. When scaling a single font, contiguous Chinese runs are wrapped once per run rather than creating separate spans per character. When mixing, adjacent occurrences randomly assigned to the same font are grouped as in v0.6.8.

## Backup compatibility

Settings now include `enabledFonts`, `fontMasterScale` and `fontScales`. All seven relative sizes are saved regardless of which fonts are enabled. Existing v0.6.8 backups migrate to **1.00× master** plus the new tuned defaults; earlier difficulty/choice backups migrate via the existing selection mechanism. Values are checked for finiteness and clamped to safe slider ranges.

No font binaries are included in full progress backups. The separate IndexedDB font cache and existing automatic download and optional upload flow remain unchanged. No vocabulary, grammar, SRS scheduling, learning data, or history changes were introduced. The default content remains **11,893 vocabulary entries and 3,444 grammar examples**.

## Build and testing

`npm test` runs the Node regression suite, including staged settings behavior, font scaling, backup migration, and content preservation. `python3 package.py` creates the deployable `dist/ciyan` folder; upload its contents or the deployment ZIP to Cloudflare Pages. Git tag: `v0.6.9`.

Physical iPhone Safari appearance is not verified by automated tests. Back up your current learning progress before deployment. If a Chinese face appears too large or small, tune its relative slider while leaving the master at 1.00×; use the master only when the entire learning display should change size.
