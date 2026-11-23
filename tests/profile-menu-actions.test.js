import test from 'node:test';
import assert from 'node:assert/strict';
import {createCiyanProfileActions} from '../profile-menu-actions.js';

test('Ciyan wires real Push, Sync, Fork callbacks and validates local writes first',async()=>{
 const actions=[],state={revision:42};
 const adapter=createCiyanProfileActions({
  readState:()=>state,statusText:()=> 'Local',
  flush:async()=>actions.push('flush'),
  disconnectSync:()=>actions.push('disconnect-sync'),
  pushProfile:async args=>{
   assert.equal(args.name,'HSK3');assert.equal(args.targetId,null);
   assert.equal(args.readState(),state);
   await args.beforeUpload();actions.push('upload');return {id:'p1',head:{id:'r1'}};
  },
  syncProfile:async()=>{actions.push('sync');return {status:'committed'};},
  cloneProfile:async(sourceId,id)=>{actions.push(`clone:${sourceId}->${id}`);}
 });
 assert.equal(adapter.statusText(),'Local');
 assert.deepEqual(await adapter.onPush({name:'HSK3'}),{id:'p1',head:{id:'r1'}});
 assert.deepEqual(await adapter.onSync(),{status:'committed'});
 await adapter.onFork({sourceId:'p1',id:'p2'});
 await adapter.beforeSwitch();
 assert.deepEqual(actions,['flush','upload','flush','sync','clone:p1->p2','flush','disconnect-sync']);
});

test('failed preflight prevents profile Push, Sync, and Switch',async()=>{
 let pushes=0,syncs=0,stops=0;
 const adapter=createCiyanProfileActions({
  readState:()=>({revision:1}),statusText:()=> 'Local',
  flush:async()=>{throw Error('Local data could not be verified');},
  disconnectSync:()=>stops++,
  pushProfile:async({beforeUpload})=>{await beforeUpload();pushes++;},
  syncProfile:async()=>syncs++,cloneProfile:async()=>{}
 });
 await assert.rejects(adapter.onPush({name:'HSK3'}),/Local data/);
 await assert.rejects(adapter.onSync(),/Local data/);
 await assert.rejects(adapter.beforeSwitch(),/Local data/);
 assert.deepEqual([pushes,syncs,stops],[0,0,0]);
});
