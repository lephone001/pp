'use strict';

// node test/jump-fallback.js: run real jump/sbb02 methods and the unbound-domain branch without file writes or a database.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const acorn = require('acorn');
const defaultPath = '/project/app/public/html/sbb02.html';
const defaultHtml = '<html><body>Default page data</body></html>';
const jumpSource = fs.readFileSync(path.join(__dirname, '../app/middleware/jump.js'), 'utf8');
const controllerSource = fs.readFileSync(path.join(__dirname, '../app/controller/uplink/index.js'), 'utf8');
const controllerClass = acorn.parse(controllerSource, { ecmaVersion: 2020 }).body.find(node => node.type === 'ClassDeclaration');
const defaultMethod = controllerClass.body.body.find(node => node.key.name === 'sbb02');
const defaultCode = 'class DefaultController { constructor(ctx) { this.ctx = ctx; } '
  + controllerSource.slice(defaultMethod.start, defaultMethod.end) + '} module.exports = DefaultController;';

function setup(domain, files = {}) {
  const pages = { [defaultPath]: defaultHtml, ...files };
  const calls = { fallback: 0, next: 0, reads: [] };
  const read = filename => {
    calls.reads.push(filename);
    if (!Object.prototype.hasOwnProperty.call(pages, filename) || pages[filename] === null) throw new Error('Missing page');
    return pages[filename];
  };
  const fakeFs = {
    existsSync: filename => Object.prototype.hasOwnProperty.call(pages, filename) && pages[filename] !== null,
    readFileSync: read, promises: { readFile: async filename => read(filename) },
  };
  const controllerModule = { exports: {} };
  vm.runInNewContext(defaultCode, { module: controllerModule, fs: fakeFs, nameHtml002FilePath: defaultPath });
  const jumpModule = { exports: {} };
  vm.runInNewContext(jumpSource, {
    module: jumpModule, process: { cwd: () => '/project' },
    require: name => {
      if (name === 'fs') return fakeFs;
      if (name === 'moment') return { locale() {} };
      if (name === 'axios') return {};
      throw new Error('Unexpected dependency: ' + name);
    },
  });
  const ctx = {
    status: 200, headers: {}, request: { header: {} },
    set(name, value) { this.headers[name] = value; },
    service: { utils: { getSiteInfo: async () => ({ domain }) } },
    app: { controller: { uplink: { index: { sbb02: function () {
      calls.fallback += 1;
      assert.strictEqual(this, ctx, 'The Egg controller must receive the original context');
      return new controllerModule.exports(this).sbb02();
    } } } } },
  };
  const middleware = jumpModule.exports();
  const run = () => middleware(ctx, async () => { calls.next += 1; ctx.body = '<article>Normal page</article>'; });
  return { ctx, calls, run };
}

