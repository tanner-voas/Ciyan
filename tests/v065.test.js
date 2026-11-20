import test from 'node:test';
import assert from 'node:assert/strict';
import {FONT_LEVELS,normalizeFontSettings,fontChoices,fontFace,mixedFace} from '../fonts.js';
import {DRAWING_RATINGS,drawingResult,withDrawingRating,ratingGrade} from '../drawing-grades.js';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';
import {defaultState,resetConfirmationValid,makeBackup,parseBackup,migrateState,clearLearningRecords} from '../storage.js';
import {MASTER} from '../master-data.js';

test('v0.6.5 preserves content and supports identity migration from the v0.6.4 release',()=>{
 assert.equal(APP_VERSION,'0.8.13');assert.equal(MASTER.cards.length,12505);assert.equal(MASTER.grammar.length,3444);
 const old={format:'ciyan-backup',version:2,appVersion:'0.6.3',state:{appVersion:'0.6.3',schemaVersion:2}};
 const migrated=prepareVersionedBackup(old);assert.equal(migrated.appVersion,APP_VERSION);
 assert.deepEqual(migrated.state,old.state);
});
test('font list contains seven independent checkbox choices including Beginner',()=>{
 assert.deepEqual(Object.keys(FONT_LEVELS),['beginner','intermediate','advanced','expert']);
 assert.deepEqual(fontChoices('beginner'),[['print','iPhone default · Clean print']]);
 for(const level of ['intermediate','advanced','expert']){
  assert.equal(fontChoices(level).length,2);
  for(const [id] of fontChoices(level))assert.ok(fontFace(id).startsWith('Ciyan'));
 }
 assert.deepEqual(normalizeFontSettings({enabledFonts:[]}),{enabledFonts:[]});
 assert.deepEqual(normalizeFontSettings({enabledFonts:['print','zhushi','print','fake']}),{enabledFonts:['print','zhushi']});
 assert.deepEqual(normalizeFontSettings({fontDifficulty:'expert',fontChoice:'mixed'}),{enabledFonts:['muyao','zhimang']});
 assert.deepEqual(normalizeFontSettings({fontDifficulty:'beginner',fontChoice:'mixed'}),{enabledFonts:['print']});
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
test('case-insensitive reset confirmation has no effect on records until confirmed',()=>{
 for(const value of ['confirm','Confirm','CONFIRM','cOnfirm',' confirm ','  CoNfIrM\n'])assert.equal(resetConfirmationValid(value),true);
 for(const value of ['delete','confirm now','confirmed','',undefined,null])assert.equal(resetConfirmationValid(value),false);
 const s=defaultState();s.settings.enabledFonts=['print','mashan'];
 const keep=structuredClone(s.cards);
 s.history.push({cardId:s.cards[0].id,grade:2,at:'2026-11-18T03:00:00.000Z'});
 clearLearningRecords(s);
 assert.deepEqual(s.cards,keep);assert.equal(s.history.length,0);
 assert.deepEqual(s.settings.enabledFonts,['print','mashan']);
});
test('enabled font checkboxes are backed up and old level/Mixed backups migrate',()=>{
 const state=defaultState();state.settings.enabledFonts=['print','zhushi','muyao'];
 const restored=parseBackup(makeBackup(state));
 assert.deepEqual(restored.settings.enabledFonts,['print','zhushi','muyao']);
 const older=makeBackup(state);older.appVersion='0.6.7';older.state.appVersion='0.6.7';
 delete older.state.settings.enabledFonts;
 older.state.settings.fontDifficulty='expert';older.state.settings.fontChoice='mixed';
 assert.deepEqual(parseBackup(older).settings.enabledFonts,['muyao','zhimang']);
 const malformed=migrateState({...state,settings:{...state.settings,enabledFonts:['unknown','mashan','mashan']}});
 assert.deepEqual(normalizeFontSettings(malformed.settings),{enabledFonts:['mashan']});
});
