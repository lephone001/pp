'use strict';

// node test/post-route-guard.js: real Egg router and multipart middleware, without database or file writes.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const Koa = require('koa');
const compose = require('koa-compose');
const { EggRouter } = require('@eggjs/router');
const loginFactory = require('../app/middleware/isLogin');
const guardFactory = require('../app/middleware/postRouteGuard');
const multipartFactory = require('egg-multipart/app/middleware/multipart');

function load(filename, override) {
  const fullpath = path.join(__dirname, '..', filename);
  const req = Module.createRequire(fullpath);
  const mod = { exports: {} };
  vm.runInNewContext(fs.readFileSync(fullpath, 'utf8'), {
    module: mod, process, require: name => override ? override(name, req) : req(name),
  });
  return mod.exports;
}

const Utils = load('app/controller/utils.js', (name, req) => name === 'egg'
  ? { Controller: class { constructor(ctx) { this.ctx = ctx; } } } : req(name));
const Boot = load('app.js', (name, req) => name === './app/lib/statsControl' ? { reload() {} } : req(name));

function setup(mode) {
  const app = new Koa();
  const counts = { body: 0, files: 0, auth: 0, warnings: [] };
  app.config = { jwt: { secret: 'test-secret' }, coreMiddleware: ['meta', 'notfound', 'bodyParser', 'overrideMethod', 'multipart'] };
  app.messenger = { on() {} };
  app.logger = { info() {}, error() {}, warn: (...args) => counts.warnings.push(args) };
  app.jwt = { verify: token => {
    counts.auth += 1;
    if (token !== 'valid-token') throw new Error('Invalid token');
    return { loginTime: 1, username: 'test', id: 'test-user' };
  } };
  new Boot(app);
  assert(app.config.coreMiddleware.indexOf('postRouteGuard') < app.config.coreMiddleware.indexOf('bodyParser'));
  assert(app.config.coreMiddleware.indexOf('postRouteGuard') < app.config.coreMiddleware.indexOf('multipart'));

  const nodes = new Map();
  const controllerNode = name => {
    if (nodes.has(name)) return nodes.get(name);
    const handler = name === 'utils.allPost' ? async ctx => new Utils(ctx).allPost()
      : async ctx => { ctx.body = { handler: name }; };
    const node = new Proxy(handler, { get: (target, key) => {
      if (typeof key === 'symbol' || key in target) return Reflect.get(target, key);
      return controllerNode(name ? name + '.' + key : key);
    } });
    nodes.set(name, node);
    return node;
  };
  app.controller = controllerNode('');
  app.middleware = new Proxy({}, { get: (target, name) => name === 'isLogin' ? loginFactory
    : () => async (ctx, next) => next() });
  app.router = new EggRouter({ sensitive: true }, app);
  const register = load('app/router.js', (name, req) => name === './router/loader' ? target => {
    target.activeRouteConfig = { mode };
    req('./router/' + mode)(target, target.activeRouteConfig);
  } : req(name));
  register(app);
  const guard = guardFactory({}, app);
  const middleware = {
    postRouteGuard: guard,
    bodyParser: async (ctx, next) => { if (ctx.method === 'POST') counts.body += 1; return next(); },
    multipart: multipartFactory({}),
  };
  const pipeline = compose(app.config.coreMiddleware.map(name => middleware[name] || (async (ctx, next) => next()))
    .concat(app.router.routes()));
  const createContext = (method, url, options = {}) => {
    const headers = options.filename ? { 'content-type': 'multipart/form-data; boundary=test', 'content-length': '1' } : {};
    if (options.token) headers.authorization = options.token;
    const ctx = app.createContext({ method, url, headers, socket: {} }, { statusCode: 404, setHeader() {}, getHeader() {}, removeHeader() {} });
    ctx.logger = app.logger;
    ctx.saveRequestFiles = async () => {
      counts.files += 1;
      if (options.filename && /\.(?:jsp|aspx)$/.test(options.filename)) {
        const error = new Error('Invalid filename: ' + options.filename);
        error.status = 400;
        throw error;
      }
      ctx.request.files = [{ filename: options.filename }];
    };
    ctx.service = {
      fanmuluArticle: { buildPage: async () => ({ template: 'selected-page.html', data: {} }) },
      localData: { getStaticRouteHtml: async () => '<html>Static page</html>' },
    };
    ctx.render = async template => { ctx.body = { template }; };
    return ctx;
  };
  const run = async (method, url, options) => {
    counts.body = 0;
    counts.files = 0;
    const ctx = createContext(method, url, options);
    await pipeline(ctx);
    return ctx;
  };
  return { app, counts, guard, createContext, run };
}

