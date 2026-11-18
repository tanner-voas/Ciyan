import test from 'node:test';
import assert from 'node:assert/strict';
import {mountReadingGuide} from '../reader-guide.js';

test('guide gestures, word-length timing, centered position and manual bookmarks',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 function element(dataset={}){
  const listeners={},classes=new Set();
  return {dataset,classes,addEventListener(type,fn){listeners[type]=fn;},
   fire(type,extra={}){listeners[type]?.({target:this,button:0,isPrimary:true,clientX:4,clientY:4,...extra});},
   classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),toggle:(v,on)=>on?classes.add(v):classes.delete(v)},
   setAttribute(){},closest(){return null;}};
 }
 const win=element(),doc=element(),pages=element(),bar=element(),toolbar=element(),play=element(),output=element(),toggle=element();
 let y=0;
 Object.assign(win,{innerHeight:800,scrollTo(x,dy){y=dy;},scrollBy(x,dy){y+=dy;},getComputedStyle:()=>({getPropertyValue:()=> '12px'}),
  requestAnimationFrame:fn=>{queueMicrotask(fn);return 1;},cancelAnimationFrame(){}});
 doc.defaultView=win;pages.ownerDocument=doc;
 bar.getBoundingClientRect=()=>({top:688,bottom:730});bar.offsetHeight=40;
 toolbar.querySelector=q=>q==='output'?output:play;
 pages.querySelector=q=>q==='.reader-guide-bar'?bar:q.startsWith('article')?article:q.includes('controls')?toolbar:toggle;
 const row=element({pid:'p1',index:'0'}),article=element({readerNumber:'1'});
 article.getBoundingClientRect=()=>({top:12-y,bottom:1800-y});
 row.closest=()=>article;row.getBoundingClientRect=()=>({top:32-y,bottom:700-y});
 const words=['我','喜欢','书'].map((text,i)=>{
  const w=element({wordIndex:String(i),offset:String([0,1,3][i])});w.textContent=text;
  w.getBoundingClientRect=()=>({top:32+20*i-y,height:20});
  w.closest=q=>q==='[data-pid]'?row:q==='[data-word-index]'?w:null;
  return w;
 });
 pages.querySelectorAll=q=>q==='[data-pid]'?[row]:words;row.querySelectorAll=()=>words;row.querySelector=()=>words[0];
 const saved=[],definitions=[];
 const dispose=mountReadingGuide(pages,{save:(n,p)=>saved.push(p),define:w=>definitions.push(w),initialRate:120,rateChanged(){},extend:async()=>{}});
 const click=k=>pages.fire('click',{target:{closest:()=>({dataset:{guide:k}})}});
 const touch=(type,i)=>pages.fire(type,{target:words[i]});
 touch('pointerdown',0);touch('pointerup',0);assert.equal(definitions.length,0);
 touch('pointerdown',0);touch('pointerup',0);assert.deepEqual(definitions,[words[0]]);
 click('toggle');click('play');t.mock.timers.tick(499);assert.equal(saved.at(-1).wordIndex,0);
 t.mock.timers.tick(1);assert.equal(saved.at(-1).wordIndex,1);
 t.mock.timers.tick(999);assert.equal(saved.at(-1).wordIndex,1);
 t.mock.timers.tick(1);assert.equal(saved.at(-1).wordIndex,2);
 assert.equal(words[2].getBoundingClientRect().top+10,82); // chapter start stays at its natural top
 click('play');touch('pointerdown',1);t.mock.timers.tick(2999);assert.equal(saved.at(-1).wordIndex,2);
 t.mock.timers.tick(1);touch('pointerup',1);assert.equal(saved.at(-1).wordIndex,1);
 click('toggle');assert.equal(saved.at(-1).wordIndex,0);assert.equal(saved.at(-1).offset,0);
 dispose();
});
