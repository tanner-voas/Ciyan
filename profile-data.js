import {mergeRestoredContent} from './backup-restore.js';
import {clearLearningRecords,defaultState} from './storage.js';
import {reloadCards} from './collection-reset.js';
import {replaceMaster} from './master.js';

// All profile imports are isolated. No secret or setting is inherited from the
// previously active profile except the explicitly selected dictionary content.
export function importedProfileState(parsed,current,master,policy){
 const result=structuredClone(parsed);
 if(!['keep','master','strict'].includes(policy))throw Error('Choose a dictionary policy');
 if(policy==='keep')mergeRestoredContent(result,current,{cards:[],grammar:[]});
 if(policy==='master'){
  const oldCards=new Map(result.cards.map(c=>[c.hanzi,c]));
  const oldGrammar=new Map(result.grammar.map(g=>[g.markup,g]));
  const masterCards=master.cards.map(c=>({...structuredClone(c),id:oldCards.get(c.hanzi)?.id||c.id}));
  const masterGrammar=master.grammar.map(g=>({...structuredClone(g),id:oldGrammar.get(g.markup)?.id||g.id}));
  const names=new Set(masterCards.map(c=>c.hanzi)),markups=new Set(masterGrammar.map(g=>g.markup));
  // Records for source-only words remain retrievable, but the words are not
  // active members of the replacement master dictionary.
  const archived=result.archived||{cards:[],grammar:[]};
  result.archived={
   cards:[...archived.cards.filter(c=>!names.has(c.hanzi)),...result.cards.filter(c=>!names.has(c.hanzi))],
   grammar:[...archived.grammar.filter(g=>!markups.has(g.markup)),...result.grammar.filter(g=>!markups.has(g.markup))]
  };
  result.cards=masterCards;result.grammar=masterGrammar;
 }
 result.explicitDictionary=true;
 result.revision=1;result.backedUpRevision=-1;result.lastBackupAt=null;
 return result;
}
export function resetProfileState(d,mode,master){
 if(mode==='records')clearLearningRecords(d);
 else if(mode==='secrets'){
  delete d.speechVault;delete d.deviceKey;
  d.settings.azureRegion='';
 }else if(mode==='settings'){
  d.settings=structuredClone(defaultState().settings);
  delete d.speechVault;delete d.deviceKey;
 }else if(mode==='master')reloadCards(d,master,replaceMaster);
 else if(mode==='clear'){
  const archived=d.archived||{cards:[],grammar:[]};
  d.archived={cards:[...archived.cards,...d.cards],grammar:[...archived.grammar,...d.grammar]};
  d.cards=[];d.grammar=[];d.explicitDictionary=true;
  d.activePractice=null;d.activeSession=null;d.activeGrammarSession=null;
  d.lastPracticeUndo=null;
 }else throw Error('Unknown reset action');
 return d;
}
