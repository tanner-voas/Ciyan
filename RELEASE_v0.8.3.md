# Cíyán v0.8.3 — Automatic reader study and chapter-critical focus

Reader study is now **automatic only**. All annotated words remain available
for dictionary lookup and automatic vocabulary preparation. HSK1–4 words without
recorded weakness are treated as baseline knowledge. Every word above HSK4 or
without a mapped HSK level enters the preparation pool until mastered, as do
all fictional terms and chapter-critical grammar.

Chapter JSONs now contain a `focus` list consisting only of terms and grammar,
with **sixfold weighting** in the chapter study queue. Due cards receive an
additional twofold urgency factor. Learners can still select queue filters
(Chapter preparation, Still to practice, Earlier items due, All chapter items),
but there is no authored-vs-auto vocabulary mode or Reader gate setting.

All 11 盘龙 chapters and the three TSK samples have updated packages. Every
original paragraph and sentence is preserved. Existing fantasy terms are all
included in focus. Additional setting-specific terms such as 魔兽, 魔法师, 静态张力,
佣兵, and 魔法咒语 have been classified as terms consistently across chapters.
Panlong Chapters 4–11 now contain 3–4 targeted grammar patterns each. Each
sample has 2–3 grammar patterns. Grammar focus metadata is defined in
`reader/focus-grammar.json`, and `node tools/refresh-reader-focus.mjs` is
idempotent. The old selected-word specifications are no longer used.

Existing saved bookmarks, completed chapters, and review records remain valid.
The loader migrates prior `authored` arrays to term-and-grammar-only `focus`.
Hosted catalog entries retain prior hashes (including older Panlong revisions)
so existing installations can fetch updated chapter JSONs.

Run `node tools/verify-reader.mjs`, `npm test`, `python3 tools/package-chapters.py`
and `npm run build` to verify the complete release.
