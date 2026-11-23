# Ciyan v0.9.8 — verified cloud backups and simpler profile operations

- Full initial Google Drive Push is verified before a local profile becomes cloud-backed. Retry an incomplete v0.9.7 Push without deleting local data.
- Shared Profile menu shows connection checks, operation progress, errors and local/cloud identity. Cloud name collisions require an exact typed overwrite confirmation; existing cloud revision history is preserved.
- Ciyan archive menu contains context-specific Push/Sync, local JSON export, local import, Start fresh and cloud history. Settings contains six typed-confirm resets.
- Manual JSON import creates a new **local** profile, with an editable name and three explicit dictionary choices. Secrets/settings and progress come from the chosen backup, never from the previous profile. Backup exports now include profile metadata.
- Cloud-backed changes auto-sync on a bounded debounce. Home and standalone Refresh attempt the pending sync and ask before proceeding after failure.
- Study input is not rerendered by background progress updates. The archive status only turns green for a confirmed current cloud revision or user-confirmed local export, as appropriate.
- Full contents are preserved in locally isolated IndexedDB databases. Cloud resets fork to a new local profile rather than overwrite the cloud original. PIN-encrypted credentials remain PIN-protected.

## Deploy order

1. Push the PWA-GoogleDrive v0.1.3 patch and wait for its GitHub Action to update the Ciyan shared submodule.
2. Pull Ciyan main, apply the Ciyan v0.9.8 patch with `git am`, and push.
3. The Ciyan -> AppLauncher coordinator updates the two AppLauncher gitlinks in one commit. Rebuild both Workers.
4. In Ciyan, retry **Push profile** for an incomplete old local profile, or import the JSON as a separate local profile. Wait for the **verified cloud backup** state. Inspect Drive `AppLauncher Profiles/profiles/.../ciyan/head.json` and `objects`.

**Safety:** Until a full cloud upload and recovery have been tested on your own deployment, keep an independently downloaded complete JSON backup. Do not delete the original local profile or Drive metadata.
