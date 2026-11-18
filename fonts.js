// Cíyán v0.6.8: any combination of fonts can be enabled simultaneously.
// A checkbox list replaces the old difficulty/choice controls. No selection
// changes the active font until Apply validates and commits the entire set.
import {verifyImportedFontSelection,clearFontValidationCache} from './font-library.js';

// Legacy levels remain for migrating v0.6.5–v0.6.7 backups and to group the
// checkboxes, but "Mixed" is no longer a selectable option in the app.
export const FONT_LEVELS=Object.freeze({
 beginner:[['print','iPhone default · Clean print']],
 intermediate:[['xiaowei','xiaowei · 站酷小薇 LOGO 体'],['kuaile','HappyZcool-2016 · 站酷快乐体']],
 advanced:[['zhushi','YRDZST · 杨任东竹石体'],['mashan','Ma Shan Zheng']],
 expert:[['muyao','Muyao-Softbrush'],['zhimang','Zhi Mang Xing']]
});
export const FONT_CATALOG=Object.freeze({
 xiaowei:{face:'CiyanXiaoWei',aliases:['xiaowei','ZCOOL XiaoWei','ZCOOLXiaoWei-Regular','站酷小薇LOGO体','站酷小薇 LOGO 体']},
 kuaile:{face:'CiyanKuaiLe',aliases:['HappyZcool-2016','ZCOOL KuaiLe','ZCOOLKuaiLe-Regular','站酷快乐体']},
 zhushi:{face:'CiyanZhuShi',aliases:['YRDZST','杨任东竹石体','YangRenDongZhuShi','YangRenDongZhuShiTi','Yang Ren Dong Zhu Shi']},
 mashan:{face:'CiyanMaShan',aliases:['Ma Shan Zheng','MaShanZheng-Regular','MaShanZheng']},
 muyao:{face:'CiyanMuYao',aliases:['Muyao-Softbrush','沐瑶软笔手写体','Muyao Softbrush','MuyaoSoftbrush']},
 zhimang:{face:'CiyanZhiMang',aliases:['Zhi Mang Xing','ZhiMangXing-Regular','ZhiMangXing']}
});
export const FONT_IDS=Object.freeze(['print',...Object.keys(FONT_CATALOG)]);
// 1.0 is the size of the containing learning text. These conservative
// starting compensations reflect approximate visible glyph proportions;
// actual iPhone rendering can be tuned independently for each face.
export const DEFAULT_FONT_SCALES=Object.freeze({
 print:1.00,xiaowei:1.05,kuaile:0.98,zhushi:1.04,
 mashan:1.08,muyao:1.03,zhimang:1.10
});
export const FONT_SCALE_MIN=0.65,FONT_SCALE_MAX=1.60;
export const MASTER_SCALE_MIN=0.70,MASTER_SCALE_MAX=1.60;
const finiteScale=(value,defaultValue,min,max)=>{
 const n=Number(value);
 return value!==null&&value!==undefined&&value!==''&&Number.isFinite(n)
  ?Math.min(max,Math.max(min,Math.round(n*100)/100)):defaultValue;
};
export function normalizeFontSizing(settings){
 const raw=settings?.fontScales;
 return {
  fontMasterScale:finiteScale(settings?.fontMasterScale,1.00,MASTER_SCALE_MIN,MASTER_SCALE_MAX),
  fontScales:Object.fromEntries(FONT_IDS.map(id=>[
   id,finiteScale(raw&&Object.hasOwn(raw,id)?raw[id]:undefined,DEFAULT_FONT_SCALES[id],FONT_SCALE_MIN,FONT_SCALE_MAX)
  ]))
 };
}
export function normalizeTypographySettings(settings){return {...normalizeFontSettings(settings),...normalizeFontSizing(settings)};}
export function fontScaleFor(settings,id){const sizes=normalizeFontSizing(settings);return sizes.fontMasterScale*sizes.fontScales[id];}

export function fontChoices(level){return FONT_LEVELS[level]||FONT_LEVELS.beginner;}
export function fontFace(id){return FONT_CATALOG[id]?.face||'CiyanPrint';}
// A legacy setting can name a single font or an old within-level Mixed choice.
// Once enabledFonts is present, it is authoritative (even if empty).
export function normalizeFontSettings(settings){
 if(Array.isArray(settings?.enabledFonts)){
  const enabledFonts=[...new Set(settings.enabledFonts.filter(id=>typeof id==='string'&&FONT_IDS.includes(id)))];
  return {enabledFonts};
 }
 const level=Object.hasOwn(FONT_LEVELS,settings?.fontDifficulty)?settings.fontDifficulty:'beginner';
 const choice=settings?.fontChoice;
 if(level==='beginner')return {enabledFonts:['print']};
 if(choice==='mixed')return {enabledFonts:FONT_LEVELS[level].map(([id])=>id)};
 return {enabledFonts:[FONT_LEVELS[level].some(([id])=>id===choice)?choice:FONT_LEVELS[level][0][0]]};
}
export function selectedFonts(settings){const value=normalizeFontSettings(settings).enabledFonts;return value.length?value:['print'];}
export function requiredFonts(settings){return selectedFonts(settings).filter(id=>id!=='print');}
export function fontSources(id){return FONT_CATALOG[id]?.aliases.map(alias=>`local(${JSON.stringify(alias)})`).join(',')||'';}
export async function verifyFontSelection(settings,environment=globalThis){return verifyImportedFontSelection(requiredFonts(settings),environment);}
export function clearFontProbeCache(){clearFontValidationCache();}
// Backwards-compatible utility used by older tests; v0.6.8 never uses it to
// select actual character fonts. Glyph mixing is occurrence-based instead.
export function mixIndex(cp){let n=Math.imul(cp^0x9e3779b9,0x85ebca6b);n=Math.imul(n^(n>>>16),0xc2b2ae35);return ((n^(n>>>16))>>>0)%2;}
export function mixedFace(text,index,level){const options=fontChoices(level).map(([id])=>id);return options[mixIndex(String(text).codePointAt(index)||0)%options.length];}

