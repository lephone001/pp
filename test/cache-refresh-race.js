'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const Module = require('module');

function loadService(relative, ctx, fileSystem = fs) {
  const filename = path.join(__dirname, '..', relative);
  const req = Module.createRequire(filename);
  const mod = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module: mod, process, console, setTimeout, clearTimeout,
    require(name) {
      if (name === 'egg') return { Service: class { constructor(context) { this.ctx = context; } } };
      if (name === 'fs') return fileSystem;
      if (name === '../confi/index' || name === '../model/domain' || name === '../utils/templateExistsCache') return {};
      if (name === './datajson/iframe_url') return [];
      if (name === 'axios') return () => { throw new Error('Unexpected network access'); };
      return req(name);
    },
  });
  return new mod.exports(ctx);
}

async function main() {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cache-refresh-race-'));
  const owned = target => assert(path.resolve(target).startsWith(path.resolve(root) + path.sep));
  const removeOwned = target => { owned(target); fs.rmSync(target, { recursive: true, force: true }); };
  function utils(overrides = {}) {
    const ctx = { service: {} };
    const service = loadService('app/service/utils.js', ctx, { ...fs, ...overrides });
    ctx.service.utils = service;
    return service;
  }
  function seed(name) {
    const directory = path.join(root, name);
    fs.mkdirSync(path.join(directory, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'index7.json'), '[]');
    fs.writeFileSync(path.join(directory, 'nested/child.json'), '[]');
    return directory;
  }
  const names = Array.from({ length: 10 }, (_, index) => 'index' + (index || '') + '.json');
  const rows = version => Array.from({ length: 120 }, (_, index) => ({ title: 'app-' + index, version }));
  function app(name, data, promiseOverrides = {}) {
    const cacheFile = path.join(root, name, 'cache');
    const query = { sort() { return this; }, limit() { return this; }, select() { return Promise.resolve(data); } };
    const ctx = {
      app: { config: { cacheFile } }, model: { App: { find: () => query } },
      service: { utils: { delDir() { throw new Error('APP refresh must not clear the live cache directory'); } } },
    };
    return {
      service: loadService('app/service/app.js', ctx, { ...fs, promises: { ...fs.promises, ...promiseOverrides } }),
      directory: path.join(cacheFile, 'app_list'),
    };
  }
  async function oldCache(directory) {
    await fs.promises.mkdir(directory, { recursive: true });
    for (const name of names) await fs.promises.writeFile(path.join(directory, name), '[{"version":"old"}]');
  }
  try {
    const ordinary = seed('ordinary');
    owned(ordinary);
    utils().delDir(ordinary, 0);
    assert.deepStrictEqual(fs.readdirSync(ordinary), []);
    utils().delDir(ordinary);
    assert(!fs.existsSync(ordinary));
    utils().delDir(ordinary);

    const vanished = seed('vanished-after-readdir');
    owned(vanished);
    utils({ readdirSync(directory) {
      const entries = fs.readdirSync(directory);
      if (directory === vanished) removeOwned(directory);
      return entries;
    } }).delDir(vanished);
    assert(!fs.existsSync(vanished));

    const removedFile = seed('vanished-after-stat');
    owned(removedFile);
    utils({ lstatSync(filename) {
      const stat = fs.lstatSync(filename);
      if (path.basename(filename) === 'index7.json') fs.unlinkSync(filename);
      return stat;
    } }).delDir(removedFile, 0);
    assert.deepStrictEqual(fs.readdirSync(removedFile), []);

    const recreated = seed('new-file-during-rmdir');
    owned(recreated);
    utils({ rmdirSync(directory) {
      if (directory === recreated) fs.writeFileSync(path.join(directory, 'new.json'), '[]');
      return fs.rmdirSync(directory);
    } }).delDir(recreated);
    assert(fs.existsSync(path.join(recreated, 'new.json')));

    const denied = seed('permission-error');
    owned(denied);
    assert.throws(() => utils({ lstatSync() {
      throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
    } }).delDir(denied), error => error.code === 'EACCES');

    const fresh = app('missing-parents', rows('fresh'));
    await fresh.service.updateAppCacheList();
    for (let index = 0; index < names.length; index++) {
      const actual = JSON.parse(fs.readFileSync(path.join(fresh.directory, names[index]), 'utf8'));
      assert.deepStrictEqual(actual, rows('fresh').slice(index * 12, index * 12 + 12));
    }

    let releaseRename, renameStarted;
    const gate = new Promise(resolve => { releaseRename = resolve; });
    const started = new Promise(resolve => { renameStarted = resolve; });
    const waiting = app('atomic-replace', rows('new'), { async rename(from, to) {
      if (path.basename(to) === 'index.json') { renameStarted(); await gate; }
      return fs.promises.rename(from, to);
    } });
    await oldCache(waiting.directory);
    let complete = false;
    const pending = waiting.service.updateAppCacheList().then(() => { complete = true; });
    await started;
    assert.strictEqual(complete, false);
    for (const name of names) assert.strictEqual(JSON.parse(fs.readFileSync(path.join(waiting.directory, name), 'utf8'))[0].version, 'old');
    releaseRename();
    await pending;
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(waiting.directory, 'index.json'), 'utf8'))[0].version, 'new');

    const concurrentA = app('concurrent', rows('a'));
    const concurrentB = app('concurrent', rows('b'));
    await oldCache(concurrentA.directory);
    let finished = false;
    let updateError;
    const updates = Promise.all([concurrentA.service.updateAppCacheList(), concurrentB.service.updateAppCacheList()])
      .then(() => { finished = true; }, error => { finished = true; updateError = error; });
    while (!finished) {
      for (const name of names) assert(Array.isArray(JSON.parse(fs.readFileSync(path.join(concurrentA.directory, name), 'utf8'))));
      await new Promise(resolve => setImmediate(resolve));
    }
    await updates;
    if (updateError) throw updateError;
    assert.deepStrictEqual(fs.readdirSync(concurrentA.directory).sort(), names.slice().sort());
    for (const name of names) {
      const list = JSON.parse(fs.readFileSync(path.join(concurrentA.directory, name), 'utf8'));
      assert.strictEqual(list.length, 12);
      assert(list.every(item => item.version === list[0].version));
    }

    for (const operation of ['writeFile', 'rename']) {
      const failure = app('failed-' + operation, rows('new'), {
        async [operation](...args) {
          if (path.basename(args[0]).startsWith('index7.json.tmp-')) throw new Error(operation + ' failed');
          return fs.promises[operation](...args);
        },
      });
      await oldCache(failure.directory);
      await assert.rejects(failure.service.updateAppCacheList(), new RegExp(operation + ' failed'));
      assert.strictEqual(JSON.parse(fs.readFileSync(path.join(failure.directory, 'index7.json'), 'utf8'))[0].version, 'old');
      assert.deepStrictEqual(fs.readdirSync(failure.directory).sort(), names.slice().sort());
    }

    let renameAttempts = 0;
    const transient = app('temporary-file-lock', rows('new'), { async rename(from, to) {
      if (path.basename(to) === 'index.json' && ++renameAttempts === 1) {
        throw Object.assign(new Error('temporarily locked'), { code: 'EPERM' });
      }
      return fs.promises.rename(from, to);
    } });
    await oldCache(transient.directory);
    await transient.service.updateAppCacheList();
    assert.strictEqual(renameAttempts, 2);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(transient.directory, 'index.json'), 'utf8'))[0].version, 'new');

    renameAttempts = 0;
    const locked = app('permanent-file-lock', rows('new'), { async rename() {
      renameAttempts++;
      throw Object.assign(new Error('locked'), { code: 'EPERM' });
    } });
    await oldCache(locked.directory);
    await assert.rejects(locked.service.updateAppCacheList(), error => error.code === 'EPERM');
    assert.strictEqual(renameAttempts, 4);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(locked.directory, 'index.json'), 'utf8'))[0].version, 'old');
    assert.deepStrictEqual(fs.readdirSync(locked.directory).sort(), names.slice().sort());

    const empty = app('empty', []);
    assert.strictEqual(await empty.service.updateAppCacheList(), '');
    assert(!fs.existsSync(empty.directory));
    console.log('PASS: deletion races, preserved root, real I/O errors, atomic APP cache replacement, concurrent readers/writers and failure preservation');
  } finally {
    assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.promises.rm(root, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
