'use strict';

// node test/uplink.integration.js — 无数据库、远端更新或消息发送副作用。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const jwt = require('jsonwebtoken');
const base = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(__dirname, '.uplink-test-'));
const dataRoot = path.join(temp, 'app/public/html');
const data = require('../app/lib/uplinkData');
data.ensure(dataRoot);
for (const name of ['app.json', 'bc.json', 'sbbtp.html', 'bctp.html']) {
  fs.copyFileSync(path.join(base, 'app/public/html', name), path.join(dataRoot, name));
}

class EggBase {
  constructor(ctx) { this.ctx = ctx; this.app = ctx.app; }
}

function load(file, mocks = {}, dirname) {
  const filename = path.join(base, file);
  const localRequire = Module.createRequire(filename);
  const mod = { exports: {} };
  const req = name => name === 'egg' ? { Controller: EggBase, Service: EggBase }
    : Object.prototype.hasOwnProperty.call(mocks, name) ? mocks[name] : localRequire(name);
  vm.runInThisContext(Module.wrap(fs.readFileSync(filename, 'utf8')), { filename })(
    mod.exports, req, mod, filename, dirname || path.dirname(filename));
  return mod.exports;
}

const config = { uplink: require('../config/uplink') };
let requestResult;
let requestError;
let requestOptions;
let downloadError = false;
const downloadedList = [{ id: 10, name: 'downloaded', status: 1, url: 'https://healthy.example' }];
const downloadedJs = 'var JIAMIAPPJSONLIST = "' + encodeURIComponent(JSON.stringify(downloadedList)) + '";';
const downloadedHtml = '<html><script>' + downloadedJs + '</script></html>';
const axios = { get: async url => {
  if (downloadError) throw new Error('download failed');
  if (url.includes('app.json')) return { data: [{ id: 10, name: 'downloaded', status: 1, url: 'https://healthy.example' }] };
  if (url.includes('app.js')) return { data: downloadedJs };
  if (url.includes('sbb02.html')) return { data: downloadedHtml };
  if (url.includes('failed.example')) throw new Error('offline');
  return { data: 'OK' };
} };
const mocks = {
  '../../lib/uplinkData': { ensure() {} },
  'request-promise': async options => { requestOptions = options; if (requestError) throw requestError; return requestResult; },
  axios,
};
const source = load('app/lib/advUpdateSource.js', { axios });
const Receiver = load('app/controller/page/link.js', { '../../lib/advUpdateSource': source });
mocks['../page/link'] = Receiver;
const Utils = load('app/service/uplink/utils.js');
const User = load('app/controller/uplink/user.js');
const Index = load('app/controller/uplink/index.js', mocks, path.join(temp, 'app/controller/uplink'));
const Bc = load('app/controller/uplink/bc.js', mocks, path.join(temp, 'app/controller/uplink'));
const auth = require('../app/middleware/uplinkLogin')();
const dbWrites = [];
let localCacheWrites = 0;
let visitorRefreshes = 0;
function context(payload) {
  const ctx = {
    origin: 'https://source.example', app: { jwt, config, baseDir: temp }, headers: {}, state: {}, logger: { warn() {} }, set() {},
    request: { body: {} },
    model: { AppDownload: { collection: { updateOne: async (...args) => dbWrites.push(args) } } },
    service: { uplink: {}, cache: { set: async () => { localCacheWrites++; } }, localData: { refreshVisitorPageCache: async () => {
      visitorRefreshes++;
      return [{ device: 'pc', status: 'completed' }];
    } } },
  };
  ctx.service.uplink.utils = new Utils(ctx);
  if (payload !== undefined) ctx.request.body.data = ctx.service.uplink.utils.jiamiFn(payload);
  return ctx;
}
function decoded(ctx) { return ctx.service.uplink.utils.jiemiFn(ctx.body.data); }
function rows(kind) { return JSON.parse(fs.readFileSync(path.join(dataRoot, kind === 'html' ? 'app.json' : 'bc.json'), 'utf8')); }

