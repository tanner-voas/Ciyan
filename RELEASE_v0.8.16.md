# Cíyán v0.8.16 — Workspace and iOS interaction fixes

This patch builds on v0.8.15. It preserves all existing local study data, fonts,
chapter caches, and PWA identity.

## My Workspace

- Replaces the oversized My Apps introduction with one **My Workspace** heading.
- Removes the subtitle, section/count heading, and unused M monogram.
- Adds a refresh/update icon in the top-right corner.
- Keeps Cíyán's tile and in-document launch path unchanged.
- Leaves the launcher vertically scrollable when more app tiles are registered.

## iPhone viewport behavior

- Suppresses browser pinch-to-zoom and multi-touch page zoom for the launcher and
  Cíyán, without intercepting single-finger vertical scrolling.
- Restricts horizontal document overflow while retaining scrolling inside content
  areas that intentionally scroll horizontally.
- Prevents control/trackpad-wheel zoom from accidentally magnifying the web app.
- Keeps the viewport scaled to the available screen width.

## Update checks

- Uses one shared update flow for Cíyán Settings and My Workspace.
- Checks for a new service worker and handles waiting, installing, and already
  activated workers without assuming that a `controllerchange` event must follow.
- Bounded network/activation waits avoid indefinite **Checking for updates…**
  states; failures restore the control and display an error.
- Successful refresh returns to the same location: Cíyán if launched from
  Cíyán, My Workspace if launched from Home.
- Adds the new helper scripts to static deployment and offline precaching.

## Compatibility and testing

- Adds an identity migration from v0.8.15 backups to v0.8.16; no user content
  migrations or local database/cache renaming are required.
- Automated coverage verifies update states, timeout recovery, touch behavior,
  minimalist launcher markup, offline precache registration, and backup migration.
- All 292 Node automated tests passed. Browser screenshot testing was blocked by
  the available Chromium environment. Confirm the experience on an iOS PWA.
