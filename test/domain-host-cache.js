'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const { fork } = require('child_process');
const { getDomainHostList, reloadDomainHostList, setDomainHostList } = require('../app/lib/domainHostCache');
const { updateDomainListFile } = require('../app/utils/domainListFile');

function boot(app) {
  const filename = path.join(__dirname, '../app.js');
  const req = Module.createRequire(filename);
  const mod = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module: mod, process,
    require: name => name === './app/lib/statsControl' ? { reload() {} } : req(name),
  });
  return new mod.exports(app);
}

async function worker(baseDir) {
  const filename = path.join(baseDir, 'app/local_data/allDomainList.txt');
  const readFile = fs.promises.readFile;
  let reads = 0;
  fs.promises.readFile = async (target, ...args) => {
    if (target === filename) reads++;
    return readFile.call(fs.promises, target, ...args);
  };
  const listeners = new Map();
  const app = {
    baseDir, config: { env: 'local', coreMiddleware: [] }, logger: { warn() {} },
    messenger: { on: (event, handler) => listeners.set(event, handler) },
    createAnonymousContext() { throw new Error('Local startup must not query MongoDB'); },
  };
  await boot(app).willReady();
  process.on('message', async message => {
    try {
      if (message.refresh) await listeners.get('all-domain-list-updated')({ sourcePid: message.sourcePid });
      const list = await getDomainHostList(baseDir, app.logger);
      process.send({ id: message.id, domains: Array.from(list.domains), reads });
    } catch (error) {
      process.send({ id: message.id, error: error.stack });
    }
  });
  process.on('disconnect', () => process.exit(0));
  process.send({ ready: true });
}

async function main() {
  const baseDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'domain-host-cache-'));
  const filename = path.join(baseDir, 'app/local_data/allDomainList.txt');
  let child;
  try {
    await fs.promises.mkdir(path.dirname(filename), { recursive: true });
    await fs.promises.writeFile(filename, 'old.test\n');
    child = fork(__filename, [ 'worker', baseDir ], { stdio: [ 'ignore', 'inherit', 'inherit', 'ipc' ] });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('worker startup timeout')), 8000);
      child.once('error', reject);
      child.once('message', message => { clearTimeout(timer); message.ready ? resolve() : reject(new Error(message.error)); });
    });
    let serial = 0;
    function query(options = {}) {
      return new Promise((resolve, reject) => {
        const id = ++serial;
        const timer = setTimeout(() => { child.removeListener('message', receive); reject(new Error('worker response timeout')); }, 5000);
        function receive(message) {
          if (message.id !== id) return;
          clearTimeout(timer);
          child.removeListener('message', receive);
          message.error ? reject(new Error(message.error)) : resolve(message);
        }
        child.on('message', receive);
        child.send({ id, ...options });
      });
    }
    assert.deepStrictEqual((await query()).domains, [ 'old.test' ]);
    const model = { find() { return {
      select() { return this; }, sort() { return this; },
      async lean() { return [ { link: 'new.test' } ]; },
    }; } };
    await updateDomainListFile(model, baseDir);
    assert.deepStrictEqual(Array.from(getDomainHostList(baseDir).domains), [ 'new.test' ]);
    assert.deepStrictEqual((await query()).domains, [ 'old.test' ], 'Workers have independent memory');
    const refreshed = await query({ refresh: true, sourcePid: process.pid });
    assert.deepStrictEqual(refreshed.domains, [ 'new.test' ]);
    assert.strictEqual(refreshed.reads, 2);
    assert.strictEqual((await query({ refresh: true, sourcePid: child.pid })).reads, 2, 'Source worker already refreshed its cache');
    for (let index = 0; index < 50; index++) assert.strictEqual((await query()).reads, 2);
    await fs.promises.unlink(filename);
    const failed = await query({ refresh: true, sourcePid: process.pid });
    assert.deepStrictEqual(failed.domains, []);
    assert.strictEqual(failed.reads, 5, 'An update-triggered load retries at most three times');
    for (let index = 0; index < 10; index++) assert.strictEqual((await query()).reads, 5);
    await updateDomainListFile(model, baseDir);
    assert.deepStrictEqual((await query({ refresh: true, sourcePid: process.pid })).domains, [ 'new.test' ]);

    const prodDir = path.join(baseDir, 'production');
    let startupUpdates = 0;
    await boot({
      baseDir: prodDir, config: { env: 'prod', coreMiddleware: [] },
      logger: { warn() {} }, messenger: { on() {} },
      createAnonymousContext: () => ({ service: { domain: { async updateAllDomainList() {
        startupUpdates++;
        await updateDomainListFile(model, prodDir);
      } } } }),
    }).willReady();
    assert.strictEqual(startupUpdates, 1);
    assert.strictEqual(fs.readFileSync(path.join(prodDir, 'app/local_data/allDomainList.txt'), 'utf8'), 'new.test\n');
    assert.deepStrictEqual(Array.from(getDomainHostList(prodDir).domains), [ 'new.test' ]);

    // An older in-flight read must never overwrite a newer write or reload.
    const raceDir = path.join(baseDir, 'race');
    const readFile = fs.promises.readFile;
    const pending = [];
    fs.promises.readFile = () => new Promise((resolve, reject) => pending.push({ resolve, reject }));
    try {
      const initial = getDomainHostList(raceDir);
      setDomainHostList(raceDir, 'written.test\n');
      pending.shift().resolve('stale.test\n');
      assert((await initial).domains.has('written.test'));
      const older = reloadDomainHostList(raceDir);
      const newer = reloadDomainHostList(raceDir);
      const oldRead = pending.shift();
      pending.shift().resolve('latest.test\n');
      await newer;
      oldRead.resolve('stale.test\n');
      assert((await older).domains.has('latest.test'));
      const failing = reloadDomainHostList(raceDir);
      setDomainHostList(raceDir, 'saved.test\n');
      pending.shift().reject(new Error('old read failed'));
      assert((await failing).domains.has('saved.test'));
    } finally {
      fs.promises.readFile = readFile;
    }

    let attempts = 0;
    fs.promises.readFile = async () => {
      if (++attempts < 3) throw Object.assign(new Error('temporary read failure'), { code: 'EBUSY' });
      return 'retried.test\n';
    };
    try {
      const list = await reloadDomainHostList(path.join(baseDir, 'retry'));
      assert(list.domains.has('retried.test'));
      assert.strictEqual(attempts, 3);
      const retryDir = path.join(baseDir, 'cancelled-retry');
      attempts = 0;
      const pending = reloadDomainHostList(retryDir);
      await new Promise(resolve => setImmediate(resolve));
      setDomainHostList(retryDir, 'saved-before-retry.test\n');
      assert((await pending).domains.has('saved-before-retry.test'));
      assert.strictEqual(attempts, 1, 'A newer update must cancel obsolete retries');
    } finally {
      fs.promises.readFile = readFile;
    }
    console.log('PASS: startup preload, worker update notifications, memory-only lookups, bounded read retries and stale read protection');
  } finally {
    if (child) {
      await new Promise(resolve => {
        if (child.exitCode !== null || child.signalCode !== null) return resolve();
        child.once('exit', resolve);
        child.kill();
      });
    }
    assert(path.resolve(baseDir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.promises.rm(baseDir, { recursive: true, force: true });
  }
}

(process.argv[2] === 'worker' ? worker(process.argv[3]) : main())
  .catch(error => { console.error(error); process.exitCode = 1; });
