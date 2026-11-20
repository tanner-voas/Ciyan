import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
// wrangler.jsonc uses only comments + JSON, so strip comment-only lines to parse.
const workerConfig = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
  .split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n');
const worker = JSON.parse(workerConfig);

test('Pages and Workers use one static deployment bundle', () => {
  assert.equal(pkg.version, '0.8.11');
  assert.equal(pkg.scripts.build, 'python3 package.py');
  assert.equal(worker.assets.directory, './dist/ciyan');
  assert.equal(worker.name, 'empty-dawn-08a7');
  assert.equal(worker.workers_dev, true);
  assert.match(pkg.scripts['deploy:worker'], /wrangler@4 deploy/);
});
