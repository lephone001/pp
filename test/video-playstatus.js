'use strict';

// node test/video-playstatus.js: run the real controller with mocked filesystem calls.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../app/controller/video.js'), 'utf8');
const validId = '6785d391ba2bd4098f98a2ea';

function setup(id, hasFile = false, invalid = false) {
  const calls = { exists: [], removed: [] };
  const mod = { exports: {} };
  class TestDate extends Date { getMonth() { return 9; } }
  vm.runInNewContext(source, {
    module: mod, Date: TestDate,
    require: name => {
      if (name === 'egg') return { Controller: class { constructor(ctx) { this.ctx = ctx; } } };
      if (name === 'axios') return {};
      if (name === 'fs') return {
        existsSync: filename => { calls.exists.push(filename); return hasFile; },
        unlinkSync: filename => calls.removed.push(filename),
      };
      throw new Error('Unexpected dependency: ' + name);
    },
  });
  const query = { id };
  Object.defineProperty(query, 'code', { get() {
    if (invalid) throw new Error('Invalid ID continued to read code');
    return '2';
  } });
  const ctx = { query, status: 200 };
  Object.defineProperty(ctx, 'app', { get() {
    if (invalid) throw new Error('Invalid ID accessed cache configuration');
    return { config: { cacheFile: '/cache/' } };
  } });
  return { controller: new mod.exports(ctx), ctx, calls };
}

async function main() {
  for (const id of [undefined, null, '', 'sss', 'a'.repeat(23), 'a'.repeat(25), 'g'.repeat(24),
    '../' + validId, validId + '\n', validId + '\r\n', [validId], {}, 123,
    { toString() { throw new Error('Invalid ID must not be coerced'); } }]) {
    const probe = setup(id, true, true);
    await probe.controller.playstatus();
    assert.strictEqual(probe.ctx.status, 444);
    assert.strictEqual(probe.ctx.body, '');
    assert.strictEqual(probe.calls.exists.length, 0);
    assert.strictEqual(probe.calls.removed.length, 0);
  }
  for (const id of [validId, validId.toUpperCase()]) {
    for (const hasFile of [false, true]) {
      const probe = setup(id, hasFile);
      await probe.controller.playstatus();
      assert.strictEqual(probe.ctx.status, 200);
      assert.strictEqual(probe.ctx.body, '');
      assert.strictEqual(probe.calls.exists.length, 1);
      assert.strictEqual(probe.calls.exists[0], '/cache/video/10/' + id + '.html');
      assert.strictEqual(probe.calls.removed.length, hasFile ? 1 : 0);
      if (hasFile) assert.strictEqual(probe.calls.removed[0], probe.calls.exists[0]);
    }
  }
  console.log('PASS: invalid playstatus IDs return empty 444 before all following logic; valid IDs retain cache handling. No real file changes.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