async function main() {
  for (const mode of ['default', 'fanmulu', 'static']) {
    const probe = setup(mode);
    const fallback = probe.app.router.stack[probe.app.router.stack.length - 1];
    assert.strictEqual(fallback.name, 'allPostFallback');
    assert.strictEqual(fallback.path, '/*');
    assert.strictEqual(fallback.methods.join(','), 'POST');

    // Every declared POST, including parameterized routes and the separate uplink router, passes the early guard.
    let checked = 0;
    for (const layer of probe.app.router.stack) {
      if (!layer.methods.includes('POST') || layer.name === 'allPostFallback') continue;
      const url = layer.path.replace(/:[A-Za-z0-9_]+/g, '6a868f38f80952a7e2609f97');
      let passed = false;
      await probe.guard(probe.createContext('POST', url), async () => { passed = true; });
      assert(passed, 'Existing POST route was intercepted: ' + layer.path);
      checked += 1;
    }
    assert(checked > 100);

    const attacks = [
      '/icons/small/govezoffice/gov_documentmanager/senddocument_import.jsp?categoryId=1&path=archives',
      '/icons/defaultroot/govezoffice/custom_documentmanager/smartUpload.jsp?path=..&fileType=jsp',
      '/detail/6785d391ba2bd4098f98a2ea/CMSUploadFile.aspx',
      '/api/unregistered-upload', '/',
    ];
    for (const url of attacks) {
      for (const token of [undefined, 'valid-token']) {
        const ctx = await probe.run('POST', url, { token, filename: 'test.jsp' });
        assert.strictEqual(ctx.status, 444);
        assert.strictEqual(ctx.body, '');
        assert.strictEqual(probe.counts.auth, 0);
        assert.strictEqual(probe.counts.body, 0);
        assert.strictEqual(probe.counts.files, 0);
      }
    }
    const forged = await probe.run('POST', attacks[0], { token: 'forged-token', filename: '1122.aspx' });
    assert.strictEqual(forged.status, 444);
    assert.strictEqual(forged.body, '');
    assert.strictEqual(probe.counts.auth, 0);
    assert.strictEqual(probe.counts.warnings.length, 0);
    assert.strictEqual(probe.counts.files, 0);
    const unknownJson = await probe.run('POST', '/api/unknown', { token: 'valid-token' });
    assert.strictEqual(unknownJson.status, 444);
    assert.strictEqual(unknownJson.body, '');
    assert.strictEqual(probe.counts.body, 0);

    for (const [url, handler] of [
      ['/api/loginseo', 'user.login'], ['/api/uplink/user/login', 'uplink.user.login'],
      ['/api/missSourceUpload', 'missUpload.sourceUpload'],
    ]) {
      const ctx = await probe.run('POST', url, { filename: 'photo.jpg' });
      assert.strictEqual(ctx.body.handler, handler);
      assert.strictEqual(probe.counts.body, 1);
      assert.strictEqual(probe.counts.files, 1);
    }
    for (const [url, handler] of [
      ['/api/delNote', 'note.delNote'], ['/api/missUpload', 'missUpload.upload'],
      ['/api/wenzhang/create', 'wenzhang.manage'],
    ]) {
      const ctx = await probe.run('POST', url, { token: 'valid-token', filename: 'photo.jpg' });
      assert.strictEqual(ctx.body.handler, handler);
      assert.strictEqual(probe.counts.files, 1);
    }
    const protectedApi = await probe.run('POST', '/api/delNote');
    assert.strictEqual(protectedApi.body.code, -4);
    assert.strictEqual(probe.counts.body, 1);
    await assert.rejects(probe.run('POST', '/api/missUpload', { token: 'valid-token', filename: 'test.jsp' }), error => error.status === 400);
    assert.strictEqual(probe.counts.files, 1);

    for (const method of ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']) {
      let passed = false;
      await probe.guard(probe.createContext(method, '/arbitrary-page'), async () => { passed = true; });
      assert(passed, method + ' was intercepted');
    }
    const page = await probe.run('GET', '/sadfasd');
    assert(page.body);
    assert.strictEqual(probe.counts.files, 0);
    const robots = await probe.run('GET', '/robots.txt');
    assert.strictEqual(robots.body.handler, 'page.index.robots');
    const directFallback = probe.createContext('POST', '/unknown', { token: 'valid-token' });
    await probe.app.router.routes()(directFallback, async () => {});
    assert.strictEqual(directFallback.status, 444);
    assert.strictEqual(directFallback.body, '');
  }
  console.log('PASS: unknown POSTs return empty 444 without authentication or body/file parsing; existing APIs, uploads, auth and GET pages remain correct in all three route modes.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
