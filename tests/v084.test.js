import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeRestoredContent} from '../backup-restore.js';
import {defaultState} from '../storage.js';
import {nextExercise} from '../study-engine.js';

test('an oversized backup merge rejects both collections before assigning either',()=>{
 const cards=Array.from({length:20000},(_,i)=>({id:String(i),hanzi:String(i)}));
 const restored={cards,grammar:[]};
 const current={cards:[{id:'extra',hanzi:'新'}],grammar:[]};
 assert.throws(()=>mergeRestoredContent(restored,current,{cards:[],grammar:[]}),/20,000/);
 assert.equal(restored.cards,cards);
 assert.deepEqual(restored.grammar,[]);
});

test('daily introductions are counted once per exercise selection',()=>{
 const s=defaultState(), now=Date.now();
 s.settings.newWordsPerDay=2;
 s.cards=Array.from({length:50},(_,i)=>({id:String(i),hanzi:'字'+i,tags:[]}));
 let scans=0;
 s.history=[{cardId:'previous',first:true,at:new Date(now).toISOString()}];
 s.history[Symbol.iterator]=function(){scans++;return Array.prototype.values.call(this);};
 assert.ok(nextExercise(s,{mode:'words',pool:'new'},now,()=>0));
 assert.equal(scans,1);
 s.settings.newWordsPerDay=1;
 assert.equal(nextExercise(s,{mode:'words',pool:'new'},now,()=>0),null);
});
