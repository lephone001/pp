'use strict';

// node test/article-movie.js: real page generator, template and router with mocked I/O; no database or cache writes.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const crypto = require('crypto');
const nunjucks = require('nunjucks');
const cheerio = require('cheerio');
const { EggRouter } = require('@eggjs/router');
const root = path.resolve(__dirname, '..');
const movieWords = ['《极限特工3国语完整版观看》BD国语完整在线观看', '《电影二》高清完整版', '影片 & 特辑'];
const movieTemplate = { id: 'new_moviex', name: 'Movie', file: 'movie/new_moviex.html' };
const normalTemplate = { id: 'appx_default', name: 'Normal', file: 'appx_default.html' };
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const escapeHtml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function load(filename, overrides = {}) {
  const fullpath = path.join(root, filename);
  const req = Module.createRequire(fullpath);
  const mod = { exports: {} };
  vm.runInNewContext(fs.readFileSync(fullpath, 'utf8'), {
    module: mod, process, Buffer, URL, setTimeout, clearTimeout,
    require: name => Object.prototype.hasOwnProperty.call(overrides, name) ? overrides[name] : req(name),
  });
  return mod.exports;
}

function setup(options = {}) {
  const files = options.files || { '1.txt': movieWords.join('\r\n') + '\r\n' };
  const playbackFiles = options.playbackFiles || {};
  const fileContent = filename => (path.basename(path.dirname(filename)) === 'movieplay' ? playbackFiles : files)[path.basename(filename)];
  const reads = [];
  const warnings = [];
  const queued = [];
  const fakeFs = {
    stat: async filename => {
      const value = fileContent(filename);
      if (value === null) throw Object.assign(new Error('missing file'), { code: 'ENOENT' });
      return { isFile: () => true, size: Buffer.byteLength(value || '') };
    },
    readFile: async filename => { reads.push(filename); return Buffer.from(fileContent(filename) || ''); },
  };
  const Service = load('app/service/fanmuluArticle.js', {
    egg: { Service: class { constructor(ctx) { this.ctx = ctx; this.app = ctx.app; } } },
    'fs-extra': fakeFs, '../utils/downloadPortal': () => ({}),
    '../utils/backupDomains': () => (options.backupDomains || []).map(item => ({ ...item })),
  });
  const app = { baseDir: root, fanmuluArticleRuntimeReady: true, logger: { warn: (...args) => warnings.push(args) } };
  const service = new Service({ app, logger: app.logger });
  const settings = { enabled: true, friendLinksEnabled: true, enabledTemplates: [normalTemplate.id], ...options.settings };
  service.getSettings = async () => settings;
  service.getTemplateManifest = async () => [normalTemplate, movieTemplate];
  service.categoryFiles = async category => category === 'moviex' ? Object.keys(files).sort()
    : category === 'movieplay' ? Object.keys(playbackFiles).sort() : category === 'gpt' ? ['Existing article.txt'] : [];
  service.getArticleSource = async () => options.source || ({ title: 'Existing article', content: '<p>Existing body remains</p>' });
  const pools = {
    keyword: ['Ordinary keyword'], zh: ['Spider keyword'], title: ['Ordinary short title'],
    biaoti: ['Format: {文章标题}'], description: ['Existing description'], miaoshu: ['{描述}'],
    guanjianci: ['{关键词}'], sitename: ['Site'], links: [], fan: [],
  };
  Object.assign(pools, options.pools);
  service.getPool = async category => pools[category] || [];
  service.enqueuePageState = (filename, state) => { queued.push({ filename, state }); return true; };
  const context = (url = '/Article/Movie/first.html', userAgent = 'Mozilla/5.0', host = 'example.test') => ({
    path: url.split('?')[0], url, originalUrl: url, protocol: 'https', host,
    get: name => name === 'User-Agent' ? userAgent : name === 'Host' ? host : '',
  });
  return { service, app, reads, warnings, queued, context, files, settings };
}

