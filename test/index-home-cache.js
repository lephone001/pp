'use strict';

// node test/index-home-cache.js: exercise the real homepage controller with mocked I/O.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../app/controller/page/index.js'), 'utf8');
const now = Date.parse('2026-10-16T04:30:00Z');
const week = 7 * 24 * 60 * 60 * 1000;
const homeFile = '/cache/home/example.test/index.html';
const cachedHtml = '<html><head><title>Home</title></head><body>cached page</body></html>';

class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [ now ])); }
  static now() { return now; }
}

function setup(options = {}) {
  const calls = { stats: [], reads: [], writes: [], queries: [], renders: [], warnings: [], movie: 0, nav: 0 };
  const files = new Map();
  if (!options.missing) files.set(homeFile, {
    text: cachedHtml,
    mtimeMs: now - (options.age === undefined ? week + 1 : options.age),
    birthtime: new Date(now - 90 * week),
  });
  for (let i = 0; i < 10; i++) {
    files.set('/cache/article_list/index' + (i || '') + '.json', {
      text: JSON.stringify([ { title: 'old list data' } ]), mtimeMs: now,
    });
  }
  const domain = {
    _id: 'domain-id', link: 'example.test', fullDomain: 'example.test', tname: 'home_test',
    title: 'Home', iscache: true, siteType: 11, isOpenUrl: -1, ispcpage: 1,
    agentLink: {}, cids: [], navcids: [], ...options.domain,
  };
  const fakeFs = { promises: {
    async stat(filename) {
      calls.stats.push(filename);
      if (options.statGate) await options.statGate;
      if (!files.has(filename)) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
      return files.get(filename);
    },
    async readFile(filename) {
      calls.reads.push(filename);
      if (!files.has(filename) || options.readError) throw new Error('Cannot read');
      return files.get(filename).text;
    },
    async mkdir() {},
    async access() { throw new Error('No mobile template'); },
    async writeFile(filename, text) {
      if (options.writeGate) await options.writeGate;
      if (options.writeError) throw new Error('Cannot write');
      calls.writes.push(filename);
      files.set(filename, { text, mtimeMs: now });
    },
  } };
  const modelRows = {
    Article: [ { title: 'latest article' } ], App: [ { title: 'latest app' } ],
    Domain: [ { title: 'latest domain' } ], NavCategory: [ { details: [], isHot: true } ],
  };
  const models = {};
  for (const [name, rows] of Object.entries(modelRows)) models[name] = {
    find(criteria) {
      calls.queries.push({ name, criteria });
      if (options.dbError) throw new Error('Database unavailable');
      const query = {
        sort() { return this; }, limit() { return this; }, select() { return this; }, populate() { return this; },
        then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
      };
      return query;
    },
  };
  const ctx = {
    hostname: 'example.test', query: options.query || {}, url: '/', request: { header: {}, url: '/' },
    app: { config: { cacheFile: '/cache/', MY_USER_CONFIG: {}, common: { UPDATE_ALLPAGE: options.updateAllPage } } },
    logger: { warn(...args) { calls.warnings.push(args); } }, model: models,
    service: {
      utils: { getSiteInfo: async () => ({ site: {}, domain }), randomWord: () => 'abc', randomNumber: () => '123' },
      movie: { async homeData() { calls.movie++; return { latest: [ { name: 'latest movie' } ] }; } },
      app: { getappjsondata: async () => [ { title: 'old app data' } ] },
      nav: { async getNavCagegoryNavList() { calls.nav++; return []; } },
      domain: { domainJSONListCerate() { throw new Error('Unexpected background refresh'); } },
    },
    async render(template, data) {
      calls.renders.push({ template, data });
      if (options.renderError && template.startsWith('/template/')) throw new Error('Cannot render');
      this.body = data ? '<html><body>' + JSON.stringify(data) + '</body></html>' : 'Error page';
    },
  };
  const dependencies = {
    egg: { Controller: class { constructor() { this.ctx = ctx; this.service = ctx.service; } } },
    fs: fakeFs, path, crypto: require('crypto'), net: require('net'), punycode: require('punycode'),
    moment: Object.assign(() => ({ format: () => '2026-10-16' }), { locale() {} }),
    axios: {}, 'iconv-lite': {}, './imglist': [], '../../utils/templateExistsCache': {},
  };
  const moduleRef = { exports: {} };
  vm.runInNewContext(source, {
    module: moduleRef, require: name => {
      assert(Object.prototype.hasOwnProperty.call(dependencies, name), 'Unexpected module: ' + name);
      return dependencies[name];
    },
    Date: FixedDate, process: { cwd: () => '/project' }, console: { log() {} },
  });
  return { ctx, calls, files, run: () => new moduleRef.exports().indexPage() };
}

