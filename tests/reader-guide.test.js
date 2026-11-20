import test from 'node:test';
import assert from 'node:assert/strict';
import {mountReadingGuide} from '../reader-guide.js';

function fixture(){
 function element(dataset={}){
  const listeners={},classes=new Set();
  return {dataset,textContent:'',hidden:false,checked:false,value:'',classes,
   addEventListener(type,fn){listeners[type]=fn;},
   fire(type,extra={}){listeners[type]?.({target:this,preventDefault(){},...extra});},
   replaceChildren(){},append(){},setAttribute(){},
   closest(){return null;},getBoundingClientRect:()=>({top:600,bottom:640,height:40}),
   classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),toggle:(v,on)=>on?classes.add(v):classes.delete(v)}};
 }
 const win=element(),doc=element(),pages=element(),toolbar=element(),play=element(),output=element();
 const toggle=element(),audio=element(),speechStatus=element(),voice=element(),config=element(),region=element(),key=element(),dock=element(),sheet=element(),audioControls=element();
 let y=0,frameId=0;
 const frames=new Map();
 Object.assign(win,{innerHeight:800,scrollTo(x,dy){y=dy;},scrollBy(x,dy){y+=dy;},
  getComputedStyle:()=>({getPropertyValue:()=> '12px'}),
  requestAnimationFrame(fn){const id=++frameId;frames.set(id,fn);return id;},
  cancelAnimationFrame(id){frames.delete(id);},
  runFrames(){const queued=[...frames.values()];frames.clear();for(const fn of queued)fn(16);}});
 doc.defaultView=win;doc.createElement=()=>({append(){},replaceChildren(){},label:''});
 pages.ownerDocument=doc;
 toolbar.querySelector=q=>q==='output'?output:play;
 const row=element({pid:'p1',index:'0'}),article=element({readerNumber:'1'});
 article.getBoundingClientRect=()=>({top:12-y,bottom:1800-y});
 row.closest=()=>article;row.getBoundingClientRect=()=>({top:32-y,bottom:700-y});
 const words=['我','喜欢','书'].map((text,i)=>{
  const w=element({wordIndex:String(i),offset:String([0,1,3][i])});w.textContent=text;
  w.getBoundingClientRect=()=>({top:32+20*i-y,height:20});
  w.closest=q=>q==='[data-pid]'?row:q==='[data-word-index]'?w:null;
  return w;
 });
 const nodes={
  '[data-guide-controls]':toolbar,'[data-guide="toggle"]':toggle,'[data-guide-audio]':audio,
  '[data-speech-status]':speechStatus,'[data-voice-select]':voice,'[data-reader-settings-sheet]':sheet,
  '.reader-dock':dock,'[data-audio-controls]':audioControls,'[data-cloud-config]':config,
  '[data-cloud-region]':region,'[data-cloud-key]':key,
 };
 pages.querySelector=q=>nodes[q]||(q.startsWith('article')?article:null);
 pages.querySelectorAll=q=>q==='[data-pid]'?[row]:words;
 row.querySelectorAll=()=>words;row.querySelector=()=>words[0];
 return {win,doc,pages,words,row,play,toggle,audio,voice,speechStatus,getScroll:()=>y};
}

test('single tap shows controls; double tap opens dictionary without toggling controls', t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=fixture(),definitions=[],taps=[],saved=[];let focus;
 const dispose=mountReadingGuide(f.pages,{
  save:(n,p)=>saved.push(p),define:(word,seek)=>{definitions.push(word);focus=seek;},
  initialRate:120,rateChanged(){},extend:async()=>{},onTap:()=>taps.push('tap')
 });
 const wordTarget=w=>({closest:q=>q==='[data-word-index]'?w:null});
 f.pages.fire('click',{target:wordTarget(f.words[0])});
 assert.equal(definitions.length,0);
 t.mock.timers.tick(360);
 assert.deepEqual(taps,['tap']);
 f.pages.fire('click',{target:wordTarget(f.words[1])});
 f.pages.fire('click',{target:wordTarget(f.words[1])});
 assert.deepEqual(definitions,[f.words[1]]);
 assert.equal(taps.length,1);
 focus();assert.equal(saved.at(-1).wordIndex,1); // guide from here also works if off
 // A double tap at 300ms must still work: it used to be lost when the
 // 285ms single-tap timer cleared the target before the 360ms cutoff.
 f.pages.fire('click',{target:wordTarget(f.words[2])});
 t.mock.timers.tick(300);
 f.pages.fire('click',{target:wordTarget(f.words[2])});
 assert.deepEqual(definitions,[f.words[1],f.words[2]]);
 assert.equal(taps.length,1);
 dispose();
});

test('guide transport still steps through words and saves the bookmark',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=fixture(),saved=[];
 const dispose=mountReadingGuide(f.pages,{save:(n,p)=>saved.push(p),define(){},initialRate:120,rateChanged(){},extend:async()=>{},initialGuide:true});
 assert.equal(saved.at(-1).wordIndex,0);
 const target=action=>({closest:q=>q==='[data-guide]'?{dataset:{guide:action}}:null});
 f.pages.fire('click',{target:target('play')});
 t.mock.timers.tick(500);assert.equal(saved.at(-1).wordIndex,1);
 t.mock.timers.tick(1000);assert.equal(saved.at(-1).wordIndex,2);
 f.pages.fire('click',{target:target('play')});
 dispose();
});

test('paused reader and touch grace period allow free scrolling',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=fixture();
 const dispose=mountReadingGuide(f.pages,{save(){},define(){},initialRate:10,rateChanged(){},extend:async()=>{},initialGuide:true});
 const press=action=>f.pages.fire('click',{target:{closest:q=>q==='[data-guide]'?{dataset:{guide:action}}:null}});
 f.win.scrollBy(0,400);press('forward');assert.equal(f.getScroll(),400);
 f.win.fire('touchstart');press('play');f.win.fire('touchend',{touches:[]});
 t.mock.timers.tick(2999);assert.equal(f.getScroll(),400);
 f.win.fire('touchstart');t.mock.timers.tick(1);assert.equal(f.getScroll(),400);
 f.win.fire('touchend',{touches:[]});t.mock.timers.tick(3000);assert.notEqual(f.getScroll(),400);
 dispose();
});


test('scrolling while the guide is paused seeks to the visible word and saves that bookmark',()=>{
 const f=fixture(),saved=[];
 const dispose=mountReadingGuide(f.pages,{save:(n,p)=>saved.push(p),define(){},initialRate:120,rateChanged(){},extend:async()=>{},initialGuide:true});
 assert.equal(saved.at(-1).wordIndex,0);
 f.win.scrollBy(0,43);
 f.win.fire('scroll');f.win.runFrames();
 assert.equal(f.getScroll(),43,'paused guide must not scroll-lock');
 assert.equal(saved.at(-1).wordIndex,1,'saved bookmark should move to the first visible word');
 assert.ok(f.words[1].classes.has('reader-current'));
 dispose();
});
