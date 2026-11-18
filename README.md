# Cíyán (词言) v0.6.8

Offline-first Mandarin flashcards, grammar, Particle Zoo, drawing practice,
advanced SRS scheduling, and user-controlled Chinese typography.

## Latest release

See [v0.6.8 release notes](RELEASE_v0.6.8.md). The final planned pre-reader
release replaces the two typography dropdowns with a **seven-font checklist**.
Check fonts across any difficulty; no boxes checked means iPhone Beginner.
Selected fonts do **not** change until Apply. Each *occurrence* of each Chinese
character independently receives a random checked font. Fonts are downloaded
and cached on demand (and can be uploaded if a source fails); font binaries
are not included in the repository or progress backup.

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

## Development and Cloudflare Pages

```bash
npm test
python3 package.py
```

The packager writes the Cloudflare-ready `dist/ciyan/` folder, with `index.html`
at its root. The distribution ZIP contains only those static files. The Git
ZIP includes all source code, content sources, tests, release history and tags.
No runtime network service, npm dependencies or account is required.

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
Safari or Home Screen app windows, and reopen to activate v0.6.5. Browser
storage can be evicted by iOS, so keep your independent JSON backups.

Automated tests do not replace physical iPhone/Safari testing.

## Historical font versions

Previous v0.6.5–v0.6.7 font selections used one difficulty/choice and
codepoint-based Mixed styles. The v0.6.8 checkbox set supersedes them and
is migrated automatically during startup and backup restoration. The working
v0.6.7.dev2 downloader is preserved and now provides all six custom web-fonts.

The old `FONT_INSTALLATION_v0.6.7.md` and release notes remain as historical
references, not instructions for the current font selector.

See `RELEASE_v0.6.8.md` for the complete selection and backup policy.
