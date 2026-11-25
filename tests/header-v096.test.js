import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from '../backup-versions.js';
const src=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
test('v0.9.7 keeps the hosted home and standalone refresh mutually exclusive',()=>{
 assert.match(APP_VERSION,/^\d+\.\d+\.\d+$/);
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

test('viewport scroll remains the sticky header scroll container',()=>{
 for(const selector of ['html','body']){
  const rule=css.match(new RegExp(`(?:^|\\n)${selector}\\{([^}]+)\\}`))?.[1]||'';
  assert.match(rule,/overflow-x:clip/);
  assert.doesNotMatch(rule,/overflow-x:hidden/);
 }
 assert.match(css,/\.study-scroll-anchor\{scroll-margin-top:calc\(var\(--ciyan-header-height/);
 assert.match(src,/header\?\.getBoundingClientRect\(\)\.height/);
 assert.match(src,/target\.style\.setProperty\('--ciyan-header-height'/);
 assert.match(src,/if\(page==='reader'&&reader\.isReading\(\)\)return '<main id="main" class="immersive-reader">/);
});
