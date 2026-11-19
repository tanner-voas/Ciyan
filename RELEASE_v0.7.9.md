# Cíyán v0.7.9 — Reader library and Panlong Volume 1

A targeted reader/catalog release based on the v0.7.8 UI and the dual Cloudflare Pages / Workers deployment support.

## Library navigation

- Stack Novel, Volume (when present), and Chapter selectors vertically at full width, avoiding narrow-screen overlap.
- Show each novel as **author • novel**, alphabetized by author/title. The shipped 盘龙 author is 我吃西红柿 (sort key: Wo Chi Xihongshi).
- Organize the three existing sample stories as one visible collection each for TSK1, TSK2 and TSK3. Keep original underlying novel IDs and chapter digests so saved sample progress is not invalidated. Later samples may join a level as subsequent chapters.
- Show optional `V01 · 盘龙之戒` volume navigation for 盘龙, including volume labels in the reader table of contents.
- Volumes are purely navigational metadata. Chapter numbering, prerequisites, bookmarks, TTS and next/previous navigation remain global per novel. The first V02 chapter must immediately follow the final V01 chapter, without a new progress track.
- Backup custom author and volume metadata if provided by an uploaded chapter; old custom indexes and backups remain valid.

## Panlong additions

- Add Chapters 4–11 from the user-provided PDF-verified UTF-8 source archive, preserving the prose including original glyph variants and repeated sound-effect paragraphs. There is **no silent spelling or narrative correction**.
- New files `reader/panlong/new-raw/004.txt` through `011.txt` hold the user-provided text. `reader/panlong/reference/` stores extracted chapter title and prose in the reader’s exact text format.
- Generate new supported reader JSONs, using existing vocabulary plus curated fantasy terms and per-character pinyin fallbacks for otherwise missing dictionary entries. Every Chinese character is a tappable token; a few rare character-only definitions are transparently labeled as context-dependent.
- Create hosted, digest-checked ZIP files `chapters/panlong-4.zip` through `chapters/panlong-11.zip` and update the remote chapter index.
- Keep the original Chapters 1–3 JSON and SHA-256 digests unchanged to preserve existing saved chapter progress.
- All 11 Panlong chapters are indexed as Volume 1, 盘龙之戒.

## Deployment

- Keep existing `npm run build` and `npm run deploy:worker` interfaces unchanged. Both deployment systems serve the complete `chapters/` index and ZIPs when the repository is built and deployed.
- App and service worker cache versions: **0.7.9**. Existing backup version transitions are identity-only (no learning-data mutation).

Run `npm test`, `node tools/build-panlong-extended.mjs`, `python3 tools/package-chapters.py`, and `npm run build` to verify/recreate the chapter index. The generator uses the shipped files and has no network dependency.
