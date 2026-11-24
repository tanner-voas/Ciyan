#!/usr/bin/env python3
"""Build both deployable outputs without mixing their PWA shells.

- dist/ciyan: Ciyan app module for AppLauncher (no HTML, manifest or SW).
- dist/standalone: independent Ciyan PWA, directly deployed by Wrangler.

Usage: python3 package.py (also npm run build)
"""

from pathlib import Path
import json
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "dist" / "ciyan"
STANDALONE = ROOT / "dist" / "standalone"
STANDALONE_SHELL = (
    "index.html", "manifest.webmanifest", "standalone-boot.js",
    "pwa-update.js", "viewport-lock.js", "_headers",
)
STATIC_FILES = (
    "styles.css", "app-host-bridge.js", "browser-host.js", "browser-files.js",
    "app.js", "reader-core.js", "reader-boundaries.js", "reader-ui.js", "reader-editions.js", "reader-library.js", "speech-vault.js", "reader-guide.js", "reader-speech.js", "reader-cloud-speech.js", "chapter-download.js", "collection-reset.js",
    "backup-versions.js", "backup-indicator.js", "cloud-profiles.js", "profile-data.js", "profile-menu-actions.js",
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
    "backup-integrity.js", "reader-portability.js", "cloud-recovery.js", "reader-offline.js",
    "backup-restore.js",
    "fsrs.js",
    "storage.js",
    "cards.js",
    "grammar.js",
    "master-data.js", "master-v099-editorial.js",
    "master.js",
    "session-controls.js",
    "hsk-tag-map.js",
)
STATIC_DIRS = ("icons", "chapters")
PROFILE_SOURCE = ROOT / "shared" / "google-drive" / "src"


CORE = ROOT / 'shared' / 'pwa-core'


def load_offline_core():
    # The caller initializes submodules explicitly (CI uses recursive checkout).
    # Never silently substitute another library revision or fetch browser code.
    if not (CORE / 'build/offline.py').is_file():
        raise FileNotFoundError('Missing PWA-Core; run git submodule update --init --recursive')
    if (ROOT / '.git').exists():
        status = subprocess.check_output(
            ['git', 'submodule', 'status', '--', 'shared/pwa-core'], cwd=ROOT, text=True)
        if not status.startswith(' '):
            raise RuntimeError('PWA-Core checkout does not match its pinned gitlink')
        if subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=no'],
                                   cwd=CORE, text=True).strip():
            raise RuntimeError('PWA-Core contains uncommitted tracked changes')
    sys.path.insert(0, str(CORE / 'build'))
    from offline import asset_record, generate_worker
    return asset_record, generate_worker


def reader_groups(path):
    # The original archives are also prerequisites of each graded edition.
    if path.startswith('chapters/') and path.endswith('.zip'):
        return ['reader:original', 'reader:hsk4', 'reader:hsk5', 'reader:hsk6']
    for prefix, group in [('chapters/graded-v099-hsk4/', 'reader:hsk4'),
                          ('chapters/graded-v095-hsk5/', 'reader:hsk5'),
                          ('chapters/graded-v094/', 'reader:hsk6')]:
        if path.startswith(prefix): return [group]
    return None

def main() -> None:
    asset_record, generate_worker = load_offline_core()
    sources = [ROOT / name for name in (*STATIC_FILES, *STATIC_DIRS)]
    missing = [str(source.relative_to(ROOT)) for source in sources if not source.exists()]
    if missing:
        raise FileNotFoundError("Missing app assets: " + ", ".join(missing))

    if TARGET.exists():
        shutil.rmtree(TARGET)
    TARGET.mkdir(parents=True)

    for name in STATIC_FILES:
        shutil.copy2(ROOT / name, TARGET / name)
    # Keep the legacy reader-offline.js URL, with no extra runtime request.
    shutil.copy2(CORE / "src/offline-request.js", TARGET / "reader-offline.js")
    for name in ("browser-host.js", "browser-files.js"):
        shutil.copy2(CORE / "src" / name, TARGET / name)
    for name in STATIC_DIRS:
        shutil.copytree(ROOT / name, TARGET / name,
                        ignore=shutil.ignore_patterns("graded-v091", "graded-v092") if name == "chapters" else None)

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
    shutil.copy2(CORE / "src/pwa-update.js", STANDALONE / "pwa-update.js")
    assets = []
    for file in sorted(STANDALONE.rglob("*")):
        if not file.is_file() or file.name == '_headers': continue
        path = file.relative_to(STANDALONE).as_posix()
        assets.append(asset_record(STANDALONE, file, reader_groups(path) or ['shell']))
    package_version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    cache, worker, inventory = generate_worker(
        assets, cache_prefix='ciyan-shell-', version=package_version,
        legacy_prefixes=('app-launcher-shell-',), excluded_path_prefixes=('/_profiles/',))
    (STANDALONE / "sw.js").write_text(worker, encoding="utf-8")
    (STANDALONE / 'offline-inventory.json').write_text(inventory+'\n', encoding='utf-8')
    print('Required offline bytes:', sum(a['size'] for a in assets if 'shell' in a['groups']))
    print(f"Ciyan app module build: {TARGET}")
    print(f"Ciyan standalone PWA build: {STANDALONE} (offline cache {cache})")


if __name__ == "__main__":
    main()
