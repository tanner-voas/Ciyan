import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from '../backup-versions.js';
const src=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
test('v0.9.6 keeps the hosted home and standalone refresh mutually exclusive',()=>{
 assert.equal(APP_VERSION,'0.9.6');
 assert.match(src,/data-action="\$\{hosted\?'exit-to-launcher':'reload-app'\}"/);
 assert.match(src,/icon\(hosted\?'home':'refresh'\)/);
 assert.match(src,/aria-pressed="\$\{page==='settings'\}"/);
 assert.doesNotMatch(src,/Save &amp; Exit to My Apps/);
 assert.match(css,/\.topbar\{position:sticky/);
});
test('manual backup export status never claims a Google upload',()=>{
 assert.match(src,/backupNeeded\(\)\?'unsaved':'saved'/);
 assert.match(src,/let backupUploading=false/);
 assert.match(css,/backup-unsaved.*#b54b40/);
 assert.match(css,/backup-saving.*#976311/);
 assert.match(css,/backup-saved.*#26754d/);
});
