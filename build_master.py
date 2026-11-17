#!/usr/bin/env python3
"""Rebuild the single bundled master from the consolidated content source."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
source=json.loads((ROOT/'decks/all-decks.json').read_text())
source['title']='Cíyán master collection'
source['description']='Complete bundled vocabulary and grammar collection.'
(ROOT/'master-data.js').write_text('// Bundled master collection. Generated from the consolidated source.\nexport const MASTER = '+json.dumps(source,ensure_ascii=False,separators=(',',':'))+';\n')
