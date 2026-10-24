'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../app/service/autoArticle.js'), 'utf8');
const date = '20261017';

function setup(root, options = {}) {
  const calls = [];
  const errors = [];
  const articleDir = path.join(root, 'jingtai/article', date);
  const mapDir = articleDir + 'map';
  const fakeMoment = () => ({ format: () => date });
  fakeMoment.locale = () => {};
  const fakeFs = {
    ...fs,
    readdir(directory, callback) {
      assert(fs.statSync(directory).isDirectory());
      callback(null, []);
    },
    readFileSync() { throw options.stopBeforeGeneration || new Error('Unexpected word library access'); },
    promises: {
      ...fs.promises,
      async mkdir(directory, config) {
        if (options.mkdirError) throw options.mkdirError;
        return fs.promises.mkdir(directory, config);
      },
      async writeFile(filename, content) {
        if (options.writeGate && filename.endsWith('0.html')) {
          options.writeStarted();
          await options.writeGate;
        }
        if (options.writeError && filename.endsWith('.xml')) throw new Error('sitemap write failed');
        return fs.promises.writeFile(filename, content);
      },
    },
  };
  const axios = async config => {
    calls.push(config);
    assert(fs.statSync(articleDir).isDirectory());
    assert(fs.statSync(mapDir).isDirectory(), 'Map directory must exist before any download');
    if (config.method === 'post') {
      if (options.countError) throw new Error('count request failed');
      return { data: { data: { numIndex: options.count === undefined ? 2 : options.count } } };
    }
    if (options.downloadError && config.url.endsWith('.xml')) throw new Error('sitemap download failed');
    return { status: 200, data: 'mock:' + config.url.split('/').pop() };
  };
  const mod = { exports: {} };
  vm.runInNewContext(source, {
    module: mod, __dirname: path.join(__dirname, '../app/service'),
    process: { cwd: () => root }, console, setTimeout, clearTimeout,
    require(name) {
      if (name === 'egg') return { Service: class { constructor(ctx) { this.ctx = ctx; } } };
      if (name === 'moment') return fakeMoment;
      if (name === 'fs') return fakeFs;
      if (name === 'axios') return axios;
      if (name.startsWith('./datajson/')) return {};
      throw new Error('Unexpected dependency: ' + name);
    },
  });
  const service = new mod.exports({
    logger: { error: (...args) => errors.push(args) },
    service: { utils: { delay: async () => {} } },
  });
  return { service, calls, errors, articleDir, mapDir };
}

async function main() {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'auto-article-static-'));
  const unhandled = [];
  const onUnhandled = error => unhandled.push(error);
  process.on('unhandledRejection', onUnhandled);
  try {
    const fresh = setup(path.join(root, 'missing-parents'));
    assert.strictEqual((await fresh.service.getArticlejthtml()).code, 200);
    assert.strictEqual(fs.readFileSync(path.join(fresh.articleDir, '0.html'), 'utf8'), 'mock:0.html');
    assert.strictEqual(fs.readFileSync(path.join(fresh.articleDir, '1.html'), 'utf8'), 'mock:1.html');
    for (const extension of ['txt', 'xml', 'html']) {
      assert.strictEqual(fs.readFileSync(path.join(fresh.mapDir, 'sitemap.' + extension), 'utf8'), 'mock:sitemap.' + extension);
    }
    assert.strictEqual((await fresh.service.getArticlejthtml()).code, 200, 'Repeated directory creation must be safe');

    const missingMap = setup(path.join(root, 'missing-map'), { count: 0 });
    await fs.promises.mkdir(missingMap.articleDir, { recursive: true });
    assert.strictEqual((await missingMap.service.getArticlejthtml()).code, 200);
    assert(fs.existsSync(path.join(missingMap.mapDir, 'sitemap.xml')));

    const concurrent = setup(path.join(root, 'concurrent'), { count: 0 });
    const results = await Promise.all([concurrent.service.getArticlejthtml(), concurrent.service.getArticlejthtml()]);
    assert(results.every(result => result.code === 200));

    let releaseWrite, writeStarted;
    const writeGate = new Promise(resolve => { releaseWrite = resolve; });
    const started = new Promise(resolve => { writeStarted = resolve; });
    const waiting = setup(path.join(root, 'waiting-for-write'), { writeGate, writeStarted });
    let finished = false;
    const pending = waiting.service.getArticlejthtml().then(result => { finished = true; return result; });
    await started;
    assert.strictEqual(finished, false, 'Success must wait for file writes');
    releaseWrite();
    assert.strictEqual((await pending).code, 200);

    const denied = setup(path.join(root, 'mkdir-failure'), {
      mkdirError: Object.assign(new Error('read-only filesystem'), { code: 'EROFS' }),
    });
    assert.strictEqual((await denied.service.getArticlejthtml()).code, -1);
    assert.strictEqual(denied.calls.length, 0);
    assert.strictEqual(denied.errors.length, 1);
    for (const [name, options] of [
      ['count-failure', { countError: true }], ['invalid-count', { count: 'invalid' }],
      ['download-failure', { downloadError: true }], ['write-failure', { writeError: true }],
    ]) {
      const probe = setup(path.join(root, name), options);
      assert.strictEqual((await probe.service.getArticlejthtml()).code, -1, name);
      assert.strictEqual(probe.errors.length, 1, name);
    }

    // The local article generator uses the same directory creation paths.
    const stopBeforeGeneration = new Error('stop before article generation');
    const generator = setup(path.join(root, 'generator'), { stopBeforeGeneration });
    await assert.rejects(generator.service.piArticlejtCreate([]), error => error === stopBeforeGeneration);
    assert(fs.statSync(generator.articleDir).isDirectory());
    assert(fs.statSync(generator.mapDir).isDirectory());
    await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(unhandled.length, 0);
    console.log('PASS: missing parents/map directory, repeated/concurrent runs, awaited writes, handled I/O/network failures and generator directories');
  } finally {
    process.removeListener('unhandledRejection', onUnhandled);
    assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.promises.rm(root, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
