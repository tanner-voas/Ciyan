# Cíyán v0.8.15 — iOS launcher stability hotfix

This update fixes the v0.8.14 launcher-to-Cíyán navigation instability reported on iOS.

- The My Apps tile launches Cíyán **in the existing PWA document** using an in-place history update and deferred module import. It no longer asks Safari to navigate to the app URL.
- Save & Exit verifies the existing IndexedDB state and reader position first, then rewrites the current URL to the launcher and reloads in-place. This destroys the previous Cíyán runtime before the launcher opens.
- Service-worker navigations now create a fresh `Response` from the cached or fetched body. Safari/WebKit rejects navigation responses with an inherited redirect flag, which can arise when the static host redirects `index.html` to its canonical root path.
- The root URL is no longer precached separately from `index.html`. The same cached document serves `/?app=ciyan` and the Home Screen offline.
- This worker version automatically activates after its cache is ready to replace the problematic v0.8.14 worker without requiring an app reinstall or clearing local site data.

Local Cíyán state, fonts, reader caches, backup format, and the installed PWA identity are unchanged. No data deletion or storage migration is required.

Automated tests cover Safari-style redirected cached responses, redirected network responses, offline navigation, versioned backup compatibility, and Save & Exit persistence. Real iOS PWA behavior must still be checked on-device.
