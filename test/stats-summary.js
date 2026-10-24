'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const temp = fs.mkdtempSync(path.join(__dirname, '.stats-summary-'));
class Service { constructor(ctx) { this.ctx = ctx; this.app = ctx.app; } }
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  const mod = { exports: {} };
  const req = Module.createRequire(filename);
  vm.runInThisContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})', { filename })(
    name => name === 'egg' ? { Service } : req(name), mod, mod.exports);
  return mod.exports;
}
const Summary = load('app/service/statsSummary.js');
const Collector = load('app/service/statsCollector.js');
const date = offset => new Date(Date.now() + 8 * 3600000 + offset * 86400000).toISOString().slice(0, 10);
const store = {};
const locks = {};
let restores = 0;
// Redis test double models atomic hash increments; no external database/network.
const redis = {
  async set(key, token) { if (locks[key]) return null; locks[key] = token; return 'OK'; },
  async hexists(key, field) { return store[key] && store[key][field] ? 1 : 0; },
  async eval(script, count, key, encoded, updatedAt, seed) {
    if (count === 2) {
      if (locks[encoded] !== updatedAt) return 0;
      const rows = store[key] || (store[key] = {});
      if (!rows.all) { rows.all = JSON.parse(seed); restores++; }
      return 1;
    }
    if (script.includes('DEL')) {
      if (locks[key] === encoded) delete locks[key];
      return 1;
    }
    if (!store[key] || !store[key].all) return 0;
    const rows = store[key];
    for (const [ field, delta ] of Object.entries(JSON.parse(encoded))) {
      const row = rows[field] || (rows[field] = { metrics: {}, device: {}, errorRows: [] });
      for (const group of [ 'metrics', 'device' ]) {
        for (const [ name, n ] of Object.entries(delta[group])) row[group][name] = (row[group][name] || 0) + n;
      }
      row.errorRows = row.errorRows.concat(delta.errorRows).sort((a, b) => b.last.localeCompare(a.last)).slice(0, 10);
      row.updatedAt = updatedAt;
    }
    return 1;
  },
  async hgetall(key) {
    return Object.fromEntries(Object.entries(store[key] || {}).map(([ k, v ]) => [ k, JSON.stringify(v) ]));
  },
};
const ctx = { app: { baseDir: temp, config: { stats: { queueMaxLength: 100 } }, redis }, service: {} };
const summary = ctx.service.statsSummary = new Summary(ctx);
const event = { date: date(0), timestamp: Date.now(), siteKey: 'example.test', path: '/a', status: 200, device: 'pc' };
async function main() {
  assert.strictEqual((await summary.dashboard({})).initialized, false);
  await Promise.all([ summary.record([ event ]), summary.record([ { ...event, device: 'mobile', spiderType: 'bot' } ]) ]);
  await summary.record(Array.from({ length: 12 }, (_, i) => ({ ...event, status: 404, timestamp: event.timestamp + i })));
  await summary.record([ { ...event, date: date(-1) } ]);
  await summary.snapshot();
  let result = await summary.dashboard({});
  assert.deepStrictEqual(result.metrics, { pv: 14, normal: 13, spider: 1, errors: 12 });
  assert.strictEqual(result.device.mobile, 1);
  assert.strictEqual(result.errorRows.length, 10);
  assert.strictEqual(Object.keys(store[summary.key(date(0))]).length, 1);
  assert.strictEqual((await summary.dashboard({ site: 'missing' })).metrics.pv, 0);
  assert(fs.existsSync(summary.filePath(date(-1))));
  // Redis loss recovers counters from the last on-disk snapshot.
  delete store[summary.key(date(0))];
  await summary.record([ event ]);
  await summary.snapshot();
  assert.strictEqual((await summary.dashboard({})).metrics.pv, 15);
  // Reading the homepage must work with no Redis and no MongoDB at all.
  ctx.app.redis = null;
  assert.strictEqual((await new Summary(ctx).dashboard({})).metrics.pv, 15);
  for (const name of [ date(-30), date(-29), 'keep-me' ]) fs.mkdirSync(path.join(summary.dataDir, name), { recursive: true });
  await summary.cleanup();
  assert(!fs.existsSync(path.join(summary.dataDir, date(-30))));
  assert(fs.existsSync(path.join(summary.dataDir, date(-29))));
  assert(fs.existsSync(path.join(summary.dataDir, 'keep-me')));
  assert.throws(() => summary.filePath('../outside'));
  // A full detail queue must not suppress summary counts.
  const collector = new Collector(ctx);
  collector.ensureTimer = () => {};
  for (let i = 0; i < 150; i++) collector.enqueue(event);
  assert.strictEqual(collector.state.queue.length, 100);
  assert.strictEqual(collector.state.summary[date(0)].all.metrics.pv, 150);
  const manyHosts = Object.create(null);
  for (let i = 0; i < 100000; i++) summary.accumulate(manyHosts, { ...event, siteKey: 'host-' + i + '.test', status: 404 });
  assert.strictEqual(Object.keys(manyHosts[date(0)]).length, 1);
  assert.strictEqual(manyHosts[date(0)].all.metrics.pv, 100000);
  assert.strictEqual(manyHosts[date(0)].all.errorRows.length, 10);
  ctx.app.redis = redis;
  const restoreCount = restores;
  const originalRead = fs.promises.readFile;
  fs.promises.readFile = async () => { throw new Error('Warm submission must not read snapshots'); };
  try { await summary.record([event]); } finally { fs.promises.readFile = originalRead; }
  assert.strictEqual(restores, restoreCount);
  ctx.app.redis = redis;
  ctx.logger = { warn() {} };
  ctx.model = { StatsDaily: { find(filter) {
    assert.strictEqual(filter.dimension, 'site');
    return { select() { return this; }, maxTimeMS(ms) { assert.strictEqual(ms, 5000); return this; },
      async lean() { return [{ siteKey: 'example.test', pv: 25, normalPv: 24, spiderPv: 1, errorPv: 12, pcPv: 24, mobilePv: 1 }]; } };
  } } };
  await summary.snapshotDate(date(0));
  assert.strictEqual((await summary.dashboard({})).metrics.pv, 25);
  await summary.snapshotDate(date(0));
  assert.strictEqual((await summary.dashboard({})).metrics.pv, 25, 'overlapping sources must not double count');
  ctx.model.StatsDaily.find = () => { throw new Error('database unavailable'); };
  await summary.snapshotDate(date(0));
  assert.strictEqual((await summary.dashboard({})).metrics.pv, 25, 'retain last good totals on DB failure');
  console.log('stats summary: counters, file-only reads, recovery, daily retention, queue overflow passed');
}
main().finally(() => {
  const resolved = fs.realpathSync(temp);
  if (path.dirname(resolved) !== fs.realpathSync(__dirname) || !path.basename(resolved).startsWith('.stats-summary-')) throw new Error('Unexpected test directory');
  fs.rmdirSync(resolved, { recursive: true });
}).catch(error => { console.error(error); process.exitCode = 1; });
