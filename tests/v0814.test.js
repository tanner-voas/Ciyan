import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APPS,activeAppId,appLaunchUrl,launcherUrl} from '../launcher.js';
import {APP_VERSION,prepareVersionedBackup} from '../backup-versions.js';

test('v0.8.14 launcher routes only registered apps without changing the website origin or path',()=>{
 assert.equal(APPS.length,1);
 assert.equal(APPS[0].id,'ciyan');
 const current='https://example.net/study/index.html';
 assert.equal(launcherUrl(current),'https://example.net/study/');
 assert.equal(appLaunchUrl(current,'ciyan'),'https://example.net/study/?app=ciyan');
 assert.equal(activeAppId('https://example.net/study/'),null);
 assert.equal(activeAppId('https://example.net/study/?app=ciyan'),'ciyan');
 assert.equal(activeAppId('https://example.net/study/?app=unknown'),null);
 assert.throws(()=>appLaunchUrl(current,'unknown'),/Unknown app/);
});

test('v0.8.14 keeps Cíyán state and supports lossless backup upgrades',()=>{
 assert.equal(APP_VERSION,'0.8.14');
 const data={appVersion:'0.8.13',state:{cards:[{id:'custom',english:'my word'}],revision:77}};
 const upgraded=prepareVersionedBackup(data);
 assert.equal(upgraded.appVersion,'0.8.14');
 assert.deepEqual(upgraded.state,data.state);
 assert.equal(data.appVersion,'0.8.13');
});

test('v0.8.14 loads the launcher alone on home, and caches app entry URLs offline',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(index,/src="\.\/launcher\.js"/);
 assert.doesNotMatch(index,/src="\.\/app\.js"/);
 assert.match(worker,/\.\/launcher\.js/);
 assert.match(worker,/request\.mode === 'navigate'/);
 assert.match(worker,/caches\.match\(index\.href\)/);
 assert.match(app,/data-action="exit-to-launcher"/);
 assert.match(app,/await reader\.flush\(\)/);
 assert.match(app,/await loadState\(\)/);
});
