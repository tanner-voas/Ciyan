# Cíyán (词言) v0.6.1

Offline Mandarin practice for iPhone: vocabulary, grammar, drawing and Particle Zoo.

This release adds four-grade character assessment, gradual shared character scores,
character-aware drawing selection and weakest-link feedback. It retains the preview's
72 Particle Zoo exercises, omission and alternative answers, error classification,
family weakness targeting, measured grammar usage errors and familiar drawing contexts.

The master contains 11,893 vocabulary entries and 1,896 grammar examples.
3,335 words have a linked example; 8,558 still lack one. Full-vocabulary grammar
coverage remains unfinished. No rejected template candidates are in the study deck.

See [release notes](RELEASE_v0.6.1.md) for algorithm details and validation.
Rebuild content with `python3 build_v06.py`; older content builders are historical.

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
Safari or Home Screen app windows, and reopen to activate v0.5.5. Browser
storage can be evicted by iOS, so keep your independent JSON backups.

Automated tests do not replace physical iPhone/Safari testing.
