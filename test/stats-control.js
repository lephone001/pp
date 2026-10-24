'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const control = require('../app/lib/statsControl');
const root = fs.mkdtempSync(path.join(__dirname, '.stats-control-'));
class Base { constructor(ctx) { this.ctx = ctx; this.app = ctx.app; } }
function load(file) {
  const filename = path.resolve(__dirname, '..', file), req = Module.createRequire(filename), mod = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})')(
    name => name === 'egg' ? { Service: Base, Controller: Base } : req(name), mod, mod.exports);
  return mod.exports;
}
async function main() {
  const dir = path.join(root, 'app/local_data');
  fs.mkdirSync(dir, { recursive: true });
  const app = { baseDir: root, config: { stats: {} }, logger: { error() {} }, messenger: { sendToApp() {} } };
  control.reload(app);
  assert(control.enabled(app));
  app.statsCollectorState = { queue: [1], summary: { x: {} }, dropped: 1, timer: setInterval(() => {}, 10000) };
  const ctx = { app, request: { body: { enabled: false } }, service: { localData: { async writeJson(name, value) {
    fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(value));
  } } } };
  const Controller = load('app/controller/stats.js');
  await new Controller(ctx).settings();
  assert.strictEqual(ctx.body.data.enabled, false);
  assert.strictEqual(app.statsCollectorState.timer, null);
  assert.strictEqual(app.statsCollectorState.queue.length, 0);
  const restarted = { ...app, statsRuntimeEnabled: undefined };
  control.reload(restarted);
  assert.strictEqual(control.enabled(restarted), false);
  const forbidden = new Proxy({}, { get() { throw new Error('Disabled statistics touched I/O'); } });
  app.redis = forbidden;
  ctx.model = forbidden;
  const Collector = load('app/service/statsCollector.js');
  const collector = new Collector(ctx);
  assert.strictEqual(collector.shouldTrack({}), false);
  assert.strictEqual(collector.enqueue({}), false);
  assert.strictEqual(await collector.flush(), 0);
  const Aggregator = load('app/service/statsAggregator.js');
  assert.strictEqual(await new Aggregator(ctx).consumeAvailable(20), 0);
  const Summary = load('app/service/statsSummary.js');
  await new Summary(ctx).snapshot();
  await new Summary(ctx).recordTotals({});
  await new Controller(ctx).overview();
  assert.strictEqual(ctx.body.code, 409);
  ctx.request.body = { enabled: true };
  await new Controller(ctx).settings();
  assert.strictEqual(control.enabled(app), true);
  control.reload(restarted);
  assert.strictEqual(control.enabled(restarted), true);
  ctx.request.body = { enabled: 'false' };
  await new Controller(ctx).settings();
  assert.strictEqual(ctx.body.code, 400);
  console.log('PASS: persistent enable/disable, worker reload, queue/timer cleanup and disabled I/O guards');
}
main().finally(() => {
  const resolved = fs.realpathSync(root);
  if (path.dirname(resolved) !== fs.realpathSync(__dirname) || !path.basename(resolved).startsWith('.stats-control-')) throw Error('Unexpected test directory');
  fs.rmdirSync(resolved, { recursive: true });
}).catch(error => { console.error(error); process.exitCode = 1; });