async function main() {
  const probe = setup();
  const ctx = probe.context();
  const page = await probe.service.buildPage(ctx);
  assert.strictEqual(page.template, movieTemplate.file);
  assert(movieWords.map(escapeHtml).includes(page.data.title));
  assert.strictEqual(page.data.articleTitle, page.data.title);
  assert.strictEqual(page.data.keywords, page.data.title);
  assert.strictEqual(page.data.description, 'Existing description');
  assert(page.data.contentHtml.includes('Existing body remains'));
  assert.strictEqual(page.data.canonical, 'https://example.test/Article/Movie/first.html');
  assert.strictEqual(page.data.routeBasePath, '/Article/Movie');
  for (const item of page.data.related.concat(page.data.recommendations)) {
    assert(movieWords.map(escapeHtml).includes(item.title));
    assert(item.url.startsWith('/Article/Movie/'));
  }
  assert(page.data.logoUrl.startsWith('/Article/Movie/'));
  assert.strictEqual(probe.reads.length, 1);
  const again = await probe.service.buildPage(ctx);
  const restarted = await setup().service.buildPage(ctx);
  assert.strictEqual(again.data.title, page.data.title);
  assert.strictEqual(restarted.data.title, page.data.title);
  assert.strictEqual(probe.reads.length, 1);

  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader([
    path.join(root, 'app/common_data/Article/templates'), path.join(root, 'app/view'),
  ]), { autoescape: false });
  const html = env.render(page.template, page.data);
  assert(html.includes('<title>' + page.data.title + '</title>'));
  const $ = cheerio.load(html, { decodeEntities: false });
  assert.strictEqual($('h1').length, 1);
  assert.strictEqual($('#movie-title').html(), page.data.title);
  assert(html.includes('<dt>片名</dt><dd>' + page.data.title));
  assert($('style').text().includes('@media(max-width:520px)'));
  assert.strictEqual($('script,iframe').length, 0);
  $('a[href]').each((index, element) => {
    const href = $(element).attr('href');
    if ($(element).is('.article-sitemap-html,.article-sitemap-xml')) {
      assert(['/sitemap.html', '/sitemap.xml'].includes(href));
      return;
    }
    assert(href.startsWith('/Article/Movie/'), href);
    if (href.includes('#')) assert.strictEqual($(href.slice(href.indexOf('#'))).length, 1, href);
  });

  // Render through the real controller so the site domain is actually available to the template.
  const PageController = load('app/controller/page/fanmuluArticle.js', {
    egg: { Controller: class { constructor(ctx) { this.ctx = ctx; } } },
  });
  async function renderWithDomain(domain, template = movieTemplate.file, reuseDomain = false) {
    let lookups = 0;
    let renderedData;
    const errors = [];
    const controllerCtx = {
      state: reuseDomain ? { articlePageDomain: domain } : {},
      service: {
        fanmuluArticle: { buildPage: async () => ({ template, data: { ...page.data } }) },
        utils: { getSiteInfo: async () => { lookups++; return { domain }; } },
      },
      set() {}, logger: { error: (...args) => errors.push(args) },
      render: async (filename, data) => { renderedData = data; controllerCtx.body = env.render(filename, data); },
    };
    await new PageController(controllerCtx).article();
    assert.strictEqual(errors.length, 0, JSON.stringify(errors));
    return { html: controllerCtx.body, data: renderedData, lookups };
  }
  for (const count of [2, 10, 100, 5000, '10']) {
    const domain = { sfurl: { staticUrl: 'https://static.example.test' }, imgTypeName: 'movie', imageNums: count };
    const rendered = await renderWithDomain(domain);
    assert.strictEqual(rendered.lookups, 1);
    assert.strictEqual(rendered.data.domain, domain);
    const covers = cheerio.load(rendered.html);
    assert.strictEqual(covers('.mx-poster img').attr('src'), 'https://static.example.test/images/article/movie/' + count + '.jpg');
    assert.strictEqual(covers('.mx-poster').attr('aria-hidden'), undefined);
    assert.strictEqual(covers('.mx-film-art img').length, page.data.related.length);
    covers('.mx-film-art img').each((index, element) => {
      const image = covers(element);
      const match = image.attr('src').match(/^https:\/\/static\.example\.test\/images\/article\/movie\/(\d+)\.jpg$/);
      assert(match, image.attr('src'));
      assert(Number(match[1]) >= 1 && Number(match[1]) < Number(count), image.attr('src'));
      assert.strictEqual(image.attr('loading'), 'lazy');
    });
    const repeat = cheerio.load((await renderWithDomain(domain)).html);
    assert.deepStrictEqual(covers('.mx-film-art img').map((index, element) => covers(element).attr('src')).get(),
      repeat('.mx-film-art img').map((index, element) => repeat(element).attr('src')).get());
  }
  const singleCover = cheerio.load((await renderWithDomain({ sfurl: { staticUrl: '' }, imgTypeName: 'movie', imageNums: 1 })).html);
  assert.strictEqual(singleCover('.mx-poster img').attr('src'), '/images/article/movie/1.jpg');
  assert.strictEqual(singleCover('.mx-film-art img').length, 0);
  for (const domain of [null, {}, { sfurl: {}, imgTypeName: 'movie', imageNums: 0 },
    { sfurl: {}, imgTypeName: 'movie', imageNums: 'invalid' }, { imageNums: 10 }]) {
    const fallback = cheerio.load((await renderWithDomain(domain)).html);
    assert.strictEqual(fallback('.mx-poster img,.mx-film-art img').length, 0);
    assert.strictEqual(fallback('.mx-poster-word').length, 1);
  }
  const escapedCover = await renderWithDomain({ sfurl: { staticUrl: 'https://static.example.test/"' }, imgTypeName: 'movie"', imageNums: 10 });
  assert(escapedCover.html.includes('https://static.example.test/&quot;/images/article/movie&quot;/10.jpg'));
  const ordinaryControllerPage = await renderWithDomain(null, normalTemplate.file);
  assert.strictEqual(ordinaryControllerPage.lookups, 1);
  assert.strictEqual(ordinaryControllerPage.data.domain, undefined);
  assert.strictEqual(Object.keys(ordinaryControllerPage.data.footerDomain).length, 0);
  const footerConfig = { isOutFriendLink: true, randomClass: 'abc', outFriendLinks: [{ link: 'one.test' }, { link: 'two.test' }] };
  const configuredFooter = await renderWithDomain(footerConfig, normalTemplate.file, true);
  assert.strictEqual(configuredFooter.lookups, 0, 'reuse the domain already resolved by jump middleware');
  assert.strictEqual(configuredFooter.data.footerDomain, footerConfig);
  assert.strictEqual(configuredFooter.data.domain, undefined, 'ordinary page settings stay unchanged');
  assert.deepStrictEqual(cheerio.load(configuredFooter.html)('.article-out-friend-link').map((index, el) => cheerio(el).attr('href')).get(),
    ['http://www.abc1.one.test', 'http://www.abc2.two.test']);
  const disabledFooter = await renderWithDomain({ ...footerConfig, isOutFriendLink: false }, normalTemplate.file, true);
  assert.strictEqual(cheerio.load(disabledFooter.html)('.article-out-friend-link').length, 0);

  const playbackUrls = ['https://media.example.test/one.m3u8?x=1&y=2', 'https://media.example.test/two.m3u8'];
  const playback = setup({ playbackFiles: { 'link1.txt': playbackUrls.join('\r\n') + '\r\n' } });
  const playable = await playback.service.buildPage(playback.context());
  assert(playbackUrls.map(escapeHtml).includes(playable.data.movieVideoUrl));
  const playHtml = env.render(playable.template, { ...playable.data,
    domain: { sfurl: { staticUrl: 'https://static.example.test' }, imgTypeName: 'movie', imageNums: 10 } });
  const playDom = cheerio.load(playHtml);
  assert.strictEqual(playDom('#movie-facts').prev().attr('id'), 'movie-player');
  assert.strictEqual(playDom('#movie-ranking').prev().attr('id'), 'movie-facts');
  assert.strictEqual(playDom('#MoviexVideo').length, 1);
  assert(playbackUrls.includes(playDom('#MoviexVideo').attr('data-video-url')));
  assert.strictEqual(playDom('#MoviexVideo').attr('autoplay'), undefined);
  assert.strictEqual(playDom('#MoviexVideo').attr('poster'), 'https://static.example.test/images/article/movie/10.jpg');
  assert.strictEqual(playDom('[data-movie-seek]').length, 6);
  assert.deepStrictEqual(playDom('script[src]').map((index, el) => playDom(el).attr('src')).get(),
    ['/s04/static/plyr.js', '/s04/static/hls.min.js', '/article_static/moviex-player.js?v=20261015-2']);
  playDom('script[src]').each((index, el) => assert.notStrictEqual(playDom(el).attr('defer'), undefined));
  assert.strictEqual(playDom('script:not([src]),iframe').length, 0);
  assert.strictEqual((await playback.service.buildPage(playback.context())).data.movieVideoUrl, playable.data.movieVideoUrl);
  assert.strictEqual(playback.reads.length, 2, 'one movie title shard and one playback shard stay cached');
  const ordinaryPlayback = await playback.service.buildPage(playback.context('/Article/ordinary.html'));
  assert.strictEqual(ordinaryPlayback.data.movieVideoUrl, undefined);
  assert.strictEqual(playback.reads.length, 2);
  const fallbackPlayback = setup({ playbackFiles: {
    'link1.txt': null, 'link2.txt': 'javascript:alert(1)\n/relative.m3u8\nnot-a-url\nhttps://bad.test/a b.m3u8\n',
    'link3.txt': playbackUrls[0] + '\n',
  } });
  assert.strictEqual(await fallbackPlayback.service.getMoviePlayUrl({ hash: hash('fallback-playback') }), playbackUrls[0]);
  assert.strictEqual(await setup().service.getMoviePlayUrl({ hash: hash('empty-playback') }), '');
  const playShards = {};
  for (let i = 1; i <= 12; i++) playShards['link' + i + '.txt'] = 'https://media.example.test/' + i + '.m3u8\n';
  const boundedPlayback = setup({ playbackFiles: playShards });
  for (let i = 0; i < 100; i++) await boundedPlayback.service.getMoviePlayUrl({ hash: hash('playback-' + i) });
  assert(boundedPlayback.app.fanmuluArticleMoviePlayPools.size <= 8);
  assert(boundedPlayback.app.fanmuluArticleTextCache.size <= 8);
  boundedPlayback.service.invalidateMemory();
  assert.strictEqual(boundedPlayback.app.fanmuluArticleMoviePlayPools.size, 0);

  // Real exported data stays split into ten files, with exactly 1000 unique URLs per file.
  const exportRoot = path.join(root, 'app/common_data/Article/data/movieplay');
  const exportedFiles = fs.readdirSync(exportRoot).filter(name => /\.txt$/i.test(name)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  assert.deepStrictEqual(exportedFiles, Array.from({ length: 10 }, (value, index) => 'link' + (index + 1) + '.txt'));
  const exportedUrls = [];
  exportedFiles.forEach(name => {
    const rows = fs.readFileSync(path.join(exportRoot, name), 'utf8').trim().split(/\r?\n/);
    assert.strictEqual(rows.length, 1000, name);
    rows.forEach(url => assert.strictEqual(require('../app/utils/moviePlayback').normalizeVideoUrl(url), url));
    exportedUrls.push(...rows);
  });
  assert.strictEqual(new Set(exportedUrls).size, 10000);

  const linked = await probe.service.buildPage(probe.context(page.data.related[0].url));
  assert.strictEqual(linked.template, movieTemplate.file);
  assert(movieWords.map(escapeHtml).includes(linked.data.title));

  // Internal article URLs from body, link libraries and backup navigation stay in the movie route.
  const internalLinks = [
    ['/Article/old.html?a=1&b=2#part', '/Article/Movie/old.html?a=1&amp;b=2#part'],
    ['https://example.test/Article/old.html', '/Article/Movie/old.html'],
    ['http://example.test/Article/old.html', '/Article/Movie/old.html'],
    ['//example.test/Article/old.html', '/Article/Movie/old.html'],
    ['/Article', '/Article/Movie'],
    ['/Article/Movie/keep.html', '/Article/Movie/keep.html'],
    ['https://other.test/Article/old.html', 'https://other.test/Article/old.html'],
    ['//other.test/Article/old.html', '//other.test/Article/old.html'],
    ['/ArticleExtra/keep.html', '/ArticleExtra/keep.html'],
    ['/article_static/logo.svg', '/article_static/logo.svg'],
  ];
  for (const [url, expected] of internalLinks) {
    const library = setup({ pools: { url: [url], links: [url] }, backupDomains: [{ title: 'Backup', url: escapeHtml(url) }] });
    const result = await library.service.buildPage(library.context());
    assert(result.data.libraryLinks.length > 0);
    assert(result.data.libraryLinks.every(item => item.url === expected), url);
    assert(result.data.friendLinks.every(item => item.url === expected), url);
    assert.strictEqual(result.data.backupDomains[0].url, expected, url);
    const normal = await library.service.buildPage(library.context('/Article/ordinary.html'));
    assert(normal.data.libraryLinks.every(item => item.url === escapeHtml(url)), url);
  }
  const body = setup({ source: { title: 'Body', content: '<p>Text <a href="/Article/old.html?a=1&amp;b=2#part">local</a> <a href="../sibling.html">relative</a> <a href="https://other.test/Article/old.html">external</a><img src="/article_static/logo.svg" alt="Image"></p><script>bad()</script>' } });
  const bodyPage = await body.service.buildPage(body.context());
  const bodyDom = cheerio.load(bodyPage.data.contentHtml);
  assert.strictEqual(bodyDom('a').eq(0).attr('href'), '/Article/Movie/old.html?a=1&b=2#part');
  assert.strictEqual(bodyDom('a').eq(1).attr('href'), '/Article/Movie/sibling.html');
  assert.strictEqual(bodyDom('a').eq(2).attr('href'), 'https://other.test/Article/old.html');
  assert.strictEqual(bodyDom('img').attr('src'), '/article_static/logo.svg');
  assert.strictEqual(bodyDom('script').length, 0);
  assert(!bodyPage.data.contentHtml.includes('bad()'));

  const longTitle = '电影'.repeat(200);
  const long = setup({ files: { '1.txt': longTitle + '\n' } });
  assert.strictEqual((await long.service.buildPage(long.context())).data.title, longTitle);
  const strong = setup({ settings: { spiderStrongEnabled: true } });
  const spider = await strong.service.buildPage(strong.context('/Article/Movie/spider.html', 'Baiduspider'));
  assert.strictEqual(spider.template, movieTemplate.file);
  assert(movieWords.map(escapeHtml).includes(spider.data.title));
  assert.strictEqual((await setup().service.buildPage(probe.context('/Article/Movie'))).template, movieTemplate.file);
  assert.strictEqual((await setup().service.buildPage(probe.context('/Article/Movie/'))).template, movieTemplate.file);
  const disabled = setup({ settings: { enabled: false } });
  assert.strictEqual(await disabled.service.buildPage(disabled.context()), null);

  for (const url of ['/Article/first.html', '/Article/movie/first.html', '/Article/Movies/first.html', '/Artricle/Movie/first.html']) {
    const normal = setup();
    const normalPage = await normal.service.buildPage(normal.context(url));
    assert.strictEqual(normalPage.template, 'appx_default.html');
    assert.strictEqual(normalPage.data.articleTitle, 'Existing article');
    assert.strictEqual(normalPage.data.title, 'Format: Existing article');
    assert.strictEqual(normal.reads.length, 0);
  }
  const global = setup();
  assert.strictEqual((await global.service.buildPage(global.context(), { globalRoute: true })).template, 'appx_default.html');
  const stale = setup();
  const identity = stale.service.pageIdentity(stale.context().originalUrl);
  const old = await stale.service.createPageState(identity, [normalTemplate]);
  stale.service.rememberPage(identity.hash, old);
  assert.strictEqual((await stale.service.buildPage(stale.context())).template, movieTemplate.file);
  assert.strictEqual(stale.app.fanmuluArticlePageCache.get(identity.hash).templateFile, movieTemplate.file);
  assert.strictEqual(stale.queued.length, 1);
  const previousMovie = setup();
  const previousIdentity = previousMovie.service.pageIdentity(previousMovie.context().originalUrl);
  previousMovie.service.rememberPage(previousIdentity.hash, await previousMovie.service.createPageState(previousIdentity,
    [{ id: 'appx_movie', name: 'Previous movie', file: 'appx_movie.html' }]));
  assert.strictEqual((await previousMovie.service.buildPage(previousMovie.context())).template, movieTemplate.file);
  assert.strictEqual(previousMovie.queued.length, 1);

  const empty = setup({ files: {} });
  assert.strictEqual((await empty.service.buildPage(empty.context())).data.title, '电影详情');
  const unavailable = setup({ files: { '1.txt': null, '2.txt': ' \n\n', '3.txt': movieWords[0] + '\n' } });
  const pool = await unavailable.service.getMovieTitlePool({ hash: hash('pool-test') });
  assert.strictEqual(pool[0], movieWords[0]);
  const replacement = setup({ files: { '63.txt': '正常电影\n含占位字符\ufffd的电影\n' } });
  const utf8Pool = await replacement.service.getMovieTitlePool({ hash: hash('utf8-test') });
  assert.strictEqual(utf8Pool[0], '正常电影');
  assert.strictEqual(utf8Pool[1], '含占位字符\ufffd的电影');
  const gbk = setup({ files: { '1.txt': require('iconv-lite').encode('中文电影\n', 'gb18030') } });
  assert.strictEqual((await gbk.service.getMovieTitlePool({ hash: hash('gbk-test') }))[0], '中文电影');
  const manyFiles = {};
  for (let i = 0; i < 40; i++) manyFiles[i + '.txt'] = 'Movie ' + i + '\n';
  const bounded = setup({ files: manyFiles });
  for (let i = 0; i < 250; i++) await bounded.service.getMovieTitlePool({ hash: hash('bounded-' + i) });
  assert(bounded.app.fanmuluArticleMoviePools.size <= 32);
  assert(bounded.app.fanmuluArticleTextCache.size <= 32);
  bounded.service.invalidateMemory();
  assert.strictEqual(bounded.app.fanmuluArticleMoviePools.size, 0);
  assert.strictEqual(bounded.app.fanmuluArticleTextCache.size, 0);

  // Render from one real moviex shard, without preloading or modifying any existing data/cache files.
  const actualText = fs.readFileSync(path.join(root, 'app/common_data/Article/data/moviex/2.txt'), 'utf8');
  const actualWords = new Set(actualText.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(escapeHtml));
  const actual = setup({ files: { '2.txt': actualText } });
  const actualPage = await actual.service.buildPage(actual.context('/Article/Movie/real.html'));
  assert(actualWords.has(actualPage.data.title));
  const actualHtml = env.render(actualPage.template, actualPage.data);
  assert(actualHtml.includes('<title>' + actualPage.data.title + '</title>'));
  const actual63 = fs.readFileSync(path.join(root, 'app/common_data/Article/data/moviex/63.txt'), 'utf8');
  const actual63Probe = setup({ files: { '63.txt': actual63 } });
  const actual63Pool = await actual63Probe.service.getMovieTitlePool({ hash: hash('actual-63') });
  const expected63 = new Set(actual63.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
  assert(actual63Pool.every(word => expected63.has(word)));

  for (const mode of ['default', 'fanmulu', 'static']) {
    const calls = { jump: 0, render: 0 };
    const app = { logger: { info() {} } };
    const nodes = new Map();
    const node = name => {
      if (nodes.has(name)) return nodes.get(name);
      const handler = async ctx => { ctx.body = { handler: name }; };
      const proxy = new Proxy(handler, { get: (target, key) => typeof key === 'symbol' || key in target
        ? Reflect.get(target, key) : node(name ? name + '.' + key : key) });
      nodes.set(name, proxy);
      return proxy;
    };
    app.controller = node('');
    app.middleware = new Proxy({}, { get: (target, name) => () => async (ctx, next) => {
      if (name === 'jump') calls.jump++;
      return next();
    } });
    app.router = new EggRouter({ sensitive: true }, app);
    const register = load('app/router.js', { './router/loader': target => {
      require('../app/router/' + mode)(target, {});
    } });
    register(app);
    const route = { method: 'GET', path: '/Article/Movie/route.html', url: '/Article/Movie/route.html' };
    const matched = app.router.match(route.path, route.method).pathAndMethod;
    assert.strictEqual(matched[0].path, '/Article/Movie/*');
    await app.router.routes()(route, async () => {});
    assert.strictEqual(route.body.handler, 'page.fanmuluArticle.article');
    assert.strictEqual(calls.jump, 1);
    assert.strictEqual(app.router.match('/Article/Movies/route.html', 'GET').pathAndMethod[0].path, '/Article/*');
  }
  console.log('PASS: Movie template, cover URLs, playback placement/source selection, bounded caches, 10x1000 export files and ordinary article routes verified.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