async function main() {
  for (const age of [ 0, week - 1, week ]) {
    const probe = setup({ age });
    await probe.run();
    assert.strictEqual(probe.ctx.body, cachedHtml);
    assert.strictEqual(probe.calls.movie, 0);
    assert.strictEqual(probe.calls.writes.length, 0);
  }
  for (const options of [ {}, { age: week * 2 }, { missing: true }, { age: 0, readError: true } ]) {
    const probe = setup(options);
    await probe.run();
    assert(probe.ctx.body.includes('latest movie'));
    assert.strictEqual(probe.calls.movie, 1);
    assert.deepStrictEqual(probe.calls.writes, [ homeFile ]);
    assert.strictEqual(probe.files.get(homeFile).text, probe.ctx.body);
    assert.strictEqual(probe.files.get(homeFile).mtimeMs, now);
    if (!options.readError) {
      await probe.run();
      assert.strictEqual(probe.calls.movie, 1, 'An overwritten cache must start a new seven-day lifetime');
    }
  }
  const manual = setup({ age: 60 * 1000, updateAllPage: new Date(now - 1000).toISOString() });
  await manual.run();
  assert.strictEqual(manual.calls.movie, 1);
  const invalidManual = setup({ age: 0, updateAllPage: 'invalid date' });
  await invalidManual.run();
  assert.strictEqual(invalidManual.calls.movie, 0);

  const article = setup({ domain: { siteType: 4, tname: 'article_xiazai_02' } });
  await article.run();
  assert(article.ctx.body.includes('latest article'));
  assert(article.ctx.body.includes('latest app'));
  assert(!article.ctx.body.includes('old list data'));
  assert(!article.ctx.body.includes('old app data'));
  assert.deepStrictEqual(article.calls.queries.map(query => query.name), [ 'Article', 'App' ]);
  const freshArticle = setup({ age: 0, domain: { siteType: 4 } });
  await freshArticle.run();
  assert.strictEqual(freshArticle.calls.queries.length, 0);

  const seonav = setup({ domain: { siteType: 5 } });
  await seonav.run();
  assert(seonav.ctx.body.includes('latest domain'));
  assert(!seonav.calls.reads.some(filename => filename.endsWith('seonav.json')));
  const nav = setup({ domain: { siteType: 8, navcids: [ 'category-id' ] } });
  await nav.run();
  assert.strictEqual(nav.calls.nav, 0, 'An expired homepage must bypass the navigation file cache');
  assert.deepStrictEqual(nav.calls.queries.map(query => query.name), [ 'NavCategory' ]);

  const staticPage = setup({ domain: { isStaticPage: 1 } });
  await staticPage.run();
  assert.deepStrictEqual(staticPage.calls.writes, [ homeFile ]);
  for (const options of [ { domain: { iscache: false } }, { query: { page: '2' } } ]) {
    const probe = setup(options);
    await probe.run();
    assert.strictEqual(probe.calls.writes.length, 0, 'Keep existing cache-disable and query-string behavior');
  }
  const writeFailure = setup({ writeError: true });
  await writeFailure.run();
  assert(writeFailure.ctx.body.includes('latest movie'));
  assert.strictEqual(writeFailure.files.get(homeFile).text, cachedHtml);
  assert.strictEqual(writeFailure.calls.warnings.length, 1);
  const renderFailure = setup({ renderError: true });
  await renderFailure.run();
  assert.strictEqual(renderFailure.calls.writes.length, 0);
  for (const siteType of [ 4, 5, 8 ]) {
    const probe = setup({ dbError: true, domain: { siteType } });
    await assert.rejects(probe.run(), /Database unavailable/);
    assert.strictEqual(probe.files.get(homeFile).text, cachedHtml);
    assert.strictEqual(probe.calls.writes.length, 0);
  }

  let releaseStat;
  const statGate = new Promise(resolve => { releaseStat = resolve; });
  const waiting = setup({ statGate });
  const request = waiting.run();
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(waiting.ctx.body, undefined, 'Wait for stat before responding with cached HTML');
  releaseStat();
  await request;
  assert.strictEqual(waiting.calls.movie, 1);

  let releaseWrite;
  const writeGate = new Promise(resolve => { releaseWrite = resolve; });
  const writing = setup({ writeGate });
  let finished = false;
  const response = writing.run().then(() => { finished = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(finished, false, 'Wait for the replacement cache write to finish');
  releaseWrite();
  await response;
  assert.deepStrictEqual(writing.calls.writes, [ homeFile ]);
  console.log('PASS: homepage cache freshness, database refresh, overwrite, manual invalidation, and failure handling.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
