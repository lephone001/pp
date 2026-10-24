'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const nunjucks = require('nunjucks');
const Router = require('@eggjs/router');
const feed = require('../app/lib/wenzhangFeed');
const Service = require('../app/service/wenzhang');
const Page = require('../app/controller/page/wenzhang');
const id = '507f1f77bcf86cd799439011';
async function main() {
  const rss = '<rss><channel><item><title>A &amp; B</title><link>https://example.com/post</link><description><![CDATA[<p>Hello<script>bad()</script><img src="/a.jpg" onerror="bad()"><a href="javascript:bad()">x</a></p>]]></description><pubDate>Fri, 25 Sep 2026 00:00:00 GMT</pubDate></item><item><title>Duplicate</title><link>https://example.com/post</link></item></channel></rss>';
  const parsed = feed.parseFeed(rss, 'https://example.com/feed', 20);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, 'A & B');
  assert.equal(parsed[0].image, 'https://example.com/a.jpg');
  assert(!/script|onerror|javascript:|bad\(\)/.test(parsed[0].content));
  assert.equal(feed.url('', 'https://example.com'), '');
  const atom = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom</title><link rel="alternate" href="/article"/><content type="html">&lt;p&gt;Body&lt;/p&gt;</content></entry></feed>';
  assert.equal(feed.parseFeed(atom, 'https://example.com/feed')[0].sourceUrl, 'https://example.com/article');
  assert.throws(() => feed.parseFeed('<html>error</html>', 'https://example.com'), /RSS/);
  for (const address of [ '127.0.0.1', '10.1.2.3', '192.168.1.1', '169.254.169.254', '172.20.0.1', '::1' ]) assert(!feed.publicIPv4(address));
  assert(feed.publicIPv4('8.8.8.8'));
  const baseDir = fs.mkdtempSync(path.join(__dirname, '.wenzhang-test-'));
  let databaseReads = 0;
  let row = { _id: id, title: 'First', status: 1, content: '<p>Body</p>' };
  const ctx = { app: { baseDir }, model: {
    Wenzhang: {
      findById: () => ({ lean: async () => { databaseReads++; return row; } }),
      findOneAndUpdate: (_, update) => ({ lean: async () => (row = { ...row, ...update.$set }) }),
      findByIdAndUpdate: (_, update) => ({ lean: async () => (row = { ...row, ...update.$set }) }),
    },
  } };
  const service = Object.create(Service.prototype); service.ctx = ctx; service.app = ctx.app;
  try {
    assert.equal((await service.detail(id)).title, 'First');
    assert.equal((await service.detail(id)).title, 'First');
    assert.equal(databaseReads, 1, 'second detail reads JSON rather than MongoDB');
    const hash = require('crypto').createHash('md5').update(id).digest('hex');
    assert.equal(service.cachePath(id), path.join(service.root, hash.slice(0, 2), hash.slice(2, 4), id + '.json'));
    assert(fs.existsSync(service.cachePath(id)));
    fs.renameSync(service.cachePath(id), service.legacyCachePath(id));
    assert.equal((await service.detail(id)).title, 'First');
    assert.equal(databaseReads, 1, 'legacy migration does not query database');
    assert(fs.existsSync(service.cachePath(id)));
    assert(!fs.existsSync(service.legacyCachePath(id)));
    fs.writeFileSync(service.legacyCachePath(id), JSON.stringify(row));
    await service.save({ _id: id, title: 'Edited', content: '<script>bad()</script><p>Edited</p>', status: 1 });
    assert.equal((await service.detail(id)).title, 'Edited');
    assert(!fs.existsSync(service.legacyCachePath(id)), 'editing clears legacy copy');
    await service.remove(id);
    assert.equal(await service.detail(id), null, 'deleted article cache becomes tombstone');
    await assert.rejects(() => service.detail('../outside'), /ID/);

    // Use the real collection workflow with bounded fixtures and mocked database writes.
    const originalFetch = feed.fetchFeed;
    let source = { _id: id, name: 'Test feed', url: 'https://example.com/feed', limit: 20, enabled: true, auto: true, runningUntil: new Date(0) };
    let exists = false;
    ctx.model.WenzhangSource = {
      findOneAndUpdate(filter, update) { return { lean: async () => {
        if (!source.enabled || source.runningUntil > new Date() ||
          (filter.lastDate && source.lastDate === filter.lastDate.$ne)) return null;
        source = { ...source, ...update.$set }; return { ...source };
      } }; },
      async updateOne(filter, update) { source = { ...source, ...update.$set }; },
    };
    ctx.model.Wenzhang.updateOne = async (filter, update) => {
      if (exists) return { upsertedCount: 0 };
      exists = true; row = { _id: id, ...update.$setOnInsert }; return { upsertedCount: 1 };
    };
    ctx.model.Wenzhang.findOne = () => ({ select() { return this; }, lean: async () => ({ _id: id }) });
    feed.fetchFeed = async () => ({ text: rss.replace('A &amp; B', '软件工具评测'), url: source.url });
    try {
      assert.equal((await service.collect(id, '2026-09-25')).inserted, 1);
      await assert.rejects(() => service.collect(id, '2026-09-25'), /今天/);
      assert.equal((await service.collect(id)).skipped, 1);
      feed.fetchFeed = async () => ({ text: rss.replace('A &amp; B', '民生新闻：养老金调整'), url: source.url });
      const blocked = await service.collect(id);
      assert.equal(blocked.filtered, 1);
      assert.equal(blocked.inserted + blocked.skipped + blocked.failed, 0, 'excluded articles never reach database');
      feed.fetchFeed = async () => ({ text: rss.replace('A &amp; B', '软件工具评测'), url: source.url });
      await service.remove(id);
      await service.collect(id);
      assert.equal(await service.detail(id), null, 'collection must not resurrect deleted articles');
      feed.fetchFeed = async () => { throw new Error('network failure'); };
      await assert.rejects(() => service.collect(id), /network failure/);
      assert.equal(source.runningUntil.getTime(), 0, 'failed collection releases its lease');
      assert(source.lastResult.includes('network failure'));
    } finally { feed.fetchFeed = originalFetch; }

    const page = Object.create(Page.prototype);
    let template;
    page.ctx = { path: '/WenZhang/' + id + '.html', query: {}, app: { baseDir }, set() {},
      service: { utils: { getSiteInfo: async () => ({ domain: { tname: 'custom', fullDomain: 'example.test', mcid: { _id: id, num: 10 } } }) },
        fanmuluArticle: { getPool: async () => [] },
        wenzhang: { detail: async () => ({ _id: id, title: 'Title' }), neighbors: async () => ({ previous: null, next: null }) } },
      render: async name => { template = name; },
    };
    await page.index(); assert.equal(template, 'template/components/wenzhang.html');
    const custom = path.join(baseDir, 'app/view/template/custom');
    fs.mkdirSync(custom, { recursive: true }); fs.writeFileSync(path.join(custom, 'wenzhang.html'), 'custom');
    await page.index(); assert.equal(template, 'template/custom/wenzhang.html');
    const originalArticle = { _id: id, title: '原始标题', description: '原始描述' };
    const words = ['游戏攻略', '科技资讯', '软件教程'];
    page.ctx.service.wenzhang.detail = async () => originalArticle;
    page.ctx.service.fanmuluArticle.getPool = async category => { assert.equal(category, 'keyword'); return words; };
    page.ctx.host = 'example.test';
    let renderedData;
    page.ctx.render = async (name, data) => { template = name; renderedData = data; };
    await page.index();
    const selectedWord = renderedData.keyword;
    assert(words.includes(selectedWord));
    assert.equal(renderedData.title, selectedWord + ' 原始标题');
    assert.equal(renderedData.description, selectedWord + ' 原始描述');
    assert.equal(renderedData.detail.title, renderedData.title);
    assert.equal(originalArticle.title, '原始标题', 'shared cached article must not be modified');
    await page.index(); assert.equal(renderedData.keyword, selectedWord, 'same URL selects same keyword');
    page.ctx.service.fanmuluArticle.getPool = async () => [];
    await page.index(); assert.equal(renderedData.title, '原始标题', 'empty library preserves original title');
    page.ctx.service.fanmuluArticle.getPool = async () => words;
    page.ctx.service.wenzhang.publicList = async () => ({ rows: [], hasPrev: false, hasNext: false });
    page.ctx.service.wenzhang.categories = async () => [];
    page.ctx.path = '/WenZhang/list.html';
    for (const query of [{}, { id, direction: 'next' }, { id, direction: 'prev' }, { categoryId: id }, { categoryId: id, id, direction: 'next' }]) {
      page.ctx.query = query;
      const parameters = new URLSearchParams(query).toString();
      page.ctx.originalUrl = page.ctx.path + (parameters ? '?' + parameters : '');
      await page.index();
      const expected = words[require('crypto').createHash('sha256').update(page.ctx.host + page.ctx.originalUrl).digest().readUInt32BE(0) % words.length];
      assert.equal(renderedData.title, expected + ' 文章');
      assert.equal(renderedData.description, expected + ' 游戏与科技文章');
      const listHtml = nunjucks.render(path.join(__dirname, '../app/view/template/components/wenzhang.html'), renderedData);
      assert(listHtml.includes('<h1>' + expected + ' 文章</h1>'));
      assert(listHtml.includes('content="' + expected + ' 游戏与科技文章"'));
    }
    let muluIndex;
    page.ctx.header = { host: 'example.test' };
    Object.assign(page.ctx.service.utils, {
      strToNumber: value => { muluIndex = value; return 77; },
      getMuluItemOne: async (index, mcid) => {
        assert.equal(index, 77); assert.equal(mcid._id, id);
        return { keywords: '[站名]目录词' };
      },
      urlToStr: () => 'abc', urlToemoj: () => '※',
    });
    page.ctx.service.utils.getSiteInfo = async () => ({ domain: {
      tname: 'custom', fullDomain: 'example.test', beiAnName: '演示站', mcid: { _id: id, num: 10 },
    } });
    page.ctx.path = '/WenZhangMuLu/list.html'; page.ctx.url = '/WenZhangMuLu/list.html?categoryId=' + id;
    page.ctx.originalUrl = page.ctx.url; page.ctx.query = { categoryId: id };
    await page.index();
    assert.equal(muluIndex, 'example.test' + page.ctx.url);
    assert.equal(renderedData.keyword, '演示站目录词');
    assert.equal(renderedData.title, '演示站目录词 文章');
    assert.equal(renderedData.routeBase, '/WenZhangMuLu');
    const muluList = nunjucks.render(path.join(__dirname, '../app/view/template/components/wenzhang.html'), {
      ...renderedData, articleList: [{ _id: id, title: '测试文章' }], categories: [{ _id: id, name: '分类' }],
    });
    assert(muluList.includes('/WenZhangMuLu/list.html?categoryId=' + id));
    assert(muluList.includes('/WenZhangMuLu/' + id + '.html'));
    page.ctx.path = '/WenZhangMuLu/' + id + '.html'; page.ctx.url = page.ctx.path;
    page.ctx.originalUrl = page.ctx.path; page.ctx.query = {};
    page.ctx.service.wenzhang.detail = async () => originalArticle;
    await page.index();
    assert.equal(renderedData.title, '演示站目录词 原始标题');
    assert.equal(renderedData.description, '演示站目录词 原始描述');
    renderedData.previousArticle = { _id: '507f1f77bcf86cd799439012', title: '较新文章' };
    renderedData.nextArticle = { _id: '507f1f77bcf86cd799439010', title: '较旧文章' };
    const neighborHtml = nunjucks.render(path.join(__dirname, '../app/view/template/components/wenzhang.html'), renderedData);
    assert(neighborHtml.includes('/WenZhangMuLu/507f1f77bcf86cd799439012.html'));
    assert(neighborHtml.includes('上一篇：较新文章'));
    assert(neighborHtml.includes('/WenZhangMuLu/507f1f77bcf86cd799439010.html'));
    assert(neighborHtml.includes('下一篇：较旧文章'));
    page.ctx.originalUrl = undefined;
    page.ctx.query = {};
    let redirected;
    page.ctx.redirect = target => { redirected = target; };
    page.ctx.request = { header: {} };
    let articlePath;
    page.ctx.service.fanmuluArticle = { buildPage: async ctx => {
      articlePath = ctx.originalUrl;
      return { template: 'template/custom/article.html', data: {} };
    } };
    page.ctx.path = '/WenZhang/6ab6a2d0'; await page.index();
    assert.equal(redirected, undefined); assert.equal(articlePath, '/Article/6ab6a2d0');
    assert.equal(template, 'template/custom/article.html');
    assert.equal(page.ctx.path, '/WenZhang/6ab6a2d0');
    page.ctx.path = '/WenZhang/' + id + '.html';
    page.ctx.querystring = 'test=1';
    page.ctx.service.wenzhang.detail = async () => null;
    await page.index();
    assert.equal(redirected, undefined);
    assert.equal(articlePath, '/Article/' + id + '.html?test=1');
    assert.equal(page.ctx.path, '/WenZhang/' + id + '.html');
    page.ctx.path = '/WenZhang/list.html'; page.ctx.query = { id: 'invalid' };
    redirected = null; await page.index();
    assert.equal(page.ctx.status, 404); assert.equal(redirected, null, 'invalid list parameters do not fall back to article');
    const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(__dirname, '../app/view')), { autoescape: true });
    const output = env.render('template/components/wenzhang.html', { title: 'Title', domain: {}, detail: { title: '<bad>', content: '<p>Body</p>' } });
    assert(output.includes('&lt;bad&gt;')); assert(output.includes('<p>Body</p>'));
    const list = env.render('template/components/wenzhang.html', { isList: true, domain: {}, articleList: [{ _id: id, title: 'Test' }], page: 1, total: 1 });
    assert(list.includes('/WenZhang/' + id + '.html'));
    for (const mode of [ 'default', 'fanmulu', 'static' ]) {
      const router = new Router();
      const auth = async (c, next) => { c.auth = true; await next(); };
      require('../app/router/wenzhang')({ router, middleware: { isLogin: () => auth, isAdmin: () => auth },
        controller: { page: { wenzhang: { index: async c => { c.body = 'article'; } } }, wenzhang: { manage: async c => { c.body = 'admin'; } } } });
      if (mode !== 'default') router.get('/*', async c => { c.body = 'fallback'; });
      const c = { path: '/WenZhang/' + id + '.html', method: 'GET' }; await router.routes()(c, async () => {}); assert.equal(c.body, 'article');
      const mulu = { path: '/WenZhangMuLu/' + id + '.html', method: 'GET' }; await router.routes()(mulu, async () => {}); assert.equal(mulu.body, 'article');
      const admin = { path: '/api/wenzhang/list', method: 'POST' }; await router.routes()(admin, async () => {}); assert(admin.auth);
    }
    console.log('PASS: RSS/Atom, sanitization, deduplication, public URL filtering, JSON cache, edit/delete, template fallback, and route/auth ordering.');
  } finally {
    assert.equal(path.dirname(fs.realpathSync(baseDir)), fs.realpathSync(__dirname));
    fs.rmdirSync(baseDir, { recursive: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
