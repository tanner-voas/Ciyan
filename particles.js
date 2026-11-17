// Authored contrast tests; never infer a unique grammatical answer from raw text.
// slot is a zero-based gap in base tokens; multiple accepted pairs are supported.
import {EXTRA_PARTICLES} from './particle-content.js';
export const OMIT='∅';
export const particleLabel=c=>c===OMIT?'No particle':c;
export const particleWords=p=>[...new Set([...p.base,...p.choices].filter(w=>w!==OMIT))];
export const particleFamily=p=>p.family||(['次','个','本'].includes(p.focus.split(' · ')[0])?'Classifiers':p.focus.split(' · ')[0]);
export const PARTICLES=[
 ['le-complete','了 · completed action',['我','昨天','买','一','本','书'],'I bought one book yesterday. Mark the buying event as completed immediately after 买.',['了','的','得'],[['了',3]],'了 after 买 marks the event as completed. It is not a general past-tense suffix.','Wǒ zuótiān mǎi le yì běn shū.'],
 ['le-change','了 · new situation',['现在','不','下雨'],'It is not raining anymore. Add a sentence-final particle to signal the changed situation.',['了','过','的'],[['了',3]],'Sentence-final 了 marks a new situation: it was raining, and now it is not.','Xiànzài bù xiàyǔ le.'],
 ['le-too','了 · 太…了',['这','个','太','贵'],'This is too expensive! Complete the 太… pattern.',['了','得','地'],[['了',4]],'太贵了 expresses an evaluation or exclamation. This 了 does not mean past tense.','Zhè ge tài guì le.'],
 ['de-owner','的 · possession',['这','是','我','书'],'This is my book. Link 我 to the noun 书.',['的','得','地'],[['的',3]],'的 links the possessor 我 to the noun 书: 我的书.','Zhè shì wǒ de shū.'],
 ['de-complement','得 · degree complement',['她','跑','很','快'],'She runs very fast. Link the verb 跑 to the degree description 很快.',['得','的','地'],[['得',2]],'得 follows a verb and introduces a description of how well or to what degree the action is done.','Tā pǎo de hěn kuài.'],
 ['de-adverb','地 · manner',['他','认真','工作'],'He works conscientiously. Use an explicit manner marker between 认真 and 工作.',['地','得','的'],[['地',2]],'地 links the manner description 认真 to the following verb 工作. In some contexts it can be omitted; this exercise explicitly requests the marker.','Tā rènzhēn de gōngzuò.'],
 ['guo-experience','过 · experience',['我','去','北京'],'I have been to Beijing before. Mark prior experience directly after 去.',['过','的','得'],[['过',2]],'过 after the verb marks experience of doing something. It does not require that the experience is happening now.','Wǒ qù guo Běijīng.'],
 ['ma-question','吗 · yes/no question',['你','有','时间'],'Do you have time? Turn this statement into a neutral yes/no question.',['吗','呢','的'],[['吗',3]],'吗 is placed at the end of a statement to form a neutral yes/no question.','Nǐ yǒu shíjiān ma?'],
 ['ne-return','呢 · return question',['你'],'I am fine. And you? Add the particle for this short return question.',['呢','吗','了'],[['呢',1]],'你呢 asks the same relevant question about the other person. 你吗 instead asks “you?” in a different context.','Nǐ ne?'],
 ['ci-count','次 · action count',['我','去','过','一'],'I have been once. Finish the expression counting the number of visits.',['次','个','本'],[['次',4]],'次 counts occurrences of an action: 一次 means once. 个 counts entities rather than visits.','Wǒ qù guo yí cì.'],
 ['ge-count','个 · object count',['我','买','了','一','苹果'],'I bought one apple. Supply the ordinary general classifier between 一 and 苹果.',['个','次','本'],[['个',4]],'个 counts apples here; 次 would count times an action occurred.','Wǒ mǎi le yí ge píngguǒ.'],
 ['ben-count','本 · books',['我','有','两','书'],'I have two books. Insert the classifier used for bound books.',['本','个','次'],[['本',3]],'本 is the conventional classifier for books: 两本书.','Wǒ yǒu liǎng běn shū.']
].map(([id,focus,base,prompt,choices,pairs,explanation,pinyin])=>({id:'particle-'+id,focus,base,prompt,choices,accepted:pairs.map(([choice,slot])=>({choice,slot})),explanation,pinyin})).concat(EXTRA_PARTICLES);
export function normalizeParticle(x){
 if(!x||!Array.isArray(x.base)||!x.base.length||x.base.length>35||!Array.isArray(x.choices)||!x.choices.length||x.choices.length>12||!Array.isArray(x.accepted)||!x.accepted.length)throw new Error('Invalid particle exercise');
 const clean=v=>String(v??'').trim().slice(0,900);
 const base=x.base.map(clean),choices=[...new Set(x.choices.map(clean))];
 if([...base,...choices].some(v=>!v)||!clean(x.prompt)||!clean(x.explanation))throw new Error('Particle exercises need tokens, prompt and explanation');
 const accepted=x.accepted.map(a=>({choice:clean(a.choice),slot:a.choice===OMIT?-1:Number(a.slot)}));
 if(accepted.some(a=>!choices.includes(a.choice)||!Number.isInteger(a.slot)||(a.choice===OMIT?a.slot!==-1:a.slot<0||a.slot>base.length)))throw new Error('Invalid particle answer');
 return {id:clean(x.id||crypto.randomUUID()),focus:clean(x.focus||'Particle practice'),family:clean(x.family||''),base,choices,accepted,prompt:clean(x.prompt),explanation:clean(x.explanation),pinyin:clean(x.pinyin)};
}
export const particleCorrect=(test,choice,slot)=>test.accepted.some(a=>a.choice===choice&&(choice===OMIT||a.slot===slot));
export function particleSentence(test,answer=test.accepted[0]){const words=[...test.base];if(answer.choice!==OMIT)words.splice(answer.slot,0,answer.choice);return words.join('');}
export function allParticles(state){return [...PARTICLES,...state.grammar.flatMap(g=>(g.particleTests||[]).map((p,i)=>({...p,id:g.id+':particle:'+i})))];}

export function particleError(test,choice,slot){
 if(particleCorrect(test,choice,slot))return null;
 if(choice===OMIT)return 'omission';
 if(test.accepted.every(a=>a.choice===OMIT))return 'unnecessary';
 return test.accepted.some(a=>a.choice===choice)?'placement':'choice';
}
