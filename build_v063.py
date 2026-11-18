#!/usr/bin/env python3
"""Rebuild the v0.6.3 master from its committed canonical content."""
from pathlib import Path
import json
r=Path(__file__).resolve().parent
data=json.loads((r/'content/master-v063.json').read_text())
assert len(data['cards'])==11893 and len(data['grammar'])==3444
(r/'master-data.js').write_text('// Bundled content for Ciyan v0.6.3.\nexport const MASTER='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
print('Rebuilt master:',len(data['cards']),'words',len(data['grammar']),'contexts')
