'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const Module = require('module');

function load(relative, ctx, fileSystem = fs, schedule = setTimeout) {
  const filename = path.join(__dirname, '..', relative);
  const req = Module.createRequire(filename);
  const mod = { exports: {} };
  class Base { constructor(context) { this.ctx = context; } }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module: mod, process, console, setTimeout: schedule, clearTimeout,
    require(name) {
      if (name === 'egg') return { Service: Base, Controller: Base };
      if (name === 'fs') return fileSystem;
      if ([ '../confi/index', '../model/domain', '../utils/templateExistsCache' ].includes(name)) return {};
      if (name === './datajson/iframe_url') return [];
      if (name === 'axios') return () => { throw new Error('Unexpected network request'); };
      return req(name);
    },
  }, { filename });
  return new mod.exports(ctx);
}

async function main() {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'video-cache-refresh-'));
  const owned = target => assert(path.resolve(target).startsWith(path.resolve(root) + path.sep));
  const removeOwned = target => { owned(target); fs.rmSync(target, { recursive: true, force: true }); };
  const rows = Array.from({ length: 8 }, (_, index) => ({ _id: String(index), title: 'video-' + index }));
  const unhandled = [];
  const onUnhandled = error => unhandled.push(error);
  process.on('unhandledRejection', onUnhandled);
  function setup(name, overrides = {}) {
    const timers = [], errors = [], cleared = [], counters = [], cache = new Map();
    const cacheFile = path.join(root, name, 'cache') + path.sep;
    const fileSystem = { ...fs, ...overrides, promises: { ...fs.promises, ...overrides.promises } };
    const ctx = {
      app: { config: { cacheFile } },
      logger: { error: (...args) => errors.push(args) },
      model: {
        Video: { find: () => ({ sort() { return this; }, limit: async () => rows }), countDocuments: async () => 2 },
        VideoBook: { countDocuments: async () => 3 },
        VideoImage: { countDocuments: async () => 5 },
        VideoCategory: {
          find: () => ({ sort: async () => [{ _id: '56' }] }),
          findOneAndUpdate: async (filter, update) => assert.strictEqual(update.$set.num, 10),
        },
        Domain: { find: async () => [] },
      },
      service: {
        cache: { set: async (key, value) => cache.set(key, value), del: async key => cache.delete(key) },
        counters: { set: async model => counters.push(model) },
      },
    };
    ctx.service.utils = load('app/service/utils.js', ctx, fileSystem);
    const delDir = ctx.service.utils.delDir.bind(ctx.service.utils);
    ctx.service.utils.delDir = (directory, type = 1) => { cleared.push({ directory, type }); return delDir(directory, type); };
    const schedule = (callback, delay) => delay === 2000 ? timers.push(callback) : setTimeout(callback, delay);
    const service = load('app/service/video.js', ctx, fileSystem, schedule);
    ctx.service.video = service;
    return { ctx, service, timers, errors, cleared, counters, cache, cacheFile, filename: path.join(cacheFile, 'video_l/index.json') };
  }
  try {
    const fresh = setup('missing-parents');
    assert.strictEqual(await fresh.service.videoUpdateAll(), '');
    assert(fs.statSync(path.join(fresh.cacheFile, 'video_list')).isDirectory());
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(fresh.filename, 'utf8')), rows);
    assert.strictEqual(fresh.cleared[0].type, 0);
    assert.strictEqual(fresh.cache.get('video-category-all')[0].num, 10);
    assert.strictEqual(fresh.cache.get('VideoCounts').imageCount, 5);
    assert.deepStrictEqual(fresh.counters, ['Video']);

    // Reproduce the production race: a category disappears after readdir, before lstat.
    const raced = setup('removed-category', { readdirSync(directory) {
      const files = fs.readdirSync(directory);
      if (path.basename(directory) === 'video_list') {
        const category = path.join(directory, '56');
        removeOwned(category);
      }
      return files;
    } });
    fs.mkdirSync(path.join(raced.cacheFile, 'video_list/56'), { recursive: true });
    fs.writeFileSync(path.join(raced.cacheFile, 'video_list/56/index.json'), '[]');
    await Promise.all([raced.service.videoUpdateAll(), raced.service.videoUpdateAll()]);
    assert(fs.statSync(path.join(raced.cacheFile, 'video_list')).isDirectory());

    // A refresh must wait for the JSON replacement and counters, and preserve old JSON until rename.
    let entered, release;
    const atRename = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const held = setup('awaited-write', { promises: { async rename(from, to) {
      entered();
      await gate;
      return fs.promises.rename(from, to);
    } } });
    await fs.promises.mkdir(path.dirname(held.filename), { recursive: true });
    await fs.promises.writeFile(held.filename, '[{"old":true}]');
    let completed = false;
    const updating = held.service.videoUpdateAll().then(() => { completed = true; });
    await atRename;
    assert.strictEqual(completed, false);
    assert.strictEqual(fs.readFileSync(held.filename, 'utf8'), '[{"old":true}]');
    assert.strictEqual(held.counters.length, 0);
    release();
    await updating;
    let releaseCounter, enteredCounter;
    const counterGate = new Promise(resolve => { releaseCounter = resolve; });
    const atCounter = new Promise(resolve => { enteredCounter = resolve; });
    held.ctx.service.counters.set = async () => { enteredCounter(); await counterGate; };
    completed = false;
    const counting = held.service.videoUpdateAll().then(() => { completed = true; });
    await atCounter;
    assert.strictEqual(completed, false);
    releaseCounter();
    await counting;

    const failed = setup('failed-write', { promises: { async writeFile() { throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }); } } });
    await fs.promises.mkdir(path.dirname(failed.filename), { recursive: true });
    await fs.promises.writeFile(failed.filename, '[{"old":true}]');
    await assert.rejects(failed.service.videoUpdateAll(), error => error.code === 'ENOSPC');
    assert.strictEqual(fs.readFileSync(failed.filename, 'utf8'), '[{"old":true}]');
    assert.deepStrictEqual(fs.readdirSync(path.dirname(failed.filename)), ['index.json']);
    fresh.service.setTodayCountVideo = async () => { throw new Error('count failed'); };
    await assert.rejects(fresh.service.videoUpdateAll(), /count failed/);

    // Delayed homepage cleanup and intentionally background refreshes must consume failures.
    fresh.ctx.model.Domain.find = async () => { throw new Error('domain lookup failed'); };
    await fresh.timers[0]();
    assert(fresh.errors.some(args => args[0].includes('homepage cache cleanup')));
    fresh.service.videoUpdateAll = async () => { throw new Error('refresh failed'); };
    await fresh.service.videoPiCreate([]);
    const controller = load('app/controller/video.js', fresh.ctx);
    await controller.videoUpdateAll();
    assert.strictEqual(fresh.ctx.body.code, 200);
    assert(fresh.errors.some(args => args[0].includes('refresh after import')));
    assert(fresh.errors.some(args => args[0].includes('background refresh')));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepStrictEqual(unhandled, []);
    console.log('PASS: missing directories, concurrent category deletion, awaited cache replacement/counters, preserved old JSON on failure, and background error handling. No database or network access.');
  } finally {
    process.removeListener('unhandledRejection', onUnhandled);
    const absoluteRoot = path.resolve(root);
    assert.strictEqual(path.dirname(absoluteRoot), path.resolve(os.tmpdir()));
    assert(path.basename(absoluteRoot).startsWith('video-cache-refresh-'));
    fs.rmSync(absoluteRoot, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
