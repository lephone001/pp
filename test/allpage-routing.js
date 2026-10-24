'use strict';

// Exercise allPage with actual Koa response semantics and mocked files/controllers.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const http = require('http');
const Koa = require('koa');

const filename = path.join(__dirname, '../app/service/utils.js');
const source = fs.readFileSync(filename, 'utf8');
const req = Module.createRequire(filename);
const localHtml = '<html><head><title>Local</title></head><body>Local page</body></html>';

function setup(overrides = {}, options = {}) {
  const calls = { site: 0, fallback: 0, reads: [], templates: [], renders: [] };
  const domain = {
    _id: 'domain', fullDomain: 'example.test', link: 'example.test', tname: 'demo',
    title: 'Example', keyWords: 'Example', description: 'Example', isMuLu: false,
    isMobile: false, ispcpage: 1, isOpenUrl: -1, browserType: 'normal',
    spider: false, isSpider: false, isBaiduSpider: false, titleType: 0,
    agentLink: { isAgentPage: false, agentPageName: 'custom', gajs: '' }, ...overrides,
  };
  const request = { method: 'GET', url: options.url || '/missing.html',
    headers: { host: domain.fullDomain, accept: 'text/html', 'user-agent': options.ua || 'Mozilla/5.0' },
    socket: { remoteAddress: '192.0.2.1' }, connection: {} };
  const app = new Koa();
  app.config = { cacheFile: '/cache/' };
  app.controller = { uplink: { index: { async sbb02() {
    assert.strictEqual(this, ctx);
    calls.fallback++;
    await Promise.resolve();
    this.set('Cache-Control', 'no-store');
    this.type = 'text/html';
    this.body = 'DEFAULT SBB02';
  } } } };
  const ctx = app.createContext(request, new http.ServerResponse(request));
  const templateRoot = path.resolve('app/view/template/demo');
  const templates = new Set((options.templates || []).map(file => path.resolve(templateRoot, file)));
  const pages = new Map();
  if (options.localPage !== undefined) pages.set(path.resolve('app/public/html/custom.html'), options.localPage);
  const fakeFs = {
    ...fs,
    existsSync: file => pages.has(path.resolve(file)),
    readFileSync(file) {
      calls.reads.push(file);
      if (pages.has(path.resolve(file))) return pages.get(path.resolve(file));
      if (file.includes('/article/youxi/')) return '{"title":"Article"}';
      if (file.includes('article_list')) return '[]';
      throw Object.assign(new Error('missing file'), { code: 'ENOENT' });
    },
    statSync(file) {
      assert(templates.has(path.resolve(file)), 'Unexpected template stat: ' + file);
      if (options.disappear) throw Object.assign(new Error('deleted after lookup'), { code: 'ENOENT' });
      return { isFile: () => !options.directory };
    },
  };
  const mod = { exports: {} };
  vm.runInNewContext(source, {
    module: mod, process, console, URL, setTimeout, clearTimeout,
    require(name) {
      if (name === 'egg') return { Service: class { constructor(context) { this.ctx = context; } } };
      if (name === 'fs') return fakeFs;
      if (name === '../utils/templateExistsCache') return {
        templateExists(key, file) { calls.templates.push(file); return templates.has(path.resolve(file)); },
        resolveTemplate: () => '/ml/index.html',
      };
      if (name === '../confi/index' || name === '../model/domain') return {};
      if (name === './datajson/iframe_url') return [];
      if (name === 'axios') return () => { throw new Error('Unexpected network request'); };
      return req(name);
    },
  }, { filename });
  const service = new mod.exports(ctx);
  service.getSiteInfo = async () => { calls.site++; return { domain }; };
  service.getMuluItemOne = async () => ({ title: 'Directory', keywords: 'Word', description: 'Description' });
  service.urlToStr = () => 'letters';
  service.urlToemoj = () => '';
  service.randomWord = () => 'a';
  service.randomNumber = () => 1;
  ctx.service = { utils: service };
  ctx.render = async (name, data) => { calls.renders.push({ name, data }); ctx.body = 'RENDERED'; };
  return { service, ctx, calls, domain, templateRoot };
}

const mobile = { isMuLu: true, isMobile: true, isOpenUrl: 0 };
const forced = { isMuLu: false, isMobile: true, isOpenUrl: 3, browserType: 'baidu' };
const localAgent = { isAgentPage: true, agentPageName: 'custom', gajs: '<!--stats-->' };

