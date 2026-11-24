import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultState,cloneProgressState,makeBackup} from '../storage.js';
import {createBackupCache,splitBackup} from '../shared/google-drive/src/sync.js';
import {APP_VERSION} from '../backup-versions.js';

const snapshot=state=>{const backup=makeBackup(state);delete backup.state.lastBackupAt;delete backup.state.backedUpRevision;return backup;};
test('normal progress preserves immutable dictionary identity and content edits copy before mutation',async()=>{
 const state=defaultState();state.cards=[{id:'w',hanzi:'字',tags:['a']}];state.grammar=[{id:'g',markup:'字'}];
 const cache=createBackupCache({immutableFields:['cards','grammar']});
 const first=await splitBackup(snapshot(state),{cache});
 const progress=cloneProgressState(state);progress.revision++;
 assert.equal(progress.cards,state.cards);assert.equal(progress.grammar,state.grammar);
 const second=await splitBackup(snapshot(progress),{cache});assert.equal(second.stats.identityReused,2);
 const edit=cloneProgressState(progress,true);edit.cards[0].tags.push('b');
 assert.deepEqual(state.cards[0].tags,['a']);assert.notEqual(edit.cards,progress.cards);
 const changed=await splitBackup(snapshot(edit),{cache});assert.notEqual(changed.sections.cards,first.sections.cards);
 assert.deepEqual(changed.sections,(await splitBackup(snapshot(edit))).sections);
});
test('current version agrees with packaging and backup diagnostics stay in archive menu',()=>{
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(pkg.version,APP_VERSION);
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(source,/Synchronization details/);assert.match(source,/cloudDiagnostics\(\)/);
 assert.match(source,/Payload bytes exclude protocol overhead/);
 const cloud=readFileSync(new URL('../cloud-profiles.js',import.meta.url),'utf8');
 assert.match(cloud,/immutableFields:\['cards','grammar'\]/);
});
test('restart checks pending commit receipt before declaring divergence and diagnostics report phase timings',()=>{
 const cloud=readFileSync(new URL('../cloud-profiles.js',import.meta.url),'utf8');
 assert(cloud.indexOf('reconcilePendingCommit(cursor,remote.head)')<cloud.indexOf('if(cursor?.head&&cursor.head!==remote.head.id)'));
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 for(const metric of ['prepareMs','headMs','preflightMs','uploadMs','commitMs'])assert(source.includes('latest.'+metric));
});
