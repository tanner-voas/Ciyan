import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {defaultState,mergeDeck} from '../storage.js';
import {normalizeGrammar,parseSegments} from '../grammar.js';
import {DECKS} from '../deck-catalog.js';
const deck=id=>JSON.parse(fs.readFileSync(new URL(`../decks/${id}.json`,import.meta.url),'utf8'));
const tokens=markup=>[...markup.matchAll(/\{([^{}]+)\}/g)].map(m=>m[1]);
const big=deck('all-decks');
const allWords=new Set([...defaultState().cards,...big.cards].map(c=>c.hanzi));
const covered=new Set(big.grammar.flatMap(g=>tokens(g.markup)));
const geoPath=new URL('../content/geography-031.txt',import.meta.url);
const geographicData=fs.readFileSync(geoPath,'utf8');
const section=id=>geographicData.split('\n').slice(geographicData.split('\n').findIndex(l=>l.startsWith(`# ${id}|`))+1).filter(l=>l&&!l.startsWith('# '));

test('every vocabulary card, including original starter cards, appears in an exact grammar token',()=>{
 assert.equal(allWords.size,big.cards.length);
 assert.equal(big.cards.length,2277);
 assert.equal(big.grammar.length,1549);
 for(const w of allWords)assert.ok(covered.has(w),`Missing exact example: ${w}`);
});
test('every grammar example is structurally valid and has complete vocabulary prerequisites',()=>{
 const ids=new Set();
 for(const g of big.grammar){
  assert.doesNotThrow(()=>normalizeGrammar(g),g.markup);
  assert.ok(!ids.has(g.id),g.id);ids.add(g.id);
  const parsed=parseSegments(g.markup);assert.ok(parsed.some(s=>s.type==='token'));
  for(const token of tokens(g.markup))assert.ok(allWords.has(token),`Missing prerequisite ${token}`);
  for(const {word,index} of g.distractors||[]){assert.ok(allWords.has(word),word);assert.ok(index>0&&index<=tokens(g.markup).length);}
  assert.ok(g.english.length>1,g.id);assert.ok(g.pinyin,g.id);
  assert.ok(!/\bto to\b|\bvery likes\b|\bwith from\b/i.test(g.english),g.english);
 }
});
test('all individual decks contain at least one linked grammar usage of every imported word',()=>{
 for(const d of DECKS.filter(d=>!['all-decks','practical-grammar'].includes(d.id))){
  const content=deck(d.id),own=new Set(content.grammar.flatMap(g=>tokens(g.markup)));
  for(const c of content.cards)assert.ok(own.has(c.hanzi),`${d.id}: ${c.hanzi}`);
 }
});
test('all 50 US states are included; DC is listed independently',()=>{
 const original=geographicData.match(/# us-states[^\n]*\n([\s\S]*?)(?=\n# |$)/)[1].trim().split('\n');
 assert.equal(original.length,51);
 assert.equal(original.filter(r=>r.split('|')[2].includes('USA')&&!r.includes('Washington, DC')).length,50);
 const names=new Set(deck('us-states').cards.map(c=>c.hanzi));
 for(const line of original)assert.ok(names.has(line.split('|')[0]),line);
});
test('all 27 European Union countries and corresponding capitals have explicit fact cards',()=>{
 const content=geographicData.match(/# eu-capitals[^\n]*\n([\s\S]*?)(?=\n# |$)/)[1].trim().split('\n');
 assert.equal(content.length,54);
 const d=deck('eu-capitals');
 for(let i=0;i<content.length;i+=2){
  const c=content[i].split('|')[0],capital=content[i+1].split('|')[0];
  assert.ok(d.grammar.some(g=>g.markup===`{${c}}{的}{首都}{是}{${capital}}。`),`${c} => ${capital}`);
 }
});
test('province-level terms, UK constituent countries and specified Asian capitals are represented',()=>{
 const provinces=deck('china-regions');const words=new Set(provinces.cards.map(c=>c.hanzi));
 const must=['安徽','福建','甘肃','广东','贵州','海南','河北','河南','黑龙江','湖北','湖南','吉林','江苏','江西','辽宁','青海','山东','山西','陕西','四川','云南','浙江','台湾','广西','内蒙古','宁夏','西藏','新疆','北京','上海','天津','重庆','香港','澳门'];
 for(const w of must)assert.ok(words.has(w),w);
 const facts=deck('asia-world-capitals').grammar.map(g=>g.markup);
 for(const c of ['英格兰','苏格兰','威尔士','北爱尔兰'])assert.ok(facts.some(s=>s.includes(`{${c}}`)),c);
 for(const [c,capital] of [['越南','河内'],['新加坡','新加坡'],['菲律宾','马尼拉'],['印度尼西亚','雅加达'],['马来西亚','吉隆坡'],['韩国','首尔'],['朝鲜','平壤'],['老挝','万象'],['柬埔寨','金边'],['泰国','曼谷'],['澳大利亚','堪培拉'],['新西兰','惠灵顿'],['俄罗斯','莫斯科']])assert.ok(facts.some(s=>s.includes(`{${c}}`)&&s.includes(`{${capital}}`)),c);
});
test('user-provided visited places are tagged, without tagging all newly added places as visited',()=>{
 const visited=deck('visited-places');
 assert.ok(visited.cards.length>=155);
 for(const name of ['旧金山','萨克拉门托','优胜美地国家公园','太浩湖','柯林斯堡','宏村','平潭岛','恩施','南昌','西双版纳','新竹','吴哥窟','鹿特丹','爱丁堡','维尔茨堡']){
  if(name==='鹿特丹')continue; // not on the supplied visited list
  assert.ok(visited.cards.some(c=>c.hanzi===name),name);
 }
 const words=new Map(big.cards.map(c=>[c.hanzi,c]));
 for(const w of ['恩施','南昌'])assert.ok(words.get(w)?.tags.includes('Places/visited'),w);
 assert.ok(!words.get('波士顿')?.tags.includes('Places/visited'));
});
test('friend-chat expressions and broader contemporary, non-rude slang exist',()=>{
 const slang=deck('slang-friends');const modern=deck('slang-modern');
 for(const term of ['阳了','留守儿童','爬墙','不像话','抓现行','查岗','吐槽'])assert.ok(slang.cards.some(c=>c.hanzi===term),term);
 for(const term of ['摸鱼','绝了','无语','搭子','内卷','松弛感','吃瓜','上头'])assert.ok(modern.cards.some(c=>c.hanzi===term),term);
});
test('content-only imports remain strictly additive and no studied scheduling history is replaced',()=>{
 const previous=defaultState();previous.history=[{id:'sample',cardId:previous.cards[0].id,at:new Date().toISOString(),grade:3}];
 const updated=mergeDeck(previous,big).draft;
 assert.deepEqual(updated.history,previous.history);
 assert.equal(mergeDeck(updated,big).addedWords,0);
 assert.equal(mergeDeck(updated,big).addedGrammar,0);
});
