# Cíyán v0.9.6 — Unified mobile header

From the v0.9.5 main branch, the top bar is safe-area-aware and sticky except in immersive reading mode. It shows the name and app version, an export-status archive button, the Settings toggle, and the common far-right Home icon when launched inside AppLauncher. Standalone Cíyán instead shows a refresh icon with the existing bounded service-worker update behavior. The Settings button closes Settings and returns to the previous study/view state; the redundant Save & Exit panel and extra back control are gone. The Home control retains the guarded reader flush and local IndexedDB verification.

Archive status is red when there are revisions since the last *confirmed export*, green when the last confirmed exported revision is current, and reserves yellow for an actual future upload-in-progress state. Ordinary IndexedDB writes do not appear as a cloud upload. No Google sign-in, cloud storage, authentication, or synchronization is included. Existing JSON backups and data schema are unchanged; the new version migration is an identity step.

The separate `feature/google-drive-backups` work remains an unmerged, diverged branch based on v0.9.5 and is intentionally NOT applied to this v0.9.6 release.
