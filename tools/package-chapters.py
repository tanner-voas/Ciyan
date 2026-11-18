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
    entry["file"] = f"{entry['novel']}-{entry['number']}.zip"
    entry["digest"] = hashlib.sha256(data).hexdigest()
    entry["size"] = len(data)
    with ZipFile(dest / entry["file"], "w") as archive:
        archive.writestr(ZipInfo("chapter.json"), data, compress_type=ZIP_DEFLATED)
    catalog.append(entry)
(dest / "index.js").write_text("export default " + json.dumps(catalog, ensure_ascii=False, indent=2) + ";\n")
