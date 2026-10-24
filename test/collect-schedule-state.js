'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const state = require('../app/lib/collectScheduleState');
const Scheduler = require('../app/service/movieCollectScheduler');

async function main() {
  const baseDir = fs.mkdtempSync(path.join(__dirname, '.collect-schedule-test-'));
  let queries = 0;
  let tasks = 0;
  let warnings = 0;
  let rows = [];
  let failure = false;
  const model = {
    db: { readyState: 1 },
    find() {
      queries++;
      return { select() { return this; }, async lean() {
        if (failure) throw new Error('connection timed out');
        return rows;
      } };
    },
    findOneAndUpdate() { return { lean: async () => ({ _id: 'source' }) }; },
  };
  const ctx = {
    app: { baseDir }, model: { CollectSource: model, CollectTask: {
      findOne() { return { select() { return this; }, lean: async () => null }; },
    } },
    logger: { warn() { warnings++; }, info() {}, error() {} },
    service: { collectSource: { recoverStaleTasks: async () => {}, createTask: async () => { tasks++; return { code: 200 }; } } },
  };
  const service = Object.create(Scheduler.prototype);
  service.ctx = ctx;
  service.nowParts = () => ({ date: '2026-09-24', time: '03:00', minuteOfDay: 180 });
  try {
    model.db.readyState = 0;
    await service.tick();
    assert.strictEqual(queries, 0, 'disconnected cold start must not query');
    model.db.readyState = 1;
    await service.tick();
    await service.tick();
    await service.runVideoDaily();
    assert.strictEqual(queries, 1, 'empty schedule is shared and cached');
    rows = [{ _id: 'source', siteType: 11, scheduleTime: '03:00', schedulePages: 2 }];
    await state.invalidate(ctx.app);
    await service.tick();
    assert.strictEqual(tasks, 1, 'enabled movie schedule still runs');
    model.db.readyState = 0;
    await service.tick();
    assert.strictEqual(tasks, 1);
    model.db.readyState = 1;
    rows = [];
    await state.invalidate(ctx.app);
    await service.tick();
    const count = queries;
    await service.tick();
    assert.strictEqual(queries, count, 'disabled schedules stop recurring database queries');
    // A new day refreshes once; concurrent workers share the same daily claim.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await Promise.all([ state.sources(ctx, tomorrow), state.sources(ctx, tomorrow) ]);
    assert.strictEqual(queries, count + 1, 'next day performs one shared refresh');
    await state.sources(ctx, tomorrow);
    assert.strictEqual(queries, count + 1);
    await state.invalidate(ctx.app);
    failure = true;
    const beforeFailure = queries;
    await service.tick();
    await service.tick();
    assert.strictEqual(warnings, 1, 'connection race must be handled with throttled warning');
    assert.strictEqual(queries, beforeFailure + 1, 'failed discovery is not retried every minute');
    console.log('PASS: daily shared refresh, configuration invalidation, enabled tasks, and no minute retries on failure.');
  } finally {
    assert.strictEqual(path.dirname(fs.realpathSync(baseDir)), fs.realpathSync(__dirname));
    fs.rmdirSync(baseDir, { recursive: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
