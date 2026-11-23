#!/usr/bin/env python3
"""Build both deployable outputs without mixing their PWA shells.

- dist/ciyan: Ciyan app module for AppLauncher (no HTML, manifest or SW).
- dist/standalone: independent Ciyan PWA, directly deployed by Wrangler.

Usage: python3 package.py (also npm run build)
"""

from pathlib import Path
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "dist" / "ciyan"
STANDALONE = ROOT / "dist" / "standalone"
STANDALONE_SHELL = (
    "index.html", "manifest.webmanifest", "standalone-boot.js",
    "pwa-update.js", "viewport-lock.js", "_headers",
)
STATIC_FILES = (
    "styles.css", "app-host-bridge.js",
    "app.js", "reader-core.js", "reader-boundaries.js", "reader-ui.js", "reader-editions.js", "reader-library.js", "speech-vault.js", "reader-guide.js", "reader-speech.js", "reader-cloud-speech.js", "chapter-download.js", "collection-reset.js",
    "backup-versions.js", "cloud-profiles.js",
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
PROFILE_SOURCE = ROOT / "shared" / "google-drive" / "src"


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
        shutil.copytree(ROOT / name, TARGET / name,
                        ignore=shutil.ignore_patterns("graded-v091") if name == "chapters" else None)

    if not PROFILE_SOURCE.is_dir():
        raise FileNotFoundError("Missing PWA-GoogleDrive submodule; run git submodule update --init --recursive")
    shutil.copytree(PROFILE_SOURCE, TARGET / "shared" / "google-drive" / "src", ignore=shutil.ignore_patterns("*.test.js"))

    # The standalone build consumes the exact same application asset bytes,
    # then layers on only its own entry point and PWA infrastructure.
    if STANDALONE.exists():
        shutil.rmtree(STANDALONE)
    shutil.copytree(TARGET, STANDALONE)
    for name in STANDALONE_SHELL:
        shutil.copy2(ROOT / name, STANDALONE / name)
    shell = [file for file in sorted(STANDALONE.rglob("*"))
             if file.is_file() and file.suffix.lower() in
             {".html", ".css", ".js", ".webmanifest", ".png", ".svg", ".woff", ".woff2", ".ttf", ".otf"}]
    digest = hashlib.sha256()
    for file in shell:
        digest.update(file.relative_to(STANDALONE).as_posix().encode() + b"\0")
        digest.update(hashlib.sha256(file.read_bytes()).digest())
    cache = f"ciyan-shell-v0.9.7-{digest.hexdigest()[:16]}"
    paths = ["./" + file.relative_to(STANDALONE).as_posix() for file in shell]
    template = (ROOT / "sw.standalone.template.js").read_text(encoding="utf-8")
    worker = template.replace("__SHELL_CACHE_NAME__", cache).replace(
        "__PRECACHE_ASSETS__", json.dumps(paths, ensure_ascii=False, separators=(",", ":")))
    (STANDALONE / "sw.js").write_text(worker, encoding="utf-8")
    print(f"Ciyan app module build: {TARGET}")
    print(f"Ciyan standalone PWA build: {STANDALONE} (offline cache {cache})")


if __name__ == "__main__":
    main()
