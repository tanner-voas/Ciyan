import test from 'node:test';
import assert from 'node:assert/strict';
import {sealSpeech,openSpeech,unlockSpeech} from '../speech-vault.js';
import {parseBackup,defaultState} from '../storage.js';
import {prepareVerifiedBackup} from '../backup-integrity.js';
import {availableModes,setListeningAuto,candidates,recordExercise,SHARES} from '../study-engine.js';
import {chapterLabel} from '../reader-ui.js';
import {createCloudNarrator,clearSpeechCache} from '../reader-cloud-speech.js';

test('portable secrets unlock independently of study progress; device key stays local',async()=>{
 const state=defaultState();
 Object.assign(state,await sealSpeech('0123','eastasia','test-key'));
 assert.equal(state.deviceKey.extractable,false);
 assert.equal((await openSpeech(state.speechVault,structuredClone(state.deviceKey))).key,'test-key');
 const {json}=prepareVerifiedBackup(state);
 for(const literal of ['deviceKey','test-key','eastasia'])assert.ok(!json.includes(literal));
 const restored=parseBackup(JSON.parse(json));
 assert.deepEqual(restored.cards,state.cards);
 await assert.rejects(unlockSpeech(restored.speechVault,'4321'),/PIN/);
 assert.equal((await unlockSpeech(restored.speechVault,'0123')).region,'eastasia');
 const rotated=await sealSpeech('9876','eastasia','test-key');
 await assert.rejects(unlockSpeech(rotated.speechVault,'0123'));
 assert.equal((await unlockSpeech(rotated.speechVault,'9876')).key,'test-key');
});
test('Listening shares grammar prerequisites and owns its schedule, history and Auto switch',()=>{
 const state=defaultState(),now=Date.now();
 for(const c of state.cards)state.schedules[c.id]={score:3};
 const eligible=mode=>candidates(state,mode,false,now).map(c=>c.id);
 assert.deepEqual(eligible('listening'),eligible('grammar'));
 const session={mode:'auto',results:[],spent:{},current:{mode:'listening',id:state.grammar[0].id}};
 assert.ok(!availableModes(state,session).includes('listening'));
 setListeningAuto(true);assert.ok(availableModes(state,session).includes('listening'));
 setListeningAuto(false);assert.ok(SHARES.listening<SHARES.grammar);
 const record=recordExercise(state,session,3,{},now);
 assert.equal(state.skillSchedules.listening[record.id].reps,1);
 assert.equal(state.grammarHistory.length,0);assert.deepEqual(state.skillSchedules.grammar,{});
});
test('chapter number disambiguates parts while keeping meaningful title characters',()=>{
 assert.equal(chapterLabel({number:4,title:'第四章 成长（上）'}),'CH0004 • 成长');
 assert.equal(chapterLabel({number:9,title:'山上人家'}),'CH0009 • 山上人家');
});
test('prefetched sentences reuse decoded audio; elapsed loading consumes the paragraph pause',async()=>{
 clearSpeechCache();
 let fetches=0;const starts=[];
 class Context{
  currentTime=10;state='running';
  async decodeAudioData(){return {duration:1};}
  createBufferSource(){return {connect(){},disconnect(){},start(time){starts.push(time);},stop(){}};}
  async close(){}
 }
 const win={AudioContext:Context,cancelAnimationFrame(){},requestAnimationFrame(){},async fetch(){fetches++;return new Response(new Uint8Array(1));}};
 const n=createCloudNarrator(win,()=>{},()=>{},message=>assert.fail(message));
 const args=['zh-CN-YunxiNeural',120,'eastasia','test-key'];
 await n.speak('第一句。',...args,{ahead:['第二句。','第三句。']});
 assert.equal(fetches,3);
 await n.speak('第二句。',...args,{deadline:performance.now()-40});
 assert.equal(starts.at(-1),10);
 await n.speak('第三句。',...args,{deadline:performance.now()+40});
 assert.ok(starts.at(-1)>10&&starts.at(-1)<=10.05);
 assert.equal(fetches,3);n.dispose();clearSpeechCache();
});
