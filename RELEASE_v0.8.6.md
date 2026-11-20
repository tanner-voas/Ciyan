# Cíyán v0.8.6

**Second deep-dive audit release based on v0.8.5.**

- Remove remaining document-global Safari gesture and multi-touch event cancellation so pinch zoom is no longer explicitly blocked; canvas-specific gesture handling remains intact.
- Collapse the large Words/Grammar topic and review-filter panels by default; add an active-filter summary. Search, all filters, topic expansion, and paging are retained.
- Remove a redundant font application pass during collection-list refresh.
- Increment app/cache versions and add an identity-preserving 0.8.5 -> 0.8.6 backup migration.
- Add regression tests and perform automated Chromium interaction tests with a simulated iPhone 13 Pro Max viewport (428 x 926 CSS pixels at 3x).

The full evidence and remaining device-specific risks are in `AUDIT_v0.8.6.md`.

Tests: `npm test` (239 passing). Build: `python3 package.py`. The deployed site is not changed by this release ZIP.
