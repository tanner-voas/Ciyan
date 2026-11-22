"""Regenerate the hosted chapter catalog from the supported reader JSON files."""
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
dest = root / "chapters"
dest.mkdir(exist_ok=True)
previous_panlong_digests = {
    4: "d275a7ba6a76c7a8ed910602cdf8bdda822881009ce423c02d5c58115c7b7bc0",
    5: "143c88f2c4f6477ad75846b9afddd22b7d881413260475bac4e88eb6abe94466",
    6: "d3a3d3f05ca016cfa40524ac337d7e507480d0efde0525b3ef70486f2dda89a2",
    7: "a8ba650fded060e67df6c504651a9fd35059bad20f96c52397312f833580495a",
    8: "e78c80f4c9622cd9738d8a52b37ed32b4d6f30e920abbef46fc7b3f70b005144",
    9: "56b85ce0b8912a71e649c2267be33e42eb8dce7a6814b707fd11b73792c55da0",
    10: "c2d06adcd783139f4e4d23cf46a7ccb5b480147f36cd888c4ebb0c1ab794f1b8",
    11: "6433e07d57027eaa049d760805c50ade3ccf8c81bc37eed788c360aeab8023cd",
}
# Preserve every known earlier manifest digest so v0.7.x/v0.8.x readers
# upgrade after installing a newer service worker instead of staying on the
# old package or mistaking a master chapter for a custom upload.
old_catalog = {}
index_path = dest / "index.js"
if index_path.exists():
    original = index_path.read_text().removeprefix("export default ").strip().removesuffix(";")
    old_catalog = {(entry["novel"], entry["number"]): entry for entry in json.loads(original)}
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
    if chapter["novel"] == "panlong" and chapter.get("editionVersion") == 46:
        entry["file"] = f"panlong-pass46-{entry['number']}.zip"
    entry["digest"] = hashlib.sha256(data).hexdigest()
    entry["size"] = len(data)
    if chapter["novel"] == "panlong" and chapter.get("editionVersion") in (45, 46):
        edition_folder = "graded-v092" if chapter["editionVersion"] == 46 else "graded-v091"
        graded = f"{edition_folder}/{chapter['number']}.js"
        asset = json.loads((dest / graded).read_text().removeprefix("export default ").strip().removesuffix(";"))
        if asset["sourceDigest"] != entry["digest"]:
            raise ValueError(f"Stale graded asset: {graded}")
        entry["gradedFile"] = graded
    original_entry = old_catalog.get((chapter["novel"], chapter["number"]), {})
    prior = [original_entry.get("digest"), original_entry.get("previousDigest"),
             *(original_entry.get("previousDigests") or [])]
    if chapter["novel"] == "panlong":
        prior.append(previous_panlong_digests.get(chapter["number"]))
    prior = list(dict.fromkeys(h for h in prior if h and h != entry["digest"]))
    if prior:
        entry["previousDigest"] = prior[0]
        if len(prior) > 1:
            entry["previousDigests"] = prior[1:]
    with ZipFile(dest / entry["file"], "w") as archive:
        archive.writestr(ZipInfo("chapter.json"), data, compress_type=ZIP_DEFLATED)
    catalog.append(entry)
(dest / "index.js").write_text("export default " + json.dumps(catalog, ensure_ascii=False, indent=2) + ";\n")
