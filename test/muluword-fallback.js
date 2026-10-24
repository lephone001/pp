'use strict';

// node test/muluword-fallback.js；提取真实方法，模拟文件缓存和数据库，不发起网络请求。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const acorn = require('acorn');
const source = fs.readFileSync(path.join(__dirname, '../app/service/utils.js'), 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 2020 });
const helper = ast.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'normalizeMuluWord');
const cls = ast.body.find(node => node.type === 'ClassDeclaration');
const names = [ 'strToNumber', 'getMuluWordCount', 'getMuluItemOne', 'allPage' ];
const methods = cls.body.body.filter(node => names.includes(node.key.name)).map(node => source.slice(node.start, node.end)).join('\n');
const globals = ast.body.filter(node => node.type === 'VariableDeclaration' && node.declarations.some(declaration =>
  [ 'MULU_COUNT_CACHE_MS', 'muluWordCounts' ].includes(declaration.id.name))).map(node => source.slice(node.start, node.end)).join('\n');
const code = globals + '\n' + source.slice(helper.start, helper.end) + '\nclass Probe {' + methods + '}\nmodule.exports = Probe;';
const defaultWord = { title: 'Site title', keyWords: 'Site keywords', description: 'Site description' };
const goodWord = { title: 'Directory word', keywords: 'Word keywords', description: 'Word description' };

function setup({ cache, row = null, rows, num = 10007, url = '/sadfasd', browserType = 'normal', hasTemplate = false,
  titleType = 0, dbError, countResult, overrideWord } = {}) {
  const queries = [];
  const counts = [];
  const library = rows ? rows.map(item => ({ ...item })) : row
    ? [{ mcid: 'category', _id: 'word', ...(typeof row.toObject === 'function' ? row.toObject() : row) }] : [];
  const writes = [];
  const warnings = [];
  const rendered = [];
  let now = 1000000;
  class TestDate extends Date { static now() { return now; } }
  const mod = { exports: {} };
  const fakeFs = {
    readFileSync: filename => {
      if (filename.includes('/mulu/')) {
        if (cache === undefined) { const error = new Error('missing cache'); error.code = 'ENOENT'; throw error; }
        return cache;
      }
      if (filename.includes('/app/public/html/')) return '<html><head><title>Base</title><meta name="description" content="description"></head><body>Page</body></html>';
      if (filename.includes('/article/youxi/')) return JSON.stringify({ title: 'Article', content: '<p>Body</p>' });
      const error = new Error('missing file'); error.code = 'ENOENT'; throw error;
    },
    existsSync: () => false,
    statSync: () => ({ isFile: () => hasTemplate }),
    writeFile: (filename, data) => writes.push({ filename, data }),
  };
  vm.runInNewContext(code, {
    module: mod, CryptoJS: require('crypto-js'), fs: fakeFs, path, isIP: require('net').isIP,
    templateExists: () => hasTemplate, process: { cwd: () => process.cwd() }, Date: TestDate,
  });
  const service = new mod.exports();
  const domain = { ...defaultWord, fullDomain: 'www.luban7.cn', tname: 'demo', isMuLu: true, mcid: { _id: 'category', num },
    isMobile: true, ispcpage: 1, isOpenUrl: 0, browserType, titleType, openUrlStatusCode: 200,
    urlNumber: 123, banBenNumber: 'V1.2.3', agentLink: { isAgentPage: true, agentPageName: 'sbb02', gajs: '' } };
  service.getSiteInfo = async () => ({ domain });
  service.urlToStr = () => 'letters';
  service.urlToemoj = () => 'symbol';
  service.ctx = {
    request: { header: { host: domain.fullDomain } }, header: { host: domain.fullDomain }, url, path: url,
    hostname: domain.fullDomain, app: { config: { cacheFile: '/cache/' } },
    logger: { warn: (...args) => warnings.push(args) },
    model: { Mulu: {
      findOne: criteria => {
        const query = { ...criteria };
        queries.push(query);
        let offset = 0;
        let sorted = false;
        const execute = () => {
          if (dbError) throw dbError;
          if (criteria.index !== undefined) {
            return rows ? library.find(item => String(item.mcid) === String(criteria.mcid) && item.index === criteria.index) || null : row;
          }
          let candidates = library.filter(item => String(item.mcid) === String(criteria.mcid)
            && typeof item.title === 'string' && /\S/.test(item.title));
          if (sorted) candidates = candidates.sort((a, b) => Number(a.index || 0) - Number(b.index || 0) || String(a._id).localeCompare(String(b._id)));
          return candidates[offset] || null;
        };
        const chain = {
          sort: order => { sorted = true; query.sort = order; return chain; },
          skip: value => { offset = value; query.skip = value; return chain; },
          lean: async () => execute(),
          then: (resolve, reject) => Promise.resolve().then(execute).then(resolve, reject),
        };
        return chain;
      },
      countDocuments: async criteria => {
        counts.push(criteria);
        if (dbError) throw dbError;
        if (countResult !== undefined) return typeof countResult === 'function' ? countResult() : countResult;
        return library.filter(item => String(item.mcid) === String(criteria.mcid)
          && typeof item.title === 'string' && /\S/.test(item.title)).length;
      },
    } },
    service: { utils: service },
    render: async (template, data) => { rendered.push({ template, data }); service.ctx.body = 'rendered'; },
  };
  if (overrideWord !== undefined) service.getMuluItemOne = async () => overrideWord;
  return { service, domain, queries, counts, library, writes, warnings, rendered, advance: ms => { now += ms; } };
}

