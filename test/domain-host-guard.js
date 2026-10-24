'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const Koa = require('koa');
const compose = require('koa-compose');
const { EggRouter } = require('@eggjs/router');
const guardFactory = require('../app/middleware/domainHostGuard');
const { reloadDomainHostList } = require('../app/lib/domainHostCache');

async function main() {
  const baseDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'domain-host-guard-'));
  const filename = path.join(baseDir, 'app', 'local_data', 'allDomainList.txt');
  await fs.promises.mkdir(path.dirname(filename), { recursive: true });
  await fs.promises.writeFile(filename, '\uFEFFExample.com:7001\r\na.com\r\nsub.other.test\r\nlocalhost:7001\r\n127.0.0.1:7001\r\n192.168.137.1:7001\r\n[::1]\r\n[2001:db8::1]\r\n[::ffff:127.0.0.1]\r\n*.wild.test\r\n\u4f8b\u5b50.\u4e2d\u56fd\r\n');
  const warnings = [];
  let handled = 0;
  const app = new Koa();
  app.baseDir = baseDir;
  app.proxy = true;
  app.logger = { info() {}, error() {}, warn: (...args) => warnings.push(args) };
  const nodes = new Map();
  function controllerNode(name) {
    if (nodes.has(name)) return nodes.get(name);
    const handler = async ctx => { handled++; ctx.body = { handler: name }; };
    const node = new Proxy(handler, { get(target, key) {
      if (typeof key === 'symbol' || key in target) return Reflect.get(target, key);
      return controllerNode(name ? name + '.' + key : key);
    } });
    nodes.set(name, node);
    return node;
  }
  app.controller = controllerNode('');
  // Keep Koa's middleware array, while exposing Egg-style middleware factories.
  app.middleware = new Proxy(app.middleware, { get(target, key) {
    if (key === 'domainHostGuard') return guardFactory;
    if (typeof key === 'symbol' || key in target) return Reflect.get(target, key);
    return () => async (ctx, next) => next();
  } });
  app.router = new EggRouter({ sensitive: true }, app);
  const routerFile = path.join(__dirname, '../app/router.js');
  const requireFromRouter = Module.createRequire(routerFile);
  const mod = { exports: {} };
  vm.runInNewContext(fs.readFileSync(routerFile, 'utf8'), {
    module: mod, process,
    require(name) {
      if (name === './router/loader') return () => {};
      return requireFromRouter(name);
    },
  });
  mod.exports(app);
  assert.strictEqual(app.middleware[0].name, 'domainHostGuard');
  const pipeline = compose(app.middleware.concat(app.router.routes()));
  async function request(host, method = 'GET', url = '/billing', forwardedHost) {
    const headers = {};
    if (host) headers.host = host;
    if (forwardedHost) headers['x-forwarded-host'] = forwardedHost;
    const ctx = app.createContext({ method, url, headers, socket: {} }, {
      statusCode: 404, setHeader() {}, getHeader() {}, removeHeader() {},
    });
    ctx.logger = app.logger;
    ctx.service = new Proxy({}, { get() { throw new Error('Host validation must not access services or MongoDB'); } });
    await pipeline(ctx);
    return ctx;
  }
  let reads = 0;
  let stats = 0;
  const readFile = fs.promises.readFile;
  const stat = fs.promises.stat;
  fs.promises.readFile = async (target, ...args) => {
    if (target === filename) reads++;
    return readFile.call(fs.promises, target, ...args);
  };
  fs.promises.stat = async (target, ...args) => {
    if (target === filename) stats++;
    return stat.call(fs.promises, target, ...args);
  };
  try {
    let postPassed = false;
    await guardFactory()({ method: 'POST' }, async () => { postPassed = true; });
    assert.strictEqual(postPassed, true, 'POST must bypass Host and file access entirely');
    const publicPaths = [
      [ '/sbb02.html', 'uplink.index.sbb02' ],
      [ '/html/sbb02.html', 'uplink.index.sbb02' ],
      [ '/app.js', 'uplink.index.appjs' ],
      [ '/html/app.js', 'uplink.index.appjs' ],
      [ '/app.json', 'uplink.index.appjson' ],
      [ '/html/app.json', 'uplink.index.appjson' ],
    ];
    for (const [ url, handler ] of publicPaths) {
      for (const method of [ 'GET', 'HEAD' ]) {
        let passed = false;
        await guardFactory()({ method, path: url, get() { throw new Error('Public paths must not read Host'); } }, async () => { passed = true; });
        assert.strictEqual(passed, true);
        for (const host of [ 'evil.test', '127.0.0.1:7001', '[::1]:7001', '' ]) {
          const ctx = await request(host, method, url + '?v=123');
          assert.strictEqual(ctx.status, 200, 'Public resource rejected: ' + method + ' ' + host + url);
          assert.strictEqual(ctx.body.handler, handler);
        }
      }
    }
    assert.strictEqual(reads, 0, 'Public resources must bypass the domain file entirely');
    assert.strictEqual(stats, 0);
    for (const host of [ '127.0.0.1:7001', '192.168.137.1:7001', '[::1]:7001', '[2001:db8::1]:7001', '[::ffff:127.0.0.1]:7001', '2130706433:7001', '0x7f000001:7001', '0177.0.0.1:7001' ]) {
      const before = handled;
      const ctx = await request(host, 'GET', '/WenZhang/list.html');
      assert.strictEqual(ctx.status, 444, 'Direct IP access must be rejected: ' + host);
      assert.strictEqual(ctx.body, '');
      assert.strictEqual(handled, before);
    }
    assert.strictEqual(reads, 0, 'IP rejection must not load the domain file');
    assert.strictEqual(stats, 0);
    await Promise.all(Array.from({ length: 20 }, () => request('example.com')));
    assert.strictEqual(reads, 1, 'Concurrent first requests must share one file read');
    for (const [ url ] of publicPaths) {
      for (const method of [ 'PUT', 'DELETE', 'OPTIONS' ]) {
        assert.strictEqual((await request('evil.test', method, url)).status, 444);
      }
    }
    for (const url of [ '/app.js.bak', '/html/app.json/extra', '/not/sbb02.html', '/html/other.html' ]) {
      assert.strictEqual((await request('evil.test', 'GET', url)).status, 444, 'Only exact public paths may bypass validation');
    }
    for (const host of [
      'example.com', 'example.com:7001', 'www.example.com:7001', 'a.b.example.com:8080',
      'WWW.EXAMPLE.COM.:443', 'sub.other.test', 'a.sub.other.test', 'localhost:7001',
      'www_ke-teng_com.a.com', 'a_b.c-a.a.com:8080',
      'wild.test', 'a.b.wild.test', 'xn--fsqu00a.xn--fiqs8s',
    ]) {
      const before = handled;
      const ctx = await request(host);
      assert.strictEqual(ctx.status, 200, 'Allowed host rejected: ' + host);
      assert.strictEqual(handled, before + 1);
    }
    for (const host of [
      'evil.test', 'evilexample.com', 'example.com.evil.test', 'other.test',
      'www_ke-teng_com.unknown.test',
      'fake.127.0.0.1', '127.0.0.1:7001', '192.168.137.1:7001', '[::1]:7001',
      '[2001:db8::1]:7001', '[::ffff:127.0.0.1]:7001', '127.0.0.2', '[::2]', '', 'http://example.com',
      'user@example.com', 'example.com/path', 'example.com\\evil', 'exa mple.com',
      'a..example.com', 'example.com:99999',
    ]) {
      for (const method of [ 'GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS' ]) {
        const before = handled;
        const ctx = await request(host, method);
        assert.strictEqual(ctx.status, 444, 'Unknown host accepted: ' + method + ' ' + host);
        assert.strictEqual(ctx.body, '');
        assert.strictEqual(handled, before);
      }
    }
    assert.strictEqual((await request('evil.test', 'GET', '/', 'example.com')).status, 444);
    assert.strictEqual((await request('127.0.0.1:7001', 'GET', '/WenZhang/list.html', 'example.com')).status, 444);
    assert.strictEqual((await request('example.com', 'GET', '/', 'evil.test')).status, 200);
    assert.strictEqual((await request('www.example.com', 'POST', '/api/updateAllDomainList')).body.handler, 'domain.updateAllDomainList');
    for (const host of [ 'evil.test', '', 'example.com:99999', '127.0.0.1:7001', '[::1]:7001' ]) {
      assert.strictEqual((await request(host, 'POST', '/api/createDomain')).body.handler, 'domain.createDomain');
    }
    assert.strictEqual(reads, 1, 'Subsequent requests must use memory without reading the file');
    assert.strictEqual(stats, 0, 'Requests must not stat the domain file');

    // File updates take effect when the update notification refreshes the cache.
    await fs.promises.writeFile(filename + '.next', 'new.test\n');
    await fs.promises.rename(filename + '.next', filename);
    assert.strictEqual((await request('example.com')).status, 200);
    assert.strictEqual(reads, 1);
    await reloadDomainHostList(baseDir, app.logger);
    assert.strictEqual((await request('example.com')).status, 444);
    assert.strictEqual((await request('a.b.new.test')).status, 200);
    await fs.promises.writeFile(filename, '');
    await reloadDomainHostList(baseDir, app.logger);
    assert.strictEqual((await request('new.test')).status, 444);
    assert.strictEqual((await request('evil.test', 'POST', '/api/createDomain')).body.handler, 'domain.createDomain');
    await fs.promises.unlink(filename);
    assert.strictEqual((await request('evil.test', 'POST', '/api/createDomain')).body.handler, 'domain.createDomain');
    assert.strictEqual(warnings.length, 0);
    await reloadDomainHostList(baseDir, app.logger);
    const readsAfterFailure = reads;
    assert.strictEqual((await request('new.test')).status, 444);
    assert.strictEqual((await request('new.test')).status, 444);
    assert.strictEqual(reads, readsAfterFailure, 'Failed reads must also be cached');
    assert.strictEqual(warnings.length, 1);
    await fs.promises.writeFile(filename, 'restored.test\n');
    await reloadDomainHostList(baseDir, app.logger);
    assert.strictEqual((await request('www.restored.test')).status, 200);
    console.log('PASS: exact public GET/HEAD routes, domain/subdomain matching, IPv4/IPv6 rejection before file access, POST bypass, memory cache refresh and fail-closed behavior');
  } finally {
    fs.promises.readFile = readFile;
    fs.promises.stat = stat;
    assert(path.resolve(baseDir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.promises.rm(baseDir, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
