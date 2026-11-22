# Cíyán v0.9.4 — 《盘龙》 HSK6+TSK12 editorial corrections

This update applies the source-aligned recommendations from the HSK5+TSK10 final quality review **to the existing HSK6+TSK12 reader only**. It does not install the separate HSK5 adaptation or reduce the HSK6 edition to its vocabulary ceiling.

## Content

- 71 reviewed corrections in 70 paragraphs across 21 of the 23 chapters. The other 1,578 graded paragraphs remain textually identical to v0.9.3.
- Restores ownership of 乌山镇 by the 巴鲁克家族, the quality of the visitor's 清朗 voice, the 麻布线 taken from the garment, and the narrator's excited reaction to the fight.
- Smooths the 路加 death passage without omitting the attack or dying cry, removes an unsupported agent from the warehouse-rubble scene, and clarifies that magic aptitude depends on 元素亲和力 and 精神力.
- Removes redundant or unnatural wording in training, combat, and dialogue, including 又重新 and 又再次, while preserving higher-level vocabulary when appropriate.
- Corrects the context definition of **说道** to “to say; said (especially when introducing or following dialogue)” in the graded glossary.

The source narrative is kept intact: original chapter JSON and ZIPs are byte-for-byte unchanged. The existing v0.9.3 Pass 46 assets are retained as historical snapshots. New `graded-v094/` assets use fresh filenames so an installed PWA cannot silently reuse the old JS files. Existing chapter digests, positions, term progress, study progress, focus IDs, 198 protected terms, and 40 grammar examples are preserved.

The distinct ordinary out-of-HSK6/TSK12 inventory in the revised tokenization is 632 words (598 in historical Pass 46); this includes more precise vocabulary and some changed token boundaries. No HSK5-only vocabulary ceiling is imposed. The HSK5+TSK10 edition remains a separately finalized manuscript, not part of this app patch.

## Rebuild and verification

From the Ciyan repo root:

```sh
python3 tools/build-panlong-v094.py
python3 tools/package-chapters.py
npm test
npm run build
```

All 287 automated tests pass in this release, including the v0.9.4 checks for exactly 71 reviewed edits, 70 changed paragraphs, unchanged original digests, identical protected-term occurrences, and correct annotated glossary entries. Both standalone Ciyan and AppLauncher module builds complete successfully.

No AppLauncher repository change is needed. Backup migration from v0.9.3 to v0.9.4 is identity-only: user data is preserved.
