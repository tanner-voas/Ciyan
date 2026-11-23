import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
test('Ciyan builds an app-only static module for AppLauncher',()=>{
 assert.equal(pkg.version,'0.9.11');
 assert.equal(pkg.scripts.build,'python3 package.py');
 const packager=readFileSync(new URL('../package.py',import.meta.url),'utf8');
 assert.match(packager,/"app-host-bridge.js"/);
 assert.match(packager,/"app.js"/);
 assert.doesNotMatch(packager,/"launcher.js"/);
 assert.match(packager,/STANDALONE_SHELL/);
 assert.match(packager,/STANDALONE/);
});
