# Cíyán v0.8.17 — AppLauncher submodule extraction

Ciyan becomes an app-only package, hosted by the independent AppLauncher
v0.1.0 PWA. No learning, reader, font, or user data is reset.

- Ciyan exports browser modules, styles, icon assets, and hosted chapter bundles.
- `python3 package.py` creates `dist/ciyan` (app assets only), not a standalone PWA.
- AppLauncher now owns the HTML shell, viewport restrictions, manifest,
  service worker, update controls, launcher and Cloudflare deployment.
- `app-host-bridge.js` is the narrow host interface used for Save & Exit and
  update/reload, avoiding importing the launcher into the Ciyan repository.
- Original root asset paths remain unchanged when AppLauncher builds the site.
- `0.8.16 -> 0.8.17` is an identity migration; existing progress stays intact.

Deploy Ciyan by pushing this repo: GitHub Actions can notify AppLauncher to
advance its pinned submodule and trigger the combined Cloudflare deployment.
See AppLauncher README for the one-time setup and secret configuration.
