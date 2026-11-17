// Run after build_decks.py. Only tag paths change; content and IDs stay intact.
import fs from 'node:fs';
import {normalizeTags} from './tags.js';
for(const file of [...fs.readdirSync(new URL('./decks/',import.meta.url)).filter(f=>f.endsWith('.json')).map(f=>'decks/'+f),'starter-deck.json']){
 const url=new URL(file,import.meta.url),data=JSON.parse(fs.readFileSync(url));
 if(!Array.isArray(data.cards))continue;
 for(const c of data.cards)c.tags=normalizeTags(c.tags||[]);
 fs.writeFileSync(url,JSON.stringify(data,null,2)+'\n');
}
