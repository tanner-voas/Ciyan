import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {APP_VERSION} from '../backup-versions.js';
import {defaultState,migrateState,speechPreferences} from '../storage.js';

test('v0.8.5 bounds expensive Azure prefetch and cache values, including restored backups',()=>{
 assert.equal(APP_VERSION,'0.8.13');
 assert.equal(speechPreferences({}).speechPreload,2);
 assert.equal(speechPreferences({}).speechCacheLimit,8);
 assert.deepEqual(
  (({speechPreload,speechCacheLimit})=>({speechPreload,speechCacheLimit}))(speechPreferences({speechPreload:99999,speechCacheLimit:99999})),
  {speechPreload:12,speechCacheLimit:64}
 );
 const s=defaultState();s.settings.speechPreload=99999;s.settings.speechCacheLimit=99999;
 const migrated=migrateState(s);
 assert.equal(migrated.settings.speechPreload,12);
 assert.equal(migrated.settings.speechCacheLimit,64);
 assert.equal(s.settings.speechPreload,99999,'migration must not modify the source');
});

test('mobile viewport permits accessibility pinch zoom',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/width=device-width, initial-scale=1, viewport-fit=cover/);
 assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
 const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(css,/html,body\{touch-action:manipulation\}/);
 assert.doesNotMatch(css,/html,body\{touch-action:pan-x pan-y\}/);
});
