// v0.6.5: iOS system Chinese typefaces, with printable fallbacks.
// CSS @font-face local() declarations restrict the face to CJK glyphs so
// Latin interface labels keep their original typography. No network required.
export const FONT_LEVELS=Object.freeze({
 beginner:[['print','Clean print']],
 intermediate:[['song','Songti (serif)'],['kai','Kaiti (regular script)'],['mixed','Mixed · intermediate']],
 advanced:[['pen','HanziPen (handwriting)'],['xing','Xingkai (semi-cursive)'],['mixed','Mixed · advanced']],
 expert:[['wawati','Wawati (freehand)'],['weibei','Weibei (calligraphic)'],['mixed','Mixed · expert']]
});
const FACES={print:'CiyanPrint',song:'CiyanSong',kai:'CiyanKai',pen:'CiyanPen',xing:'CiyanXing',wawati:'CiyanWawati',weibei:'CiyanWeibei'};
export function normalizeFontSettings(settings){
 const difficulty=Object.hasOwn(FONT_LEVELS,settings?.fontDifficulty)?settings.fontDifficulty:'beginner';
 const names=FONT_LEVELS[difficulty].map(([id])=>id);
 const font=names.includes(settings?.fontChoice)?settings.fontChoice:names[0];
 return {fontDifficulty:difficulty,fontChoice:font};
}
export function fontChoices(level){return FONT_LEVELS[level]||FONT_LEVELS.beginner;}
export function fontFace(id){return FACES[id]||FACES.print;}
// Stable per-character mixing avoids a visually distracting reshuffle after
// grading or navigating. Different occurrences/positions can use different faces.
export function mixedFace(text,index,level){
 const options=fontChoices(level).map(([key])=>key).filter(id=>id!=='mixed');
 if(!options.length)return 'print';
 let hash=2166136261;
 for(const ch of String(text)){hash=Math.imul(hash^ch.codePointAt(0),16777619);}
 hash=Math.imul(hash^((index+1)*0x9e3779b1),16777619)>>>0;
 hash=(hash^(hash>>>16))>>>0;
 return options[hash%options.length];
}
export function applyFontToRoot(root,settings){
 if(!root?.style)return;
 const {fontDifficulty,fontChoice}=normalizeFontSettings(settings);
 root.style.setProperty('--ciyan-zh-font',`"${fontFace(fontChoice==='mixed'?'print':fontChoice)}"`);
 root.dataset.fontLevel=fontDifficulty;
 root.dataset.fontChoice=fontChoice;
 if(fontChoice!=='mixed'||typeof document==='undefined'||!document.createTreeWalker||!document.createDocumentFragment)return;
 const nodes=[],walker=document.createTreeWalker(root,globalThis.NodeFilter?.SHOW_TEXT||4);
 for(let node=walker.nextNode();node;node=walker.nextNode()){
  if(!/[\p{Script=Han}]/u.test(node.nodeValue||''))continue;
  const parent=node.parentElement;
  if(!parent||parent.closest?.('.ciyan-mixed-char,textarea,select,option,script,style,[contenteditable="true"]'))continue;
  nodes.push(node);
 }
 for(const node of nodes){
  const content=node.nodeValue,frag=document.createDocumentFragment();let offset=0,buffer='';
  const append=()=>{if(buffer){frag.appendChild(document.createTextNode(buffer));buffer='';}};
  for(const character of content){
   if(/\p{Script=Han}/u.test(character)){
    append();const span=document.createElement('span');
    span.className=`ciyan-mixed-char font-${mixedFace(content,offset,fontDifficulty)}`;
    span.textContent=character;frag.appendChild(span);
   }else buffer+=character;
   offset++;
  }
  append();node.replaceWith(frag);
 }
}
