# Cíyán v0.8.14 — My Apps launcher

## User experience

- The installed site's root URL now opens a small **My Apps** launcher with one selectable app, **Cíyán**.
- Selecting Cíyán opens the existing Study home screen, with the existing navigation and behavior unchanged.
- In Cíyán Settings, **Save & Exit to My Apps** flushes pending reader position/playback settings, waits for in-flight IndexedDB writes, verifies the current local revision on disk, and navigates back to the launcher. The unfinished study session remains saved, not forcibly completed.
- Returning Home performs a full document navigation, dropping the Cíyán JavaScript runtime; Home does not import the learning database or Cíyán app code.

## Compatibility and safety

- The same website origin, PWA manifest ID (`./`), app icon, and existing Cíyán IndexedDB/cache names are retained. **Do not uninstall the existing PWA** to deploy this update; uninstalling may discard on-device data.
- The route is `?app=ciyan` under the existing deployed site folder, so chapter text URLs and caches do not move.
- Offline service-worker navigation resolves both `./` (Home) and `./?app=ciyan` (Cíyán) to the cached index page. The new loader and all existing Cíyán shell files are pre-cached.
- All user study changes are already committed to IndexedDB during normal use. Exiting is a local save/verification, **not** an exported JSON backup. Continue using the app's existing backups for long-term protection.
- Incomplete font selection drafts must be applied or discarded before exiting. A save error prevents navigation and leaves Cíyán open.
- Future apps may be registered in `launcher.js` with their own module and separate storage namespaces. They remain same-origin applications, not OS-level security sandboxes.

## Distribution

Build with `python3 package.py`, then deploy the contents of `dist/ciyan/` to the **same** hosting origin and path as the existing app. A new origin will not be able to read existing device storage.

Tests: `npm test`. Dedicated launcher/backup/offline-route tests are in `tests/v0814.test.js`, with a Settings exit smoke test in `tests/ui-smoke.test.js`.
