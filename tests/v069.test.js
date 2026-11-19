import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_FONT_SCALES,FONT_IDS,normalizeFontSizing,normalizeTypographySettings,
  fontScaleFor,mixTextNode,applyFontToRoot,isLearningFontText,selectedFonts} from '../fonts.js';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';
import {defaultState,migrateState,makeBackup,parseBackup} from '../storage.js';

function fakeDOM(){
 const doc={};
 doc.createTextNode=v=>({nodeType:3,nodeValue:v,ownerDocument:doc});
 doc.createElement=tag=>({tagName:tag.toUpperCase(),dataset:{},style:{},children:[],appendChild(n){this.children.push(n);n.parentElement=this;},ownerDocument:doc});
 doc.createDocumentFragment=()=>({children:[],appendChild(n){this.children.push(n);}});
 return {doc,host:{replaceChild(fragment){this.fragment=fragment;}}};
}
test('v0.6.9 has one master scaler and seven independently tuned default font sizes',()=>{
 assert.equal(APP_VERSION,'0.7.8');
 assert.equal(Object.keys(DEFAULT_FONT_SCALES).length,7);
 assert.equal(DEFAULT_FONT_SCALES.print,1);
 assert.ok(FONT_IDS.some(id=>id!=='print'&&DEFAULT_FONT_SCALES[id]!==1));
 const s=normalizeFontSizing({});assert.equal(s.fontMasterScale,1);
 for(const id of FONT_IDS)assert.equal(s.fontScales[id],DEFAULT_FONT_SCALES[id]);
 assert.equal(fontScaleFor({enabledFonts:['print'],fontMasterScale:1.25,fontScales:{print:1.1}},'print'),1.375);
});
test('scalers are finite, bounded and preserve unchecked font calibration',()=>{
 const settings=normalizeTypographySettings({enabledFonts:[],fontMasterScale:'1.23',fontScales:{print:0.9,muyao:1.34,mashan:9,xiaowei:0,zhushi:'bad',fake:1.1}});
 assert.deepEqual(selectedFonts(settings),['print']);
 assert.equal(settings.fontMasterScale,1.23);
 assert.equal(settings.fontScales.print,0.9);
 assert.equal(settings.fontScales.muyao,1.34);
 assert.equal(settings.fontScales.mashan,1.6);
 assert.equal(settings.fontScales.xiaowei,0.65);
 assert.equal(settings.fontScales.zhushi,DEFAULT_FONT_SCALES.zhushi);
 assert.ok(!Object.hasOwn(settings.fontScales,'fake'));
 const normalized=normalizeTypographySettings(settings);assert.deepEqual(normalized,settings);
});
test('mixed characters each receive their own family-specific multiplier times the master; punctuation stays unchanged',()=>{
 const {doc,host}=fakeDOM();const parent={tagName:'DIV',dataset:{},matches:s=>s.includes('.review-hanzi')};
 const node=doc.createTextNode('子子子，AB 子');node.parentNode=host;node.parentElement=parent;
 const options=['print','xiaowei','zhimang'];const seq=[0,0.5,.99,.5];let i=0;
 const settings={enabledFonts:options,fontMasterScale:1.2,fontScales:{print:1,xiaowei:1.05,zhimang:1.1}};
 assert.equal(mixTextNode(node,options,()=>seq[i++],settings),true);
 const spans=host.fragment.children.filter(x=>x.tagName==='SPAN');
 assert.deepEqual(spans.map(x=>x.children[0].nodeValue),['子','子','子','子']);
 assert.deepEqual(spans.map(x=>x.style.fontSize),['1.2em','1.26em','1.32em','1.26em']);
 assert.equal(host.fragment.children.map(x=>x.tagName==='SPAN'?x.children[0].nodeValue:x.nodeValue).join(''),'子子子，AB 子');
});
test('font sizing leaves UI labels and control text alone',()=>{
 const {doc,host}=fakeDOM();const ui={tagName:'DIV',dataset:{},matches:()=>false,parentElement:null};
 const node=doc.createTextNode('设置 中文');node.parentNode=host;node.parentElement=ui;
 assert.equal(isLearningFontText(ui),false);
 mixTextNode(node,['print'],()=>0,{enabledFonts:['print'],fontMasterScale:1.5});
 assert.ok(host.fragment.children.filter(x=>x.tagName==='SPAN').every(x=>!x.style.fontSize));
 const educational={tagName:'DIV',dataset:{},matches:q=>q.includes('.grammar-detail-hanzi'),parentElement:ui};
 assert.equal(isLearningFontText(educational),true);
 const child=doc.createTextNode('汉字');child.parentNode=host;child.parentElement=educational;
 mixTextNode(child,['mashan'],()=>0,{enabledFonts:['mashan'],fontMasterScale:1.2,fontScales:{mashan:1.1}});
 assert.equal(host.fragment.children[0].style.fontSize,'1.32em');
});
test('single-font display keeps CSS-only fast path when its effective scale equals 1',()=>{
 const root={style:{values:{},setProperty(k,v){this.values[k]=v;}},dataset:{}};
 applyFontToRoot(root,{enabledFonts:['print'],fontMasterScale:1,fontScales:{print:1}});
 assert.equal(root.dataset.fontMasterScale,'1');assert.equal(root.dataset.fontSelection,'print');
 assert.match(root.style.values['--ciyan-zh-font'],/CiyanPrint/);
});
test('full backups preserve checked fonts plus both scaler layers; v0.6.8 restores gain safe defaults',()=>{
 const s=defaultState();s.settings.enabledFonts=['print','mashan'];s.settings.fontMasterScale=1.32;s.settings.fontScales.mashan=0.91;s.settings.fontScales.zhimang=1.2;
 const backup=makeBackup(s),saved=parseBackup(backup);
 assert.equal(saved.settings.fontMasterScale,1.32);assert.equal(saved.settings.fontScales.mashan,0.91);assert.equal(saved.settings.fontScales.zhimang,1.2);
 assert.deepEqual(saved.settings.enabledFonts,['print','mashan']);
 assert.equal(backup.state.settings.fontMasterScale,1.32);
 const older=structuredClone(backup);older.appVersion='0.6.8';older.state.appVersion='0.6.8';
 delete older.state.settings.fontMasterScale;delete older.state.settings.fontScales;
 const migrated=parseBackup(older);assert.deepEqual(migrated.settings.enabledFonts,['print','mashan']);
 assert.equal(migrated.settings.fontMasterScale,1);assert.equal(migrated.settings.fontScales.mashan,DEFAULT_FONT_SCALES.mashan);
 assert.equal(prepareVersionedBackup(older).appVersion,'0.7.8');
});
