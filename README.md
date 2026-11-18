# Cíyán (词言) v0.6.5

Offline Mandarin vocabulary, grammar, drawing and Particle Zoo, optimized for
phone-based spaced repetition with local full-backup export.

## Latest release

[v0.6.5 release notes](RELEASE_v0.6.5.md): bottom-of-page Study filters,
one colored grade row per drawn character (minimum grade schedules the word),
mobile Particle Zoo and file-action alignment fixes, case-insensitive delete
confirmation, and an app-wide Chinese font selector with Beginner,
Intermediate, Advanced, and Expert difficulty plus mixed-character fonts.
Chinese styles use device-local fonts and do not require the network.

The **current bundled** master contains 11,893 vocabulary entries and
3,444 grammar examples. The bundled master is unchanged from v0.6.4.
Full backups can also preserve additional grammar entries from earlier imports.

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

## v0.6.7 font installation and content safety

See [`RELEASE_v0.6.7.md`](RELEASE_v0.6.7.md) and [font installation help](FONT_INSTALLATION_v0.6.7.md). Additional font choices refer
only to user-installed Chinese typefaces from the screenshots. They are checked
by the browser before selection; unavailable fonts explicitly fail and do not
replace your working preference. Mixed fonts use pre-generated Unicode CSS
ranges rather than thousands of extra character nodes. Bundled dictionary
upgrades preserve existing user content instead of replacing it at startup.

## v0.6.7 readiness

The font controls now stage choices until **Apply font**, using the installed iPhone names listed in `FONT_INSTALLATION_v0.6.7.md`. See `RELEASE_v0.6.7.md` for backup, scheduling, and performance changes. Full backup export now checks the restore format and uses compact JSON. No reader content is shipped.
