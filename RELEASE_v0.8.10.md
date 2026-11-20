# Cíyán v0.8.10 — 2025 HSK classifications and TSK01–TSK12

Data-focused update based on the complete expanded master dictionary, supplied separately as `Ciyan_Dictionary_HSK2025_TSK12_v0.8.10.json`.

- **Master:** 12,505 vocabulary cards, 3,444 grammar cards; vocabulary ID, definitions, pinyin, and grammar preserved.
- **HSK:** Canonical classification uses the November 2025 examination syllabus, HSK1–6 and the combined HSK7–9 band. All written HSK1–6 syllabus headwords present; obsolete classifications removed.
- **TSK:** 12 mutually exclusive tags `TSK/TSK01` … `TSK/TSK12`, exactly 200 words each. Every level includes 100 HSK and 100 non-HSK words. All 2,400 headwords are unique across the TSK progression.
- **Progression:** HSK4 + TSK01–08 provides at least 800 distinct extra non-HSK words; HSK5 + TSK01–10 gives 1,000; HSK6 + TSK01–12 gives 1,200. TSK also introduces useful HSK5–9 words ahead of their formal HSK level.
- **Ranking:** Editorially prioritized for modern daily life, natural conversation/slang, Chinese apps, commerce, transport, housing, healthcare, software engineering, and climbing. It is not claimed to be a measured frequency ranking.
- **Migration:** Existing local cards are retained by ID, customized meanings and nonclassification tags are retained, and HSK/TSK classifications are synchronized without altering scores or review dates. `TSK/TSK1`–`TSK/TSK9` preference weights migrate to their zero-padded equivalents. Existing non-TSK tag weights are unchanged.
- **Explicit dictionaries:** Existing explicitly imported collections are not automatically expanded or overwritten. Matching words' HSK/TSK tags are synchronized to the bundled canonical classification.
- **Backups:** v0.8.9 backups are supported and migrate to v0.8.10. Export a backup before upgrading.
- **Offline:** Bump the shell cache so new HSK lookup, master-data, and tag-weight code are refreshed together.

Historical sample-reader names referring to TSK1–3 are titles, not TSK selection tags, and remain unchanged to protect existing chapter identities.
