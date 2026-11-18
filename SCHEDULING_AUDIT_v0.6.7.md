# Cíyán v0.6.7 — Scheduling, Backup & Performance Audit

An audit on the provided **synthetic HSK4 mock backup**, not a longitudinal calibration of actual memory. No real personal data is bundled in this repository.

## Mock data round trip

| Metric | Value |
|---|---:|
| cards | 11,893 |
| grammar | 3,469 |
| history | 23,527 |
| grammarHistory | 792 |
| skillHistory | 656 |
| mixedSessions | 114 |

- All word and grammar IDs remained stable.
- Vocabulary, grammar, and skill histories were preserved.
- Verified export: **21,672,504 bytes** compared with **21,641,518 bytes** for the original mock.
- Export verification, decoding, and restoration all succeeded.

## Scheduling calibration

The rating *score* remains a gradual evidence model. Previous mature-word Again outcomes could land several days into the future because their scores remained high. The default scheduler now bounds Again by 10 minutes and Hard by 6 hours (or the user-configured intervals), while retaining score history. Good and Easy still use the geometric/extrapolated score curve. FSRS mode is unchanged.

| Prior score | Again next (min) | Hard next (min) | Good next (min) | Easy next (min) |
|---:|---:|---:|---:|---:|
| new | 10 | 19 | 36 | 69 |
| 0.5 | 10 | 86 | 176 | 360 |
| 1 | 10 | 360 | 592 | 973 |
| 2 | 10 | 360 | 4320 | 5879 |
| 3 | 10 | 360 | 14815 | 24192 |
| 3.5 | 10 | 360 | 24192 | 34272 |

Scenarios above used a seven-day elapsed interval for mature cards, and fresh schedules for `new`. Real user schedules vary. Outcomes are monotone in this test set. Historical events are not rewritten.

## Profiling (developer container, not iPhone)

| Operation | Observed |
|---|---:|
| Build inverted grammar context index (11,893 words, 3,444 examples) | 135 ms |
| Parse 21 MB mock backup | 366 ms |
| Verify and serialize backup | 529 ms |
| Restore verified backup | 190 ms |

Measured on a desktop/container runtime, these values should **not** be represented as iPhone Safari benchmarks. The cache avoids re-sorting all schedule IDs on each study render. Compact full-backup JSON reduces size without removing content.

## Remaining release gate

Actual iPhone testing is still required for Safari access to locally installed fonts and for realistic storage persistence, background/resume, and large on-device render latency. A successful font installation in a native application does not imply WebKit can load it. If the browser reports missing fonts, the previous applied font stays intact.
