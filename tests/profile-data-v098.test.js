import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultState,makeBackup,parseBackup} from '../storage.js';
import {importedProfileState,resetProfileState} from '../profile-data.js';
import {MASTER} from '../master-data.js';

test('strict profile imports do not inherit current dictionary, settings, or credentials',()=>{
 const prior=defaultState();prior.cards.push({id:'extra',hanzi:'专有新词',pinyin:'',english:'Current-only word',tags:[]});prior.speechVault={version:1,salt:'1',iv:'2',data:'3'};
 const imported=defaultState();imported.cards=imported.cards.slice(0,2);imported.grammar=[];imported.settings.theme='dark';
 const strict=importedProfileState(imported,prior,MASTER,'strict');
 assert.equal(strict.cards.length,2);assert.equal(strict.grammar.length,0);
 assert.equal(strict.speechVault,undefined);assert.equal(strict.settings.theme,'dark');
 assert.equal(strict.backedUpRevision,-1);assert.equal(strict.explicitDictionary,true);
});

test('keep dictionary import adds only missing current entries',()=>{
 const backup=defaultState(),prior=defaultState();
 backup.cards=backup.cards.slice(0,1);backup.grammar=[];
 prior.cards.push({id:'custom',hanzi:'独有词',pinyin:'',english:'Custom',tags:[]});
 const actual=importedProfileState(backup,prior,MASTER,'keep');
 assert(actual.cards.some(c=>c.hanzi==='独有词'));
 assert.equal(actual.cards.filter(c=>c.hanzi===backup.cards[0].hanzi).length,1);
});

test('resetting a dictionary to master preserves the historic review identity',()=>{
 const data=defaultState(),card=data.cards[0];
 data.schedules[card.id]={reps:3,dueAt:'2026-11-24T00:00:00Z',lastReviewedAt:'2026-11-22T00:00:00Z',stability:4,difficulty:5,lastRating:3};
 data.history=[{id:'record',cardId:card.id,at:'2026-11-22T00:00:00Z',grade:3}];
 const replaced=importedProfileState(data,defaultState(),MASTER,'master');
 assert(replaced.cards.some(c=>c.id===card.id));
 const restored=parseBackup(makeBackup(replaced));
 assert.equal(restored.history.length,1);
});

test('clearing the active dictionary preserves referenced cards in the archive',()=>{
 const state=defaultState();const id=state.cards[0].id;
 state.history=[{id:'x',cardId:id,at:'2026-11-23T00:00:00Z',grade:3}];
 resetProfileState(state,'clear',MASTER);
 assert.equal(state.cards.length,0);assert.equal(state.grammar.length,0);
 assert(state.archived.cards.some(c=>c.id===id));
 assert.equal(parseBackup(makeBackup(state)).history.length,1);
});

test('reset settings also removes encrypted credentials without clearing records',()=>{
 const s=defaultState();s.settings.theme='dark';s.speechVault={version:1,salt:'123',iv:'123',data:'123'};
 s.history=[{id:'historic'}];resetProfileState(s,'settings',MASTER);
 assert.equal(s.speechVault,undefined);assert.notEqual(s.settings.theme,'dark');
 assert.equal(s.history.length,1);
});