async function main() {
  const missing = setup();
  const emptyWord = await missing.service.getMuluItemOne(12, { _id: 'category', num: 10 });
  assert.strictEqual(emptyWord.title, ''); assert.strictEqual(emptyWord.description, ''); assert.strictEqual(emptyWord.keywords, '');
  assert.strictEqual(missing.queries[0].index, 2);
  assert.strictEqual(missing.writes.length, 0); assert.strictEqual(missing.warnings.length, 1);
  assert.strictEqual(missing.counts.length, 1);
  assert.strictEqual(missing.warnings[0][1], 'category'); assert.strictEqual(missing.warnings[0][2], '/sadfasd');

  for (const cache of [ 'null', '[]', '{}', '"bad"', '', '{invalid' ]) {
    const invalid = setup({ cache, row: goodWord });
    const word = await invalid.service.getMuluItemOne(12, { _id: 'category', num: 10 });
    assert.strictEqual(word.title, goodWord.title); assert.strictEqual(invalid.queries.length, 1);
    assert.strictEqual(invalid.writes.length, 1); assert.strictEqual(invalid.warnings.length, 0);
  }
  const cached = setup({ cache: JSON.stringify({ ...goodWord, index: 2 }) });
  assert.strictEqual((await cached.service.getMuluItemOne(12, { _id: 'category', num: 10 })).index, 2);
  assert.strictEqual(cached.queries.length, 0);
  const document = setup({ row: { title: 'Word', toObject: () => ({ title: 'Word', keywords: 0, description: 123, index: 2 }) } });
  const word = await document.service.getMuluItemOne(12, { _id: 'category', num: 10 });
  assert.strictEqual(word.title, 'Word'); assert.strictEqual(word.keywords, '0'); assert.strictEqual(word.description, '123');
  assert.strictEqual(word.index, 2);
  for (const num of [ 0, -1, 1.5, 'invalid', undefined ]) {
    const invalid = setup({ num });
    assert.strictEqual((await invalid.service.getMuluItemOne(10, { _id: 'category', num })).title, '');
    assert.strictEqual(invalid.queries.length, 0);
  }
  const zero = setup({ row: goodWord });
  await zero.service.getMuluItemOne(0, { _id: 'category', num: 10 });
  assert.strictEqual(zero.queries[0].index, 0);
  const numeric = setup({ row: goodWord });
  await numeric.service.getMuluItemOne('12', { _id: 'category', num: '10' });
  assert.strictEqual(numeric.queries[0].index, 2);
  const dbFailure = setup({ dbError: new Error('database unavailable') });
  await assert.rejects(dbFailure.service.getMuluItemOne(12, { _id: 'category', num: 10 }), /database unavailable/);

  const sparseRows = [
    { ...goodWord, title: 'Last word', mcid: 'category', index: 9000, _id: 'c' },
    { ...goodWord, title: 'First word', mcid: 'category', index: 1000, _id: 'a' },
    { ...goodWord, title: 'Middle word', mcid: 'category', index: 5000, _id: 'b' },
    { ...goodWord, title: '', mcid: 'category', index: 10, _id: 'empty' },
    { ...goodWord, title: '   ', mcid: 'category', index: 20, _id: 'blank' },
    { ...goodWord, title: 'Foreign word', mcid: 'other-category', index: 0, _id: 'foreign' },
  ];
  const sparse = setup({ rows: sparseRows, num: 3 });
  const expected = [ 'First word', 'Middle word', 'Last word' ];
  for (let seed = 0; seed < 9; seed++) {
    const picked = await sparse.service.getMuluItemOne(seed, sparse.domain.mcid);
    assert.strictEqual(picked.title, expected[seed % 3]); assert.strictEqual(picked.mcid, 'category');
  }
  assert.strictEqual(sparse.counts.length, 1);
  assert(sparse.writes.every(write => /category-(1000|5000|9000)\.json$/.test(write.filename)));
  sparse.advance(60001);
  await sparse.service.getMuluItemOne(2, sparse.domain.mcid);
  assert.strictEqual(sparse.counts.length, 2);
  for (const num of [ 0, -1, 1.5, 'invalid', undefined, 2, 100000 ]) {
    const stale = setup({ rows: sparseRows, num });
    for (let seed = 0; seed < 3; seed++) {
      assert.strictEqual((await stale.service.getMuluItemOne(seed, stale.domain.mcid)).title, expected[seed]);
    }
    assert.strictEqual(stale.warnings.length, 0);
  }
  const duplicated = setup({ rows: [
    { ...goodWord, title: 'B', mcid: 'category', index: 100, _id: 'b' },
    { ...goodWord, title: 'A', mcid: 'category', index: 100, _id: 'a' },
  ], num: 2 });
  assert.strictEqual((await duplicated.service.getMuluItemOne(0, duplicated.domain.mcid)).title, 'A');
  assert.strictEqual((await duplicated.service.getMuluItemOne(1, duplicated.domain.mcid)).title, 'B');
  const wrongCache = setup({ cache: JSON.stringify({ ...goodWord, mcid: 'other-category', index: 0 }), rows: sparseRows, num: 3 });
  assert.strictEqual((await wrongCache.service.getMuluItemOne(0, wrongCache.domain.mcid)).title, 'First word');
  const wrongIndex = setup({ cache: JSON.stringify({ ...goodWord, mcid: 'category', index: 9000 }), rows: sparseRows, num: 3 });
  assert.strictEqual((await wrongIndex.service.getMuluItemOne(0, wrongIndex.domain.mcid)).title, 'First word');
  const idOnly = setup({ rows: sparseRows });
  assert.strictEqual((await idOnly.service.getMuluItemOne(1, 'category')).title, 'Middle word');
  const concurrent = setup({ rows: sparseRows, num: 0, countResult: () => new Promise(resolve => setTimeout(() => resolve(3), 5)) });
  const concurrentWords = await Promise.all([0, 1, 2].map(seed => concurrent.service.getMuluItemOne(seed, concurrent.domain.mcid)));
  assert.deepStrictEqual(concurrentWords.map(word => word.title), expected);
  assert.strictEqual(concurrent.counts.length, 1);
  const deletion = setup({ rows: sparseRows.slice(0, 2), num: 2, countResult: 3 });
  assert.strictEqual((await deletion.service.getMuluItemOne(2, deletion.domain.mcid)).title, 'First word');
  await deletion.service.getMuluItemOne(2, deletion.domain.mcid);
  assert.strictEqual(deletion.counts.length, 2);
  const imported = setup({ rows: [], num: 0 });
  assert.strictEqual((await imported.service.getMuluItemOne(1, imported.domain.mcid)).title, '');
  imported.library.push({ ...goodWord, mcid: 'category', index: 1000, _id: 'new' });
  assert.strictEqual((await imported.service.getMuluItemOne(1, imported.domain.mcid)).title, goodWord.title);
  assert.strictEqual(imported.counts.length, 2);
  let countAttempts = 0;
  const countFailure = setup({ rows: sparseRows, num: 0, countResult: () => {
    if (++countAttempts === 1) throw new Error('count temporarily unavailable'); return 3;
  } });
  await assert.rejects(countFailure.service.getMuluItemOne(1, countFailure.domain.mcid), /count temporarily unavailable/);
  assert.strictEqual((await countFailure.service.getMuluItemOne(1, countFailure.domain.mcid)).title, 'Middle word');

  for (const url of [ '/sa', '/sadfasd', '/sadfasdf', '/local/.env' ]) {
    const page = setup({ url });
    await page.service.allPage();
    assert.strictEqual(page.service.ctx.status, 200);
    assert(page.service.ctx.body.includes(defaultWord.title));
    assert(page.service.ctx.body.includes(defaultWord.description));
    assert.strictEqual(page.queries[0].index, page.service.strToNumber(page.domain.fullDomain + url) % page.domain.mcid.num);
    assert.strictEqual(page.warnings.length, 1);
  }
  const valid = setup({ row: goodWord });
  await valid.service.allPage();
  assert.strictEqual(valid.service.ctx.status, 200); assert(valid.service.ctx.body.includes(goodWord.title));
  assert(valid.service.ctx.body.includes(goodWord.description)); assert.strictEqual(valid.warnings.length, 0);
  for (const url of [ '/sa', '/sadfas', '/sadfasd', '/sadfasdf' ]) {
    const page = setup({ rows: sparseRows, num: 3, url });
    await page.service.allPage();
    assert.strictEqual(page.service.ctx.status, 200);
    const title = expected[page.service.strToNumber(page.domain.fullDomain + url) % 3];
    assert(page.service.ctx.body.includes(title));
    assert(!page.service.ctx.body.includes(defaultWord.title));
    assert.strictEqual(page.warnings.length, 0);
  }
  for (const row of [ { title: 'Word' }, { title: 'Word', description: null }, { title: 'Word', description: 123 } ]) {
    const partial = setup({ row });
    await partial.service.allPage();
    assert.strictEqual(partial.service.ctx.status, 200);
    assert(partial.service.ctx.body.includes(row.description === 123 ? '123' : defaultWord.description));
  }
  // 即使其他实现直接返回 null，allPage 本身也有兜底，两个浏览分支都可返回页面。
  for (const browserType of [ 'normal', 'baidu01', 'baidu02' ]) {
    const overridden = setup({ browserType, overrideWord: null });
    await overridden.service.allPage();
    assert.strictEqual(overridden.service.ctx.status, 200);
    assert(overridden.service.ctx.body.includes(defaultWord.title));
  }
  for (const titleType of [ -1, 1, 3 ]) {
    const template = setup({ row: goodWord, hasTemplate: true, titleType });
    await template.service.allPage();
    const data = template.rendered[0].data;
    assert.strictEqual(data.mtdk.title, titleType === 1 ? 'www.luban7.cn/sadfasd' : '');
    if (titleType === -1) { assert.strictEqual(data.mtdk.description, ''); assert.strictEqual(data.mtdk.keywords, ''); }
  }
  console.log('PASS: real category words selected with sparse/duplicate indices or stale/missing counts; deterministic ordering and category isolation; count caching/recovery; no cache aliases at missing indices; allPage paths use actual words; empty library and template safety; no database or network changes');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
