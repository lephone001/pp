'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const base = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(__dirname, '.adv-update-test-'));
const directory = path.join(temp, 'app/public/html');
fs.mkdirSync(directory, { recursive: true });
let failJson = false;
let mixed = false;
function script(host) { return 'var JIAMIAPPJSONLIST = "' + encodeURIComponent(JSON.stringify([{ id: 123, name: host, status: 1 }])) + '";'; }
function html(host) { return '<html><script>' + script(host) + '</script></html>'; }
const requested = [];
const axios = { get: async (url, options) => {
  requested.push(url);
  assert.strictEqual(options.timeout, 30000);
  assert(/Baiduspider/i.test(options.headers['User-Agent']));
  if (url.includes('app.json')) return { data: failJson ? '<html>wrong page</html>' : [{ id: 123, name: new URL(url).hostname, status: 1 }] };
  if (url.includes('app.js')) return { data: script(new URL(url).hostname) };
  return { data: html(mixed ? 'wrong.test' : new URL(url).hostname) };
} };
function load(file, mocks, fakeProcess) {
  const filename = path.join(base, file);
  const localRequire = Module.createRequire(filename);
  const mod = { exports: {} };
  const req = name => Object.prototype.hasOwnProperty.call(mocks, name) ? mocks[name] : localRequire(name);
  const wrapper = '(function(require,module,exports,__dirname,process){' + fs.readFileSync(filename, 'utf8') + '\n})';
  vm.runInThisContext(wrapper, { filename })(req, mod, mod.exports, path.dirname(filename), fakeProcess || process);
  return mod.exports;
}
const helper = load('app/lib/advUpdateSource.js', { axios });
class Controller { constructor(ctx) { this.ctx = ctx; } }
class Service { constructor(ctx) { this.ctx = ctx; this.app = ctx.app; } }
const LocalData = load('app/service/localData.js', { egg: { Service }, axios });
const Receiver = load('app/controller/page/link.js', {
  egg: { Controller }, '../../lib/advUpdateSource': helper,
}, { cwd: () => temp });

async function main() {
  assert.strictEqual(helper.currentSource({ origin: 'http://source-a.test:7008', app: { config: { uplink: {} } } }), 'http://source-a.test:7008/html/');
  assert.strictEqual(helper.currentSource({ origin: 'http://local.test', app: { config: { uplink: { updateSource: 'https://public.test/html' } } } }), 'https://public.test/html/');
  for (const host of ['source-a.test', 'source-b.test']) {
    const ctx = { request: { body: { link: 'http://' + host + ':7008/html' } }, logger: { warn() {}, error() {} } };
    const receiver = new Receiver(ctx);
    let cached;
    receiver.setAppJsCache = async js => { cached = js; };
    receiver.syncAppDownloadList = async list => ({ total: list.length, success: list.length, fail: 0 });
    receiver.writeAppDownloadJsonList = () => ({});
    const notifications = [];
    ctx.app = {
      baseDir: temp, config: {}, logger: ctx.logger,
      sitePageHtmlRuntime: { pc: 'old PC page', h5: 'old H5 page' },
      messenger: { sendToApp: (...args) => notifications.push(args) },
    };
    const localData = new LocalData(ctx);
    localData.getRuntimeSiteServerInfo = async () => ({
      pc_page: { use_url: true, url: 'sbb02.html' },
      h5_page: { use_url: true, url: 'sbb02.html' },
    });
    ctx.service = { localData };
    await receiver.updateAdvLinks();
    assert.strictEqual(ctx.body.code, 200);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(directory, 'app.json'), 'utf8'))[0].name, host);
    assert.strictEqual(fs.readFileSync(path.join(directory, 'sbb02.html'), 'utf8'), html(host));
    assert.strictEqual(fs.readFileSync(path.join(directory, 'app.js'), 'utf8'), cached);
    for (const device of ['pc', 'h5']) {
      assert.strictEqual(ctx.app.sitePageHtmlRuntime[device], html(host));
      assert.strictEqual(fs.readFileSync(localData.pageFilePath(device), 'utf8'), html(host));
      assert.strictEqual(ctx.body.page_fetch_status.find(item => item.device === device).status, 'completed');
    }
    assert.strictEqual(notifications[0][0], 'site-server-info-updated');
    assert(requested.slice(-3).every(url => url.startsWith('http://' + host + ':7008/html/')));
    receiver.refreshVisitorPageCacheAfterAdvUpdate = async () => [{ device: 'pc', status: 'failed' }];
    await receiver.updateAdvLinks();
    assert.strictEqual(ctx.body.code, 500, 'failed page refresh must not report success');
    assert.strictEqual(ctx.body.source, 'http://' + host + ':7008/html/');
  }
  mixed = true;
  const oldHtml = fs.readFileSync(path.join(directory, 'sbb02.html'), 'utf8');
  const mismatch = { app: { baseDir: temp }, request: { body: { link: 'http://mixed.test/html/' } }, logger: { warn() {} } };
  await new Receiver(mismatch).updateAdvLinks();
  assert.strictEqual(mismatch.body.code, 502);
  assert.strictEqual(fs.readFileSync(path.join(directory, 'sbb02.html'), 'utf8'), oldHtml);
  mixed = false;
  failJson = true;
  const before = fs.readFileSync(path.join(directory, 'app.json'), 'utf8');
  const ctx = { app: { baseDir: temp }, request: { body: { link: 'http://failed.test/html/' } }, logger: { warn() {} } };
  await new Receiver(ctx).updateAdvLinks();
  assert.strictEqual(ctx.body.code, 502);
  assert.strictEqual(fs.readFileSync(path.join(directory, 'app.json'), 'utf8'), before);
  ctx.request.body = {};
  await new Receiver(ctx).updateAdvLinks();
  assert.strictEqual(ctx.body.code, 502);
  const resolved = fs.realpathSync(temp);
  assert.strictEqual(path.dirname(resolved), fs.realpathSync(__dirname));
  assert(path.basename(resolved).startsWith('.adv-update-test-'));
  fs.rmdirSync(resolved, { recursive: true });
  console.log('PASS: caller-selected sources, 30s downloads, actual file replacement, cache refresh, invalid source/download preserves existing files.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
