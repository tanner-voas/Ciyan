import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FONT_IDS,FONT_CATALOG,selectedFonts,normalizeFontSettings,requiredFonts,pickOccurrenceFont,mixTextNode,mixChineseText,applyFontToRoot} from '../fonts.js';
import {compileImportedFontCSS} from '../font-library.js';
import {APP_VERSION} from '../backup-versions.js';
import {defaultState,makeBackup,parseBackup} from '../storage.js';

function fakeDocument(){
 const doc={};
 doc.createTextNode=value=>({nodeType:3,nodeValue:value,ownerDocument:doc,parentNode:null,parentElement:null});
 doc.createElement=tag=>({tagName:tag.toUpperCase(),className:'',dataset:{},style:{},children:[],appendChild(child){this.children.push(child);child.parentNode=this;child.parentElement=this;},ownerDocument:doc});
 doc.createDocumentFragment=()=>({children:[],appendChild(child){this.children.push(child);child.parentNode=this;},ownerDocument:doc});
 doc.makeHost=()=>({replaced:null,replaceChild(replacement,_node){this.replaced=replacement;}});
 return doc;
}
test('v0.6.8 has exactly seven independent selectable fonts, including the standard iPhone font',()=>{
 assert.equal(APP_VERSION,'0.8.5');
 assert.deepEqual(FONT_IDS,['print','xiaowei','kuaile','zhushi','mashan','muyao','zhimang']);
 assert.equal(Object.keys(FONT_CATALOG).length,6);
 assert.deepEqual(normalizeFontSettings({enabledFonts:[]}),{enabledFonts:[]});
 assert.deepEqual(selectedFonts({enabledFonts:[]}),['print']);
 assert.deepEqual(requiredFonts({enabledFonts:[]}),[]);
 assert.deepEqual(requiredFonts({enabledFonts:['mashan','print','zhimang']}),['mashan','zhimang']);
 assert.deepEqual(normalizeFontSettings({enabledFonts:['mashan','mashan','print','bad',123]}),{enabledFonts:['mashan','print']});
});
test('legacy dropdown choices migrate to independent checked IDs; mixed is never a new selectable value',()=>{
 assert.deepEqual(normalizeFontSettings({fontDifficulty:'expert',fontChoice:'mixed'}),{enabledFonts:['muyao','zhimang']});
 assert.deepEqual(normalizeFontSettings({fontDifficulty:'intermediate',fontChoice:'kuaile'}),{enabledFonts:['kuaile']});
 assert.deepEqual(normalizeFontSettings({fontDifficulty:'beginner',fontChoice:'print'}),{enabledFonts:['print']});
 assert.deepEqual(normalizeFontSettings({enabledFonts:[],fontDifficulty:'advanced',fontChoice:'mixed'}),{enabledFonts:[]});
 const old=makeBackup(defaultState());old.appVersion='0.6.7';old.state.appVersion='0.6.7';
 delete old.state.settings.enabledFonts;old.state.settings.fontDifficulty='advanced';old.state.settings.fontChoice='mixed';
 assert.deepEqual(parseBackup(old).settings.enabledFonts,['zhushi','mashan']);
});
test('three identical Hanzi occurrences can use three distinct choices',()=>{
 const pool=['print','xiaowei','zhimang'];
 const picks=[0.01,0.5,0.99];let i=0;
 assert.deepEqual([...('子子子')].map(()=>pickOccurrenceFont(pool,()=>picks[i++])),pool);
});
test('DOM runs choose fonts per occurrence, preserve original text and group adjacent equal styles',()=>{
 const doc=fakeDocument(),host=doc.makeHost(),node=doc.createTextNode('子子子, ABC 子子');
 node.parentNode=host;node.parentElement={tagName:'P',isContentEditable:false,dataset:{}};
 const options=['print','xiaowei','zhimang'];const sequence=[0,0.5,0.999,0.5,0.5],fonts=[];let i=0;
 assert.equal(mixTextNode(node,options,()=>{const r=sequence[i++];return r;}),true);
 const fragment=host.replaced;assert.ok(fragment);
 const spans=fragment.children.filter(x=>x.tagName==='SPAN');
 assert.deepEqual(spans.map(x=>x.children[0].nodeValue),['子','子','子','子子']);
 assert.match(spans[0].style.fontFamily,/PingFang SC/);
 assert.match(spans[1].style.fontFamily,/CiyanXiaoWei/);
 assert.match(spans[2].style.fontFamily,/CiyanZhiMang/);
 assert.match(spans[3].style.fontFamily,/CiyanXiaoWei/);
 const reconstruct=fragment.children.map(x=>x.tagName==='SPAN'?x.children[0].nodeValue:x.nodeValue).join('');
 assert.equal(reconstruct,'子子子, ABC 子子');
});
test('same-font selection stays CSS-only; mixed mode uses a walker when browser supports DOM',()=>{
 const root={style:{props:{},setProperty(k,v){this.props[k]=v;}},dataset:{}};
 applyFontToRoot(root,{enabledFonts:['print']});assert.equal(root.dataset.fontSelection,'print');
 assert.equal(root.style.props['--ciyan-zh-font'],'"CiyanPrint"');
 applyFontToRoot(root,{enabledFonts:[]});assert.equal(root.dataset.fontSelection,'print');
 applyFontToRoot(root,{enabledFonts:['zhushi']});assert.equal(root.style.props['--ciyan-zh-font'],'"CiyanZhuShi"');
 // No treeWalker available in this minimal fake, and no accidental error.
 applyFontToRoot(root,{enabledFonts:['print','muyao','mashan']});assert.equal(root.dataset.fontSelection,'print,muyao,mashan');
});
test('font CSS is only one rule per web font, with no codepoint-based font mixing or template download',()=>{
 const css=compileImportedFontCSS('unused',new Map([['mashan',{name:'ma.woff2',url:'blob:mashan'}],['zhushi',{name:'zhu.ttf',url:'blob:zhushi'}]]));
 assert.match(css,/CiyanMaShan/);assert.match(css,/CiyanZhuShi/);assert.doesNotMatch(css,/CiyanMixed/);
 assert.doesNotMatch(css,/unicode-range/);
 assert.equal((css.match(/@font-face/g)||[]).length,2);
 const manifest=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const packagePy=fs.readFileSync(new URL('../package.py',import.meta.url),'utf8');
 assert.doesNotMatch(manifest,/mixed-fonts\.css/);assert.doesNotMatch(packagePy,/mixed-fonts\.css/);
});
test('v0.6.8 saves all selected IDs in a normal full backup and never adds font bytes',()=>{
 const s=defaultState();s.settings.enabledFonts=['print','xiaowei','mashan','muyao'];
 const backup=makeBackup(s),parsed=parseBackup(backup);
 assert.deepEqual(parsed.settings.enabledFonts,s.settings.enabledFonts);
 assert.doesNotMatch(JSON.stringify(backup.settings??{}),/font.*bytes/i);
});