export function pickOccurrenceFont(fonts,rng=Math.random){
 if(!fonts?.length)return 'print';
 const n=Number(rng());const r=Number.isFinite(n)?Math.min(0.999999999999,Math.max(0,n)):0;
 return fonts[Math.floor(r*fonts.length)];
}
const HAN=/\p{Script=Han}/u;
const SKIP_ELEMENTS=new Set(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT','SELECT','OPTION','SVG','CANVAS','CODE','PRE','IFRAME']);
// Font *size* adjustments are limited to Chinese learning text, never to
// menus, navigation, action buttons, labels, grades, or statistics controls.
// Learning-content buttons such as grammar word tiles are intentionally listed.
const LEARNING_SELECTOR=[
 '#reader-pages article p','.review-hanzi','.tone-char','.list-hanzi','.grammar-preview',
 '.grammar-detail-hanzi','.printed-character','.grammar-sentence',
 '.sentence-slot','.bank-tile','.particle-line','.vocab-example strong',
 '.context-card strong','.font-sample-chinese','.font-sample p',
 '.drawing-grade-character','.notice p','.drawing-context','.synonym-word','.drawing-prompt h2',
 '.detail-hero .review-hanzi','.grammar-puzzle h2'
].join(',');
export function isLearningFontText(element){
 for(let el=element;el;el=el.parentElement){
  if(el.matches?.(LEARNING_SELECTOR))return true;
 }
 return false;
}
// Adjacent characters randomly assigned the same face are kept in one span.
// Each Hanzi occurrence is sampled independently; identical code points may
// therefore have different faces and scales.
export function mixTextNode(node,fonts,rng=Math.random,settings={}){
 const value=node?.nodeValue||'';
 if(!HAN.test(value)||!node.parentNode?.replaceChild)return false;
 const doc=node.ownerDocument;
 if(!doc?.createDocumentFragment||!doc?.createElement||!doc?.createTextNode)return false;
 const scalable=isLearningFontText(node.parentElement);
 const sizes=normalizeFontSizing(settings),scale=id=>sizes.fontMasterScale*sizes.fontScales[id];
 const fragment=doc.createDocumentFragment();
 let buffer='',active=null,spans=0;
 const flush=()=>{
  if(!buffer)return;
  if(active===null)fragment.appendChild(doc.createTextNode(buffer));
  else{
   const span=doc.createElement('span');span.className='ciyan-mixed-glyph';span.dataset.ciyanGlyph='1';
   span.style.fontFamily=fontFace(active)==='CiyanPrint'?'"PingFang SC",-apple-system,sans-serif':`"${fontFace(active)}","PingFang SC",sans-serif`;
   // em is relative to the *existing* contextual size. Pinyin and labels
   // remain unchanged even when embedded next to Chinese text.
   if(scalable&&Math.abs(scale(active)-1)>0.00001)span.style.fontSize=`${Number(scale(active).toFixed(4))}em`;
   span.appendChild(doc.createTextNode(buffer));fragment.appendChild(span);spans++;
  }
  buffer='';
 };
 for(const cp of value){
  const family=HAN.test(cp)?pickOccurrenceFont(fonts,rng):null;
  if(family!==active)flush();
  active=family;buffer+=cp;
 }
 flush();node.parentNode.replaceChild(fragment,node);
 return spans>0;
}
export function mixChineseText(root,fonts,rng=Math.random,settings={}){
 const doc=root?.ownerDocument||globalThis.document;
 if(!doc?.createTreeWalker)return 0;
 const sizes=normalizeFontSizing(settings);
 const single=fonts.length===1;
 if(single&&fonts[0]==='print'&&Math.abs(sizes.fontMasterScale*sizes.fontScales[fonts[0]]-1)<0.00001)return 0;
 const walker=doc.createTreeWalker(root,4); // NodeFilter.SHOW_TEXT
 const nodes=[];let node;
 while((node=walker.nextNode())){
  if(!HAN.test(node.nodeValue||''))continue;
  let excluded=false;
  for(let el=node.parentElement;el;el=el.parentElement){
   if(SKIP_ELEMENTS.has(el.tagName)||el.isContentEditable||el.dataset?.ciyanGlyph==='1'){excluded=true;break;}
   if(el===root)break;
  }
  if(!excluded&&isLearningFontText(node.parentElement))nodes.push(node);
 }
 let changed=0;
 for(const textNode of nodes)changed+=Number(mixTextNode(textNode,fonts,rng,settings));
 return changed;
}
export function applyFontToRoot(root,settings,rng=Math.random){
 if(!root?.style)return;
 const fonts=selectedFonts(settings);
 root.style.setProperty('--ciyan-zh-font',JSON.stringify(fonts.length===1?fontFace(fonts[0]):'CiyanPrint'));
 root.dataset.fontSelection=fonts.join(',');
 const sizes=normalizeFontSizing(settings);
 root.dataset.fontMasterScale=String(sizes.fontMasterScale);
 if(fonts[0]!=='print'||fonts.length>1||Math.abs(fontScaleFor(settings,fonts[0])-1)>0.00001)mixChineseText(root,fonts,rng,settings);
}
