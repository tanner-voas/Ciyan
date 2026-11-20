import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBoundaries} from '../reader-boundaries.js';
import {chapterText,validateChapter} from '../reader-core.js';

test('joins master and novel words, keeps full term spellings, punctuation and paragraph IDs',()=>{
 const item=(hanzi,kind='vocab')=>({kind,hanzi,pinyin:'test',english:'fixture'});
 const p={format:'ciyan-chapter',version:1,novel:'fixture',book:'Test',title:'Test',number:1,revision:1,
  items:{a:item('学'),b:item('校'),c:item('石'),d:item('锁'),name:item('林雷','term'),family:item('巴鲁克','term')},
  focus:['name','family'],paragraphs:[{id:'p0',tokens:[['a'],['b'],'，',['c'],['d'],'。',['name'],'·',['family']]},
   {id:'p1',tokens:[['a'],'，',['b']]}]};
 const state={reader:{fixture:{items:{weight:item('石锁'),full:item('林雷·巴鲁克','term')}}}};
 const q=normalizeBoundaries(p,state);validateChapter(q);
 assert.equal(chapterText(q),chapterText(p));
 assert.deepEqual(q.paragraphs[0].tokens,[['vocab-学校'],'，',['weight'],'。',['full']]);
 assert.deepEqual(q.paragraphs[1],p.paragraphs[1]);
 assert.deepEqual(q.focus,['full','name','family'].filter(k=>Object.hasOwn(q.items,k)));
 assert.equal(normalizeBoundaries(q,state).boundaries,q.boundaries);
});

test('personal vocabulary stays distinct from a number and its classifier',()=>{
 const items=Object.fromEntries(['三','个人','的','意见'].map(h=>['vocab-'+h,{kind:'vocab',hanzi:h,pinyin:'p',english:'word'}]));
 const tokens=['三','个人','的','个人','意见'].map(h=>['vocab-'+h]);
 const q=normalizeBoundaries({novel:'example',items,paragraphs:[{id:'p1',tokens}]});
 assert.deepEqual(q.paragraphs[0].tokens.map(t=>q.items[t[0]].hanzi),['三','个','人','的','个人','意见']);
});