async function main() {
  let ctx = context({ username: 'admin001', password: 'a123456' });
  await new User(ctx).login();
  assert.strictEqual(ctx.body.code, 200);
  const token = ctx.body.data.token;
  ctx.headers.authorization = token;
  let allowed = false;
  await auth(ctx, async () => { allowed = true; });
  assert(allowed);
  for (const invalid of ['', 'bad-token', jwt.sign({ username: 'admin001', id: 1, loginTime: Date.now() }, config.uplink.jwtSecret)]) {
    const denied = context(); denied.headers.authorization = invalid;
    await auth(denied, async () => { throw new Error('unexpected access'); });
    assert.strictEqual(denied.body.code, -4);
  }
  const old = context();
  old.headers.authorization = jwt.sign({ username: 'admin001', password: 'a123456' }, config.uplink.jwtSecret);
  await auth(old, async () => { old.accepted = true; });
  assert(old.accepted);
  ctx = context({ username: 'admin001', password: 'wrong' });
  await new User(ctx).login(); assert.strictEqual(ctx.body.code, -1);
  ctx = context(); ctx.request.body.data = 'invalid encrypted body';
  await new User(ctx).login(); assert.strictEqual(ctx.body.code, -1);

  const original = rows('html').length;
  const item = { name: 'migration-test', index: 'test', status: 1, image: 'https://old.example/icon.png', url: 'https://healthy.example', user: 'test' };
  ctx = context(item); await new Index(ctx).createApp();
  assert.strictEqual(rows('html').length, original + 1);
  assert.strictEqual(dbWrites.length, 1);
  const preview = context();
  await new Index(preview).sbb02();
  assert.strictEqual(preview.body, fs.readFileSync(path.join(dataRoot, 'sbb02.html'), 'utf8'));
  assert.strictEqual(preview.type, 'text/html; charset=utf-8');
  const created = rows('html').find(row => row.name === item.name);
  ctx = context({ ...created, name: 'updated-test' }); await new Index(ctx).updateApp();
  assert(rows('html').some(row => row.id === created.id && row.name === 'updated-test'));
  ctx = context(); await new Index(ctx).appList(); assert.strictEqual(decoded(ctx).length, original + 1);
  ctx = context({ ...created, name: 'updated-test' }); await new Index(ctx).deleteApp();
  assert.strictEqual(rows('html').length, original);
  ctx = context(); await new Index(ctx).saveAppDb(); assert.strictEqual(decoded(ctx).success, original);

  const appSnapshot = JSON.stringify(rows('html'));
  const bcCount = rows('bc').length;
  ctx = context(item); await new Bc(ctx).createBC();
  const createdBc = rows('bc').find(row => row.name === item.name);
  ctx = context({ ...createdBc, name: 'bc-updated' }); await new Bc(ctx).updateBC();
  ctx = context({ beforeUrl: 'https://old.example', endUrl: 'https://new.example' }); await new Bc(ctx).imagesUrl();
  assert(rows('bc').find(row => row.id === createdBc.id).image.includes('new.example'));
  assert.strictEqual(JSON.stringify(rows('html')), appSnapshot);
  ctx = context({ ...createdBc, name: 'bc-updated' }); await new Bc(ctx).deleteBC();
  assert.strictEqual(rows('bc').length, bcCount);

  const targets = [{ val: 'https://target.example/api/updateAdvLinks' }];
  requestError = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
  ctx = context(targets); await new Index(ctx).updateServer(); assert.strictEqual(decoded(ctx)[0].code, 'ETIMEDOUT');
  requestError = Object.assign(new Error('unavailable'), { statusCode: 503 });
  ctx = context(targets); await new Bc(ctx).updateBCServer(); assert.strictEqual(decoded(ctx)[0].code, 503);
  requestError = null; requestResult = { code: -1, message: 'remote failure' };
  ctx = context(targets); await new Index(ctx).updateServer(); assert.strictEqual(decoded(ctx)[0].code, -1);
  requestResult = { code: 200 };
  ctx = context(targets); ctx.request.body.source = 'https://browser-source.example/html/';
  await new Index(ctx).updateServer(); assert.strictEqual(decoded(ctx)[0].code, 200);
  assert.strictEqual(requestOptions.body.link, 'https://browser-source.example/html/');
  requestResult = '<html>cached page</html>';
  ctx = context(targets); await new Index(ctx).updateServer(); assert.strictEqual(decoded(ctx)[0].code, 'INVALID_RESPONSE');
  ctx = context(); await new Index(ctx).updateAdvLinks();
  assert.strictEqual(localCacheWrites, 1, 'local update must refresh Redis');
  assert.strictEqual(visitorRefreshes, 1, 'local update must refresh visitor pages');
  assert(dbWrites.some(args => args[0].id === 10), 'local update must synchronize database');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(temp, 'cache/app_download/10.json'), 'utf8')).name, 'downloaded');
  assert.strictEqual(ctx.body.code, 200); assert.strictEqual(rows('html')[0].name, 'downloaded');
  const downloadedPreview = context();
  await new Index(downloadedPreview).sbb02();
  assert.strictEqual(downloadedPreview.body, downloadedHtml);
  downloadError = true; ctx = context();
  await new Index(ctx).updateAdvLinks();
  assert.strictEqual(ctx.body.code, 502); downloadError = false;
  const healthRows = [{ id: 1, status: 1, url: 'https://healthy.example' }, { id: 2, status: 1, url: 'https://failed.example' }];
  fs.writeFileSync(path.join(dataRoot, 'app.json'), JSON.stringify(healthRows));
  ctx = context(); await new Index(ctx).urlAllTest();
  assert.deepStrictEqual(decoded(ctx).map(row => row.urlstatus), [-1, 1]);
  const browser = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(dataRoot, 'testurl.js'), 'utf8'), browser);
  assert.strictEqual(browser.window.AppList.length, 2);
  // Both preview aliases use the same handler, which must re-read changed files.
  fs.writeFileSync(path.join(dataRoot, 'sbb02.html'), '<html>fresh preview</html>');
  const freshPreview = context();
  const previewHeaders = {};
  freshPreview.set = (name, value) => { previewHeaders[name] = value; };
  await new Index(freshPreview).sbb02();
  assert.strictEqual(freshPreview.body, '<html>fresh preview</html>');
  assert.strictEqual(previewHeaders['Cache-Control'], 'no-store');
  ctx = context({ id: 1 }); await new Index(ctx).urlAllTest(); assert.strictEqual(decoded(ctx).length, 1);

  // 初始化不能覆盖运行数据。
  data.ensure(dataRoot);
  assert.strictEqual(rows('html').length, 2);
  const routes = [];
  const proxy = new Proxy({}, { get: () => () => {} });
  require('../app/router/uplink')({
    router: {
      get: (url, handler) => {
        const names = { '/sbb02.html': 'sbb02', '/html/sbb02.html': 'sbb02', '/app.js': 'appjs', '/html/app.js': 'appjs', '/app.json': 'appjson', '/html/app.json': 'appjson' };
        assert(names[url]); assert.strictEqual(handler, Index.prototype[names[url]]);
      },
      post: (url, ...handlers) => { assert(handlers.every(h => typeof h === 'function')); routes.push(url); },
    },
    controller: { uplink: { index: Index.prototype, bc: Bc.prototype, user: User.prototype, bot: proxy, domain: proxy } },
    middleware: { uplinkLogin: () => auth },
  });
  assert.strictEqual(routes.length, 21);
  assert.strictEqual(new Set(routes).size, routes.length);
  assert(routes.every(url => url.startsWith('/api/uplink/')));
  const policy = require('../app/router/requestPolicy');
  assert.strictEqual(policy.shouldHandleAsSelectedRoute({ method: 'GET', path: '/sbb02.html', get: () => 'text/html' }), false);
  const entry = fs.readFileSync(path.join(base, 'app/router.js'), 'utf8');
  assert(entry.indexOf("require('./router/uplink')(app)") < entry.indexOf('loadSelectedRoute(app)'));
  const Router = require('@eggjs/router');
  for (const mode of ['default', 'fanmulu', 'static']) {
    const router = new Router();
    const previewHandler = async ctx => { ctx.body = 'uplink preview'; };
    const app = {
      router, baseDir: base, logger: { info() {} },
      controller: {
        uplink: { index: { ...proxy, ...Object.fromEntries(Object.getOwnPropertyNames(Index.prototype).map(key => [key, Index.prototype[key]])), sbb02: previewHandler }, bc: Bc.prototype, user: User.prototype, bot: proxy, domain: proxy },
        page: { link: proxy, articleComapmy: proxy, articleCbd: proxy, appDownload: proxy },
      },
      middleware: { uplinkLogin: () => auth },
    };
    require('../app/router/uplink')(app);
    load('app/router/loader.js', { './config': { loadRouteConfig: () => ({ mode }) } })(app);
    const matches = router.match('/sbb02.html', 'GET').pathAndMethod;
    assert.strictEqual(matches[0].stack[0], previewHandler, mode + ': preview must precede fallback');
    const previewCtx = {};
    await matches[0].stack[0](previewCtx);
    assert.strictEqual(previewCtx.body, 'uplink preview');
    assert.strictEqual(router.match('/sbb02.html', 'HEAD').pathAndMethod[0].stack[0], previewHandler);
    assert.strictEqual(router.match('/html/sbb02.html', 'GET').pathAndMethod[0].stack[0], previewHandler);
    for (const [url, name] of [['/html/app.js', 'appjs'], ['/html/app.json', 'appjson']]) {
      assert.strictEqual(router.match(url, 'GET').pathAndMethod[0].stack[0], Index.prototype[name]);
    }
    for (const [url, name] of [['/app.js', 'appjs'], ['/app.json', 'appjson']]) {
      assert.strictEqual(router.match(url, 'GET').pathAndMethod[0].stack[0], Index.prototype[name]);
      assert.strictEqual(router.match(url, 'HEAD').pathAndMethod[0].stack[0], Index.prototype[name]);
      const fileCtx = context(); fileCtx.set = () => {};
      await new Index(fileCtx)[name]();
      assert.strictEqual(fileCtx.body, fs.readFileSync(path.join(dataRoot, url.slice(1)), 'utf8'));
    }
    for (const url of routes) {
      assert.strictEqual(router.match(url, 'POST').pathAndMethod.length, 1, mode + ': ' + url);
    }
    if (mode !== 'default') {
      assert.strictEqual(router.match('/ordinary-article.html', 'GET').pathAndMethod[0].name, 'selected-' + mode + '-route');
    }
  }
  assert.strictEqual(policy.shouldHandleAsSelectedRoute({ method: 'GET', path: '/uplink/html/sbb02.html', get: () => 'text/html' }), false);
  console.log('PASS: independent login, APP/BQ functions, data isolation, and global preview plus 21 POST routes in default/fanmulu/static modes.');
}

main().then(() => {
  // 只清理本测试在工作区创建的目录，避免依赖系统临时目录权限。
  const resolved = fs.realpathSync(temp);
  assert.strictEqual(path.dirname(resolved).toLowerCase(), fs.realpathSync(__dirname).toLowerCase());
  assert(path.basename(resolved).startsWith('.uplink-test-'));
  fs.rmdirSync(temp, { recursive: true });
}).catch(error => {
  console.error(error);
  console.error('Test data retained at:', temp);
  process.exitCode = 1;
});
