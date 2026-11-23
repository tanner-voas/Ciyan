import test from 'node:test';
import assert from 'node:assert/strict';
import {backupIndicator} from '../backup-indicator.js';

test('pending is yellow, errors red, and only confirmed cloud is green',()=>{
 assert.equal(backupIndicator({remote:true,revision:3,cloudRevision:2,phase:'pending'}).mode,'pending');
 assert.equal(backupIndicator({remote:true,revision:3,cloudRevision:3,phase:'error'}).mode,'error');
 assert.equal(backupIndicator({remote:true,revision:3,cloudRevision:3,phase:'synced'}).mode,'saved');
 assert.equal(backupIndicator({remote:true,revision:4,cloudRevision:3,phase:'synced'}).mode,'pending');
 assert.equal(backupIndicator({remote:false,revision:4,backedUpRevision:3,phase:'local'}).mode,'pending');
 assert.equal(backupIndicator({remote:false,revision:4,backedUpRevision:4,phase:'local'}).mode,'saved');
});

test('upload pie reports acknowledged chunks, stays yellow until commit',()=>{
 const status=backupIndicator({remote:true,phase:'syncing',revision:3,cloudRevision:2,progress:{stage:'uploading',completed:7,total:20}});
 assert.deepEqual([status.mode,status.percent,status.completed,status.total],['uploading',35,7,20]);
 assert.equal(backupIndicator({remote:true,phase:'syncing',progress:{stage:'committing',completed:20,total:20}}).percent,100);
 assert.equal(backupIndicator({remote:true,phase:'syncing',progress:{stage:'committing',completed:20,total:20}}).mode,'uploading');
});
