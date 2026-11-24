# Cíyán v0.9.14 — Cloud synchronization efficiency

Uses the v0.1.8 shared library's persistent Drive index and session-scoped backup hash cache. Dictionary and grammar data already use copy-on-write storage, so normal learning progress can reuse their serialized chunks without hashing or uploading them again. Explicit edits, imports and replacements invalidate the relevant reference. Existing revisions and portable backups remain compatible; no new cloud layout is introduced.

The archive menu has a collapsed **Synchronization details** section displaying the last ten upload attempts, section and object reuse, payload bytes, elapsed time and reported foreground Drive API/cache counters. These diagnostics stay local to this device/profile and contain no learning content or credentials. Home/Refresh still skip network calls when fully synchronized. Keep the existing five-second debounce and sixty-second max delay.

Requires PWA-GoogleDrive v0.1.8. The matching shared library pointer is advanced by the existing dependency workflow rather than this patch.
