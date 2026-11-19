# Cíyán v0.7.8 — Reader and settings improvements

This release retains the existing PWA deployment targets (Cloudflare Pages and
Workers) and does not change the authored chapter format.

## Settings

- Divide all settings other than About into independently expandable groups,
  initially collapsed.
- Apply the TSK1–TSK9 default new-word weights 2560, 1280, 640, 320, 160,
  80, 40, 20, 10. Existing nondefault/personalized weights are preserved.
- Add persisted Reader preferences for guide and Mandarin narration.

## Reader

- Present one chapter as a clean, immersive scrolling surface with a compact
  top navigation bar, table of contents, and optional bottom guide/audio dock.
- Single-tap prose to reveal/hide chrome. Double-tap an annotated word to open
  its dictionary. The dictionary can start the guide or narration at that word
  and edit existing main-vocabulary entries.
- Previous/next and TOC navigate without marking completion; the explicit
  end-of-chapter button marks completion and advances to the next chapter.
- Use Novel, Chapter and Upload as the main library controls; remove the
  persistent chapter catalog at the bottom of the page.
- Combine the bundled remotely hosted master chapter catalog with a persistent
  custom novel/chapter index. Full backups retain index metadata, reader
  progress and bookmarks, **not chapter prose**. Hosted chapters can be
  re-downloaded and cached; missing custom chapters produce a targeted upload
  prompt and reject mismatched JSON uploads.
- Maintain existing typography scaling; the supplied font screenshots do not
  justify adjusting individual font defaults.

## Packaging and verification

- The shared static-site packager and service-worker precache include
  `reader-library.js`. The offline shell cache is versioned `ciyan-shell-v7.8`.
- `npm test` and `npm run build` validate the release. The resulting
  `dist/ciyan` works with the previously configured Pages or Workers Git
  integrations.
