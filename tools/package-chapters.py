"""Regenerate the hosted chapter catalog from the supported reader JSON files."""
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
dest = root / "chapters"
dest.mkdir(exist_ok=True)
catalog = []
for path in sorted([*(root / "reader/samples").glob("*.json"), *(root / "reader/panlong/chapters").glob("*.json")]):
    data = path.read_bytes()
    chapter = json.loads(data)
    entry = {key: chapter[key] for key in ("book", "novel", "number", "title")}
    if chapter["novel"] == "panlong":
        # Metadata is intentionally catalog-only for Chapters 1–3: altering
        # those existing JSON bytes would invalidate previously saved digests.
        entry.update(author="我吃西红柿", authorSort="Wo Chi Xihongshi", volume=1, volumeTitle="盘龙之戒")
    else:
        # Stable sample novel identities protect existing user progress. One
        # visible sample collection per TSK level; future stories can be added
        # as subsequent chapters under that level's stable novel ID.
        samples = {
            "two-cups": ("TSK1 samples", "Cíyán"),
            "which-exit": ("TSK2 samples", "Cíyán"),
            "takeaway": ("TSK3 samples", "Cíyán"),
        }
        if chapter["novel"] in samples:
            entry["book"], entry["author"] = samples[chapter["novel"]]
            entry["authorSort"] = "Ciyan"
        elif chapter.get("author"):
            entry["author"] = chapter["author"]
    if chapter["novel"] != "panlong" and chapter.get("volume"):
        entry["volume"] = chapter["volume"]
        if chapter.get("volumeTitle"):
            entry["volumeTitle"] = chapter["volumeTitle"]
    entry["file"] = f"{entry['novel']}-{entry['number']}.zip"
    entry["digest"] = hashlib.sha256(data).hexdigest()
    entry["size"] = len(data)
    with ZipFile(dest / entry["file"], "w") as archive:
        archive.writestr(ZipInfo("chapter.json"), data, compress_type=ZIP_DEFLATED)
    catalog.append(entry)
(dest / "index.js").write_text("export default " + json.dumps(catalog, ensure_ascii=False, indent=2) + ";\n")
