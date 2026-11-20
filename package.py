#!/usr/bin/env python3
"""Build Ciyan application assets in dist/ciyan for the AppLauncher host.

Usage: python3 package.py

This copies only deployable files. No dependencies, command-line arguments,
or build tooling are required. Run it from any working directory.
"""

from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "dist" / "ciyan"
STATIC_FILES = (
    "styles.css", "app-host-bridge.js",
    "app.js", "reader-core.js", "reader-boundaries.js", "reader-ui.js", "reader-library.js", "speech-vault.js", "reader-guide.js", "reader-speech.js", "reader-cloud-speech.js", "chapter-download.js", "collection-reset.js",
    "backup-versions.js",
    "study-engine.js", "study-progress.js",
    "tag-weights.js",
    "grammar-context.js",
    "context-matching.js",
    "review-scheduler.js",
    "particles.js", "particle-content.js", "learning-feedback.js",
    "tags.js",
    "drawing.js",
    "drawing-grades.js",
    "fonts.js", "font-library.js", "font-sources.js",
    "backup-integrity.js",
    "backup-restore.js",
    "fsrs.js",
    "storage.js",
    "cards.js",
    "grammar.js",
    "master-data.js",
    "master.js",
    "session-controls.js",
    "hsk-tag-map.js",
)
STATIC_DIRS = ("icons", "chapters")


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

    print(f"Ciyan app module build: {TARGET}")


if __name__ == "__main__":
    main()