async function main() {
  // Extension filtering is independent of Host dots, query strings and letter case.
  for (const url of ['/a.js?v=1', '/a.JPG', '/photo%2Epng?next=page.html', '/font.woff',
    '/font.WOFF2?v=2', '/sitemap.txt', '/sitemap_index.xml', '/icon.ico', '/video.mp4']) {
    const page = setup({}, { url });
    await page.service.allPage();
    assert.strictEqual(page.ctx.status, 403, url);
    assert.strictEqual(page.ctx.body, '', url);
    assert.strictEqual(page.calls.site, 0, url);
  }
  for (const url of ['/article.html?file=a.js', '/no-extension?image=a.png', '/bad%ZZ.html']) {
    const page = setup({}, { url });
    await page.service.allPage();
    assert.strictEqual(page.ctx.status, 200, url);
    assert.strictEqual(page.calls.renders[0].name, '/ml/index.html', url);
  }

  // Configured local pages work in both mobile and forced branches; missing/empty pages reuse sbb02.
  for (const mode of [mobile, forced, { browserType: 'baidu01', openUrlStatusCode: 200 }]) {
    const page = setup({ ...mode, agentLink: localAgent }, { localPage: localHtml });
    await page.service.allPage();
    assert(page.ctx.body.includes('Local page'));
    assert(page.ctx.body.includes('<!--stats-->'));
    assert.strictEqual(page.calls.fallback, 0);
    for (const localPage of [undefined, '']) {
      const missing = setup({ ...mode, agentLink: localAgent }, { localPage });
      await missing.service.allPage();
      assert.strictEqual(missing.ctx.body, 'DEFAULT SBB02');
      assert.strictEqual(missing.calls.fallback, 1);
    }
  }

  // Missing or malformed links are handled by the existing default-page controller.
  for (const mode of [mobile, forced, { browserType: 'baidu02' }]) {
    for (const value of [undefined, null, '', ' ## ', 12, 'javascript:alert(1)', 'https://', 'not-a-url', 'https://example.test/\nwrong']) {
      const page = setup({ ...mode, agentLink: { isAgentPage: false, openUrlIOS: value, openUrlH5: value } });
      await page.service.allPage();
      assert.strictEqual(page.ctx.body, 'DEFAULT SBB02');
      assert.strictEqual(page.calls.fallback, 1);
    }
  }
  const noAgent = setup({ ...mobile, agentLink: null });
  await noAgent.service.allPage();
  assert.strictEqual(noAgent.calls.fallback, 1);

  // Device URLs are selected correctly; existing query parameters/fragments survive cache busting.
  const agentLink = { openUrlIOS: 'https://example.test/ios', openUrlAndroid: 'https://example.test/android?channel=1#section',
    openUrlH5: 'https://example.test/h5', isAgentPage: false };
  for (const [ua, target] of [['Android 13 Mobile', '/android'], ['iPhone Mobile', '/ios'], ['Mobile browser', '/h5']]) {
    const page = setup({ ...mobile, agentLink }, { ua });
    await page.service.allPage();
    const script = page.calls.renders[0].data.jumpHTML;
    assert(script.includes(target), ua);
    assert.strictEqual(page.calls.fallback, 0);
    if (target === '/android') { assert(script.includes('channel=1&v=')); assert(script.includes('#section')); }
  }
  const h5Only = setup({ ...mobile, agentLink: { openUrlH5: '/landing.html?channel=1#section' } }, { ua: 'iPhone Mobile' });
  await h5Only.service.allPage();
  assert(h5Only.calls.renders[0].data.jumpHTML.includes('/landing.html?channel=1&v='));
  const encoded = setup({ ...forced, agentLink: { openUrlH5: 'h##t##t##p##s##:##/##/##example.test/path' } });
  await encoded.service.allPage();
  assert(encoded.ctx.body.includes('https://example.test/path'));

  // Existing files inside the selected template render; absent/unsafe paths continue to fallback.
  for (const [url, file] of [['/good.html?x=1', 'good.html'], ['/folder/', 'folder/index.html'], ['/section', 'section.html']]) {
    const page = setup({}, { url, templates: [file] });
    await page.service.allPage();
    assert.strictEqual(page.calls.renders[0].name, '/template/demo/' + file);
  }
  for (const url of ['/../../404.html', '/%2e%2e/%2e%2e/404.html', '/%2e%2e%5c404.html', '/%00.html', '/C:/outside.html']) {
    const page = setup({}, { url });
    await page.service.allPage();
    assert.strictEqual(page.ctx.status, 200, url);
    assert.strictEqual(page.calls.renders[0].name, '/ml/index.html', url);
    assert.strictEqual(page.calls.templates.length, 0, url);
  }
  for (const options of [{ disappear: true }, { directory: true }]) {
    const page = setup({}, { url: '/good.html', templates: ['good.html'], ...options });
    await page.service.allPage();
    assert.strictEqual(page.calls.renders[0].name, '/ml/index.html');
  }
  const missingMobile = setup({ ...mobile, agentLink: {} });
  await missingMobile.service.allPage();
  assert.strictEqual(missingMobile.calls.fallback, 1);

  // Preserve the user's HTTPS early return.
  const redirect = setup({ isHttps: true, browserType: 'baidu01' });
  await redirect.service.allPage();
  assert.strictEqual(redirect.ctx.status, 301);
  assert.strictEqual(redirect.calls.reads.length, 0);
  assert.strictEqual(redirect.calls.fallback, 0);
  console.log('PASS: extension filtering, local pages and shared sbb02 fallback, device URLs, forced jumps, template boundaries/missing files, and HTTPS early return. No database/network access or real file writes.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
