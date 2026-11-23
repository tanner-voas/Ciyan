# Ciyan v0.9.12 — Profile and portable-reader recovery

This release strengthens the existing v0.9.11 synchronization without changing
normal study data or the underlying backup format (`ciyan-backup`, version 2).

- The profile manager no longer silently initializes a new Default identity when
  stored profile metadata exists but is damaged. It displays a recovery screen
  with a raw-registry export and candidate IndexedDB profile identities.
- When cloud and local states differ after the synchronization cursor is lost,
  Ciyan offers local export, safe preservation of both copies, and continuation
  with a local-only recovery profile. No automatic cloud overwrite occurs.
- Imported chapter text can be included in a **portable JSON export**, with
  SHA-256 validation and bounded file sizes. Ordinary JSON exports continue to
  save app state, dictionary, records, and encrypted settings but not text cached
  separately in CacheStorage.
- The archive menu includes an explicit **Include imported reader text in Google
  Drive backups** opt-in. Each chapter is a distinct immutable cloud section.
  After enabling it, run Sync and confirm success before depending on another
  device to restore user-imported chapters. A missing local chapter stops that
  particular upload rather than claiming a complete backup.
- Turning the option off prevents new snapshots from including the chapter
  contents; old retained cloud revisions can still contain previously uploaded
  content until their retention and cleanup windows expire.
- Hosted downloadable chapters and separately installed custom fonts remain
  device assets and are not bundled as part of profile-state backups.

Normal local progress saving, reader cache, quiz scheduling, and cloud sync
intervals are unchanged.
