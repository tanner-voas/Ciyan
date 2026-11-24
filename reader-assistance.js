export const AID_LABELS=['None','Underline struggles','Word spacing','Struggle pinyin','Struggle pinyin & English','All pinyin','All pinyin & English'];
export function aidLevel(s={}){return Number.isInteger(s.readerAidLevel)?Math.max(0,Math.min(6,s.readerAidLevel)):s.readerHighlight?1:0;}
export function struggleThreshold(s={}){return typeof s.readerStruggleThreshold==='number'&&Number.isFinite(s.readerStruggleThreshold)?Math.round(Math.max(0,Math.min(3,s.readerStruggleThreshold))*10)/10:1.5;}
export const isStruggle=(score,s)=>score<struggleThreshold(s);
export function aidSettings(s,reader=false){
 const controls=[['readerAidLevel','Reading assistance',0,6,1,aidLevel(s),AID_LABELS[aidLevel(s)]],['readerStruggleThreshold','Struggle threshold',0,3,.1,struggleThreshold(s),struggleThreshold(s).toFixed(1)]];
 return controls.map(([key,label,min,max,step,value,display])=>`<label class="reader-aid-control"><span>${label} <output data-aid-output="${key}">${display}</output></span><input type="range" ${reader?`data-reader-aid="${key}"`:`data-setting="${key}"`} min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}"></label>`).join('')+'<small class="subtle">Struggle means score strictly below the threshold. Readiness also counts recent practice.</small>';
}
export function updateAidDisplay(root,s){
 if(!root)return;
 root.dataset.aid=String(aidLevel(s));
 root.classList.toggle('show-weak',aidLevel(s)>0);
 for(const word of root.querySelectorAll('[data-word-index]'))word.classList.toggle('reader-weak',isStruggle(Number(word.dataset.score),s));
}
