import test from 'node:test';
import assert from 'node:assert/strict';
import {FONT_LEVELS,normalizeFontSettings,fontChoices,fontFace,mixedFace} from '../fonts.js';
import {DRAWING_RATINGS,drawingResult,withDrawingRating,ratingGrade} from '../drawing-grades.js';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';
import {defaultState,deleteConfirmationValid,makeBackup,parseBackup,migrateState,clearLearningRecords} from '../storage.js';
import {MASTER} from '../master-data.js';

test('v0.6.5 preserves content and supports identity migration from the v0.6.4 release',()=>{
 assert.equal(APP_VERSION,'0.6.7');assert.equal(MASTER.cards.length,11893);assert.equal(MASTER.grammar.length,3444);
 const old={format:'ciyan-backup',version:2,appVersion:'0.6.3',state:{appVersion:'0.6.3',schemaVersion:2}};
 const migrated=prepareVersionedBackup(old);assert.equal(migrated.appVersion,APP_VERSION);
 assert.deepEqual(migrated.state,old.state);
});
test('four font levels have one beginner choice, with mixed among other level choices',()=>{
 assert.deepEqual(Object.keys(FONT_LEVELS),['beginner','intermediate','advanced','expert']);
 assert.deepEqual(fontChoices('beginner'),[['print','iPhone default · Clean print']]);
 for(const level of ['intermediate','advanced','expert']){
  assert.equal(fontChoices(level).length,3);
  assert.deepEqual(fontChoices(level).map(([id])=>id).at(-1),'mixed');
  for(const [id] of fontChoices(level).filter(([id])=>id!=='mixed'))assert.ok(fontFace(id).startsWith('Ciyan'));
 }
 assert.deepEqual(normalizeFontSettings({fontDifficulty:'beginner',fontChoice:'mixed'}),{fontDifficulty:'beginner',fontChoice:'print'});
 assert.deepEqual(normalizeFontSettings({fontDifficulty:'nonsense',fontChoice:'nonsense'}),{fontDifficulty:'beginner',fontChoice:'print'});
 assert.deepEqual(normalizeFontSettings({fontDifficulty:'expert',fontChoice:'mixed'}),{fontDifficulty:'expert',fontChoice:'mixed'});
});
test('mixed font selection is stable and varied by character position within the chosen level',()=>{
 const text='热情细雨山川明月江南窗外天空';
 for(const level of ['intermediate','advanced','expert']){
  const pool=fontChoices(level).map(([id])=>id).filter(id=>id!=='mixed');
  const samples=[...text].map((_,i)=>mixedFace(text,i,level));
  assert.ok(samples.every(x=>pool.includes(x)));
  assert.ok(new Set(samples).size>1,level);
  assert.deepEqual(samples,[...text].map((_,i)=>mixedFace(text,i,level)));
 }
});
test('drawing grade is the minimum per-character grade; all character ratings are recorded exactly once',()=>{
 assert.deepEqual(DRAWING_RATINGS.map(x=>x.grade),[1,2,3,4]);
 assert.deepEqual(DRAWING_RATINGS.map(x=>x.key),['forgotten','difficult','recalled','easy']);
 assert.equal(ratingGrade('unrated'),null);
 let r=withDrawingRating({},0,'easy',3);
 assert.equal(drawingResult('热情高',r),null);
 r=withDrawingRating(r,1,'difficult',3);
 assert.equal(drawingResult('热情高',r),null);
 r=withDrawingRating(r,2,'recalled',3);
 assert.deepEqual(drawingResult('热情高',r),{
  grade:2,characters:[
   {character:'热',rating:'easy',grade:4},
   {character:'情',rating:'difficult',grade:2},
   {character:'高',rating:'recalled',grade:3}
  ]
 });
 assert.equal(withDrawingRating(r,3,'easy',3),null);
 assert.equal(withDrawingRating(r,1,'unknown',3),null);
 const single=withDrawingRating({},0,'easy',1);
 assert.equal(drawingResult('热',single).grade,4);
});
test('case-insensitive delete confirmation has no effect on records until confirmed',()=>{
 for(const value of ['delete','Delete','DELETE','dElete',' delete ','  DeLeTe\n'])assert.equal(deleteConfirmationValid(value),true);
 for(const value of ['delete now','deleted','del','',undefined,null])assert.equal(deleteConfirmationValid(value),false);
 const s=defaultState();s.settings.fontDifficulty='advanced';s.settings.fontChoice='mixed';
 const keep=structuredClone(s.cards);
 s.history.push({cardId:s.cards[0].id,grade:2,at:'2026-11-18T03:00:00.000Z'});
 clearLearningRecords(s);
 assert.deepEqual(s.cards,keep);assert.equal(s.history.length,0);
 assert.equal(s.settings.fontDifficulty,'advanced');assert.equal(s.settings.fontChoice,'mixed');
});
test('font difficulty and choice are preserved in full progress backups and older restores migrate safely',()=>{
 const state=defaultState();state.settings.fontDifficulty='expert';state.settings.fontChoice='mixed';
 const full=makeBackup(state);const restored=parseBackup(full);
 assert.deepEqual([restored.settings.fontDifficulty,restored.settings.fontChoice],['expert','mixed']);
 const older=structuredClone(full);older.appVersion='0.6.3';older.state.appVersion='0.6.3';
 delete older.state.settings.fontDifficulty;delete older.state.settings.fontChoice;
 assert.deepEqual(normalizeFontSettings(parseBackup(older).settings),{fontDifficulty:'beginner',fontChoice:'print'});
 const malformed=migrateState({...state,settings:{...state.settings,fontDifficulty:'bad',fontChoice:'bad'}});
 assert.equal(malformed.settings.fontDifficulty,'beginner');assert.equal(malformed.settings.fontChoice,'print');
});
