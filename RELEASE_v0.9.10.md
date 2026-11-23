# Ciyan v0.9.10 — Cloud profile manager integration

This release follows v0.9.9 without changing its Panlong readers or dictionary.

- Wire Push, Sync, and Fork actions into Ciyan's shared profile manager.
- The archive-menu Push action opens the same upload workflow and performs
  the actual verified backup instead of opening an inert profile menu.
- Flush the reader and verify IndexedDB writes before uploading or switching.
- Use the v0.1.4 shared profile-manager lifecycle to avoid duplicate dialogs
  when running Ciyan inside AppLauncher.
- Preserve a local profile when Google Drive uploads fail; metadata creation
  is not proof of a backed-up dictionary.
