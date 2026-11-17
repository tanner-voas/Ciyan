#!/usr/bin/env python3
"""Build the static Cloudflare Pages upload folder in dist/ciyan.

Usage: python3 package.py

This copies only deployable files. No dependencies, command-line arguments,
or build tooling are required. Run it from any working directory.
"""

from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "dist" / "ciyan"
STATIC_FILES = (
    "index.html",
    "styles.css",
    "app.js",
    "backup-versions.js",
    "study-engine.js",
    "tag-weights.js",
    "grammar-context.js",
    "review-scheduler.js",
    "particles.js",
    "tags.js",
    "drawing.js",
    "fsrs.js",
    "storage.js",
    "cards.js",
    "grammar.js",
    "master-data.js",
    "master.js",
    "session-controls.js",
    "hsk-tag-map.js",
    "sw.js",
    "manifest.webmanifest",
    "_headers",
)
STATIC_DIRS = ("icons",)


def main() -> None:
    sources = [ROOT / name for name in (*STATIC_FILES, *STATIC_DIRS)]
    missing = [str(source.relative_to(ROOT)) for source in sources if not source.exists()]
    if missing:
        raise FileNotFoundError("Missing app assets: " + ", ".join(missing))

    if TARGET.exists():
        shutil.rmtree(TARGET)
    TARGET.mkdir(parents=True)

    for name in STATIC_FILES:
        shutil.copy2(ROOT / name, TARGET / name)
    for name in STATIC_DIRS:
        shutil.copytree(ROOT / name, TARGET / name)

    print(f"Cloudflare Pages upload folder: {TARGET}")


if __name__ == "__main__":
    main()
