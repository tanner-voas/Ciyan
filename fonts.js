// Cíyán v0.6.7: exact iOS installed-font aliases; explicit opt-in Chinese fonts seen in the supplied screenshots.
// These names refer to *locally installed* fonts; no copyrighted binaries are
// distributed. Browser support for installed iOS fonts varies, so a successful
// load probe is required before saving a selected font.
export const FONT_LEVELS=Object.freeze({
 beginner:[['print','iPhone default · Clean print']],
 intermediate:[['xiaowei','xiaowei · 站酷小薇 LOGO 体'],['kuaile','HappyZcool-2016 · 站酷快乐体'],['mixed','Mixed · Intermediate']],
 advanced:[['zhushi','YRDZST · 杨任东竹石体'],['mashan','Ma Shan Zheng'],['mixed','Mixed · Advanced']],
 expert:[['muyao','Muyao-Softbrush'],['zhimang','Zhi Mang Xing'],['mixed','Mixed · Expert']]
});
// Use several postscript/full family aliases, because installed-font apps
// sometimes expose Chinese and English family names differently.
export const FONT_CATALOG=Object.freeze({
 xiaowei:{face:'CiyanXiaoWei',aliases:['xiaowei','ZCOOL XiaoWei','ZCOOLXiaoWei-Regular','站酷小薇LOGO体','站酷小薇 LOGO 体']},
 kuaile:{face:'CiyanKuaiLe',aliases:['HappyZcool-2016','ZCOOL KuaiLe','ZCOOLKuaiLe-Regular','站酷快乐体']},
 zhushi:{face:'CiyanZhuShi',aliases:['YRDZST','杨任东竹石体','YangRenDongZhuShi','YangRenDongZhuShiTi','Yang Ren Dong Zhu Shi']},
 mashan:{face:'CiyanMaShan',aliases:['Ma Shan Zheng','MaShanZheng-Regular','MaShanZheng']},
 muyao:{face:'CiyanMuYao',aliases:['Muyao-Softbrush','沐瑶软笔手写体','Muyao Softbrush','MuyaoSoftbrush']},
 zhimang:{face:'CiyanZhiMang',aliases:['Zhi Mang Xing','ZhiMangXing-Regular','ZhiMangXing']}
});
export const FONT_LEVEL_FACES=Object.freeze({intermediate:'CiyanMixedIntermediate',advanced:'CiyanMixedAdvanced',expert:'CiyanMixedExpert'});
export function fontChoices(level){return FONT_LEVELS[level]||FONT_LEVELS.beginner;}
export function fontFace(id){return FONT_CATALOG[id]?.face||'CiyanPrint';}
export function normalizeFontSettings(settings){
 const fontDifficulty=Object.hasOwn(FONT_LEVELS,settings?.fontDifficulty)?settings.fontDifficulty:'beginner';
 const options=fontChoices(fontDifficulty).map(([id])=>id);
 const fontChoice=options.includes(settings?.fontChoice)?settings.fontChoice:options[0];
 return {fontDifficulty,fontChoice};
}
export function requiredFonts(settings){
 const {fontDifficulty,fontChoice}=normalizeFontSettings(settings);
 if(fontDifficulty==='beginner')return [];
 return fontChoice==='mixed'?fontChoices(fontDifficulty).map(([id])=>id).filter(id=>id!=='mixed'):[fontChoice];
}
export function fontSources(id){return FONT_CATALOG[id]?.aliases.map(alias=>`local(${JSON.stringify(alias)})`).join(',')||'';}
// FontFace.load() is a genuine load check, unlike document.fonts.check(),
// which returns true for undeclared families that merely fall back to system.
// The probe does not accept substituted fonts or invisible fallback faces.
const validated=new Map();
export async function verifyFontSelection(settings,environment=globalThis){
 const required=requiredFonts(settings);
 if(!required.length)return {ok:true,missing:[]};
 if(typeof environment.FontFace!=='function'||!environment.document?.fonts)return {ok:false,missing:required,reason:'Font loading is not supported by this browser.'};
 const missing=[];
 for(const id of required){
  const data=FONT_CATALOG[id];
  if(!validated.has(id)){
   const result=(async()=>{try{
    const font=new environment.FontFace(`CiyanAvailability_${id}`,fontSources(id),{unicodeRange:'U+4E00-9FFF'});
    await font.load();
    return font.status==='loaded';
   }catch{return false;}})();
   validated.set(id,result);
  }
  if(!await validated.get(id))missing.push(id);
 }
 return missing.length?{ok:false,missing,reason:'The selected font is not available to Safari. Install it and reopen Cíyán before selecting it.'}:{ok:true,missing:[]};
}
export function clearFontProbeCache(){validated.clear();}
// A deterministic hash for predictable per-character selection. In v0.6.6
// mixed styles are selected via unicode-range CSS, not character-span DOM
// wrapping (previously expensive for thousands of characters).
export function mixedFace(text,index,level){
 const options=requiredFonts({fontDifficulty:level,fontChoice:'mixed'});
 if(!options.length)return 'print';
 const cp=String(text).codePointAt(index)||0;
 let n=Math.imul(cp^0x9e3779b9,0x85ebca6b);
 n=Math.imul((n^(n>>>16)),0xc2b2ae35);
 return options[((n^(n>>>16))>>>0)%options.length];
}
export function mixIndex(cp){let n=Math.imul(cp^0x9e3779b9,0x85ebca6b);n=Math.imul(n^(n>>>16),0xc2b2ae35);return ((n^(n>>>16))>>>0)%2;}
export function applyFontToRoot(root,settings){
 if(!root?.style)return;
 const {fontDifficulty,fontChoice}=normalizeFontSettings(settings);
 const family=fontChoice==='mixed'?FONT_LEVEL_FACES[fontDifficulty]:fontFace(fontChoice);
 root.style.setProperty('--ciyan-zh-font',JSON.stringify(family||'CiyanPrint'));
 root.dataset.fontLevel=fontDifficulty;root.dataset.fontChoice=fontChoice;
 // No DOM character wrapping: Unicode ranges make mixing a CSS-only operation.
}
