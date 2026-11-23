import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from '../backup-versions.js';
const src=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
test('v0.9.7 keeps the hosted home and standalone refresh mutually exclusive',()=>{
 assert.equal(APP_VERSION,'0.9.12');
 assert.match(src,/data-action="\$\{hosted\?'exit-to-launcher':'reload-app'\}"/);
 assert.match(src,/icon\(hosted\?'home':'refresh'\)/);
 assert.match(src,/aria-pressed="\$\{page==='settings'\}"/);
 assert.doesNotMatch(src,/Save &amp; Exit to My Apps/);
 assert.match(css,/\.topbar\{position:sticky/);
});
test('cloud indicator distinguishes errors, pending work, upload progress, and confirmed backups',()=>{
 assert.match(src,/currentBackupIndicator\(\)/);
 assert.match(src,/backupButtonContents\(backupStatus\)/);
 assert.match(css,/\.topbar \.backup-error/);
 assert.match(css,/\.topbar \.backup-pending/);
 assert.match(css,/\.topbar \.backup-uploading/);
 assert.match(css,/\.topbar \.backup-saved/);
 assert.match(css,/conic-gradient/);
});
