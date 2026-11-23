import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';

test('Ciyan v0.9.2 retains lossless earlier backup upgrades',()=>{
 assert.equal(APP_VERSION,'0.9.7');
 const data={appVersion:'0.8.13',state:{cards:[{id:'custom',english:'my word'}],revision:77}};
 const upgraded=prepareVersionedBackup(data);
 assert.equal(upgraded.appVersion,'0.9.7');
 assert.deepEqual(upgraded.state,data.state);
});

test('Ciyan delegates update and exit to host after saving reader/bookmarks',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const bridge=readFileSync(new URL('../app-host-bridge.js',import.meta.url),'utf8');
 assert.match(app,/case 'exit-to-launcher'/);
 assert.match(app,/class=\"icon-btn header-home\"/);
 assert.match(app,/await reader\.flush\(\)/);
 assert.match(app,/await loadState\(\)/);
 assert.match(app,/await returnToLauncher\(\)/);
 assert.match(bridge,/__APP_LAUNCHER__/);
});
