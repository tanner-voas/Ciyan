import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';
import {makeBackup,defaultState} from '../storage.js';

test('v0.8.6 backup migration retains v0.8.5 data without modifications',()=>{
 assert.equal(APP_VERSION,'0.9.11');
 const old=makeBackup(defaultState()); old.appVersion='0.8.5';
 const next=prepareVersionedBackup(old);
 assert.equal(next.appVersion,'0.9.11');
 assert.deepEqual(next.state,old.state);
});
test('Ciyan keeps drawing touch gestures isolated from browser scroll',()=>{
 const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(css,/html,body\{touch-action:pan-x pan-y\}/);
 assert.match(css,/#drawing-pad\{[^}]*touch-action:none/);
});
test('word/grammar topic filters stay available, but collapse by default',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/<details class="collection-filter-panel"><summary>/);
 assert.match(app,/<div id="active-tag-filter"/);
 assert.match(app,/<div id="tag-filter"/);
 assert.match(app,/id="collection-filter-count"/);
 assert.match(app,/count\?`\$\{count\} active filter/);
});
