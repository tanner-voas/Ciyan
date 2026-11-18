import test from 'node:test';
import assert from 'node:assert/strict';
import {mandarinVoices,speechPassage,createNarrator} from '../reader-speech.js';

const voice=(lang,name,localService=true)=>({lang,name,localService});
test('prefers local Mandarin voices and prefers enhanced mainland voices',()=>{
 const best=voice('zh_CN','Enhanced'),standard=voice('zh-CN','Standard'),taiwan=voice('zh-TW','Taiwan');
 assert.deepEqual(mandarinVoices([voice('en-US','US'),voice('zh-HK','Hong Kong'),taiwan,standard,voice('zh-CN','Cloud',false),best]),[best,standard,taiwan,voice('zh-CN','Cloud',false)]);
});

function fixture(){
 const row={textContent:'早。她说：“上海很好！”走吧。'};
 const words=['早','她','说','上海','很','好','走','吧'].map(textContent=>({textContent,closest:()=>row,dataset:{offset:String(row.textContent.indexOf(textContent))}}));
 row.querySelectorAll=()=>words;
 return words;
}
test('reads a continuous sentence from the selected word, retaining punctuation',()=>{
 const words=fixture(),p=speechPassage(words[1]);
 assert.equal(p.text,'她说：“上海很好！”');
 assert.deepEqual(p.words,words.slice(1,6));
 assert.equal(speechPassage(words[3]).text,'上海很好！”');
});
test('word callbacks update the guide and late callbacks cannot advance a canceled reading',()=>{
 const words=fixture(),heard=[],selected=[];
 let ended=0,errors=0,canceled=0;
 const win={SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},speechSynthesis:{speak(u){heard.push(u);},cancel(){canceled++;}}};
 const n=createNarrator(win,w=>selected.push(w.textContent),()=>ended++,()=>errors++);
 n.speak(words[1],voice('zh-CN','Mandarin'),300);
 const u=heard[0];assert.equal(u.rate,1.25);
 u.onboundary({name:'word',charIndex:4});assert.deepEqual(selected,['上海']);
 n.speak(words[6],voice('zh-CN','Mandarin'),240);
 u.onerror();u.onend();assert.equal(ended,0);assert.equal(errors,0);assert.equal(canceled,1);
 heard[1].onend();assert.equal(ended,1);assert.deepEqual(selected,['上海','吧']);
 n.speak(words[0],voice('zh-CN','Mandarin'),120);heard[2].onerror();assert.equal(errors,1);
});

test('starts Mandarin with no enumerated voices and resumes a paused speech engine',()=>{
 let spoken,resumed=false;
 const win={SpeechSynthesisUtterance:class{},speechSynthesis:{paused:true,resume(){resumed=true;},speak(u){spoken=u;},cancel(){}}};
 const n=createNarrator(win,()=>{},()=>{},()=>{});
 n.speak(fixture()[0],undefined,120);
 assert.ok(resumed);assert.equal(spoken.lang,'zh-CN');assert.equal(spoken.volume,1);assert.equal(spoken.voice,undefined);
 n.cancel();
});