async function main() {
  const bound = { _id: 'bound-domain', isMobile: true, spider: false, isOpenUrl: 1 };
  const emptyConfigurations = [undefined, null, {}, [], 'invalid', { gajs: '<script>Tracking</script>' },
    { openUrlH5: '' }, { openUrlH5: '   ' }, { openUrlH5: '####' }, { isAgentPage: true }];
  const domains = [undefined, null, { host: 'unknown', isMobile: true }]
    .concat(emptyConfigurations.map(agentLink => ({ ...bound, agentLink })));
  for (const domain of domains) {
    const probe = setup(domain);
    await probe.run();
    assert.strictEqual(probe.ctx.body, defaultHtml);
    assert.strictEqual(probe.ctx.type, 'text/html; charset=utf-8');
    assert.strictEqual(probe.ctx.headers['Cache-Control'], 'no-store');
    assert.strictEqual(probe.ctx.status, 200);
    assert.strictEqual(probe.calls.fallback, 1);
    assert.strictEqual(probe.calls.next, 0);
  }
  for (const custom of [null, '']) {
    const probe = setup({ ...bound, agentLink: { isAgentPage: true, agentPageName: 'custom' } },
      { '/project/app/public/html/custom.html': custom });
    await probe.run();
    assert.strictEqual(probe.ctx.body, defaultHtml);
    assert.strictEqual(probe.calls.fallback, 1);
  }
  const local = setup({ ...bound, agentLink: { isAgentPage: true, agentPageName: 'custom', gajs: '<script>Tracking</script>' } },
    { '/project/app/public/html/custom.html': '<body>Custom</body>' });
  await local.run();
  assert.strictEqual(local.ctx.status, 403);
  assert.strictEqual(local.ctx.body, '<body>Custom<script>Tracking</script></body>');
  assert.strictEqual(local.calls.fallback, 0);
  const spacedLocal = setup({ ...bound, agentLink: { isAgentPage: true, agentPageName: ' custom ' } },
    { '/project/app/public/html/custom.html': '<body>Custom</body>' });
  await spacedLocal.run();
  assert.strictEqual(spacedLocal.ctx.body, '<body>Custom</body>');
  assert.strictEqual(spacedLocal.calls.fallback, 0);
  const remote = setup({ ...bound, agentLink: { openUrlH5: 'https://example.test/landing', gajs: '<script>Tracking</script>' } });
  await remote.run();
  assert.strictEqual(remote.ctx.status, 403);
  assert(remote.ctx.body.includes('https://example.test/landing'));
  assert(remote.ctx.body.includes('<script>Tracking</script>'));
  for (const url of ["https://example.test/landing?q=O'Reilly", 'https://example.test/landing?next=</script>',
    'https://example.test/landing?next=C:\\folder', 'https://example.test/landing']) {
    for (const encoded of [false, true]) {
      const rawUrl = encoded ? url.split('').join('##') : url;
      const probe = setup({ ...bound, agentLink: { openUrlH5: ' ' + rawUrl + ' ' } });
      await probe.run();
      assert.strictEqual(probe.ctx.status, 403);
      const script = probe.ctx.body.match(/<script>([\s\S]*?)<\/script>/)[1];
      const frames = [];
      vm.runInNewContext(script, { window: {}, navigator: { userAgent: 'Mobile' }, document: { writeln: html => frames.push(html) } });
      assert.strictEqual(frames.length, 1);
      assert(frames[0].includes('src="' + url + '"'));
    }
  }
  const passThroughDomains = [];
  for (const override of [{ isMobile: false }, { spider: true }, { isOpenUrl: -1 }]) {
    passThroughDomains.push({ host: 'unknown', isMobile: true, ...override });
    passThroughDomains.push({ ...bound, agentLink: { openUrlH5: 'https://example.test/landing' }, ...override });
    passThroughDomains.push(...emptyConfigurations.map(agentLink => ({ ...bound, agentLink, ...override })));
    passThroughDomains.push({ ...bound, agentLink: { isAgentPage: true, agentPageName: 'custom' }, ...override });
  }
  for (const domain of passThroughDomains) {
    const probe = setup(domain);
    await probe.run();
    assert.strictEqual(probe.calls.next, 1);
    assert.strictEqual(probe.calls.fallback, 0);
    assert.strictEqual(probe.ctx.status, 200);
    assert.strictEqual(probe.calls.reads.length, 0);
  }

  const utilsSource = fs.readFileSync(path.join(__dirname, '../app/service/utils.js'), 'utf8');
  const ast = acorn.parse(utilsSource, { ecmaVersion: 2020 });
  const cls = ast.body.find(node => node.type === 'ClassDeclaration');
  const getter = cls.body.body.find(node => node.key.name === 'getSiteInfo');
  const markers = ast.body.find(node => node.type === 'VariableDeclaration'
    && node.declarations.some(declaration => declaration.id.name === 'MOBILE_UA_MARKERS'));
  const mod = { exports: {} };
  vm.runInNewContext(utilsSource.slice(markers.start, markers.end) + '\nclass SiteProbe {'
    + utilsSource.slice(getter.start, getter.end) + '} module.exports = SiteProbe;', { module: mod, isIP: require('net').isIP });
  const service = new mod.exports();
  service.ctx = {
    hostname: 'www.unbound.example', request: { header: { host: 'www.unbound.example', 'user-agent': 'Android Mobile' } },
    service: { domain: { findDomain: async () => ({ data: null }) } },
  };
  const unbound = await service.getSiteInfo();
  assert.strictEqual(unbound.domain.isMobile, true);
  assert(unbound.domain.agentLink && typeof unbound.domain.agentLink === 'object');
  const fromService = setup(unbound.domain);
  await fromService.run();
  assert.strictEqual(fromService.ctx.body, defaultHtml);
  console.log('PASS: missing domain returns sbb02; domain placeholders honor jump conditions; page names normalize consistently and encoded/quoted URLs execute correctly.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
