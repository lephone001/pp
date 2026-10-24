'use strict';

// Local-only visual preview, without starting Egg, Redis or MongoDB.
const http = require('http');
const fs = require('fs');
const path = require('path');
const nunjucks = require('nunjucks');
const FanmuluArticle = require('../app/service/fanmuluArticle');
const root = path.resolve(__dirname, '..');
const publicRoot = path.join(root, 'app/public');
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader([ path.join(root, 'app/view'), path.join(root, 'app/common_data/Article/templates') ], { noCache: true }), { autoescape: true });

async function createPreviewServer() {
  const app = { baseDir: root, config: {}, logger: console };
  function serviceFor(req) {
    const ctx = { app, host: req.headers.host || '127.0.0.1', protocol: 'http',
      path: new URL(req.url, 'http://localhost').pathname, url: req.url, originalUrl: req.url,
      get: name => req.headers[name.toLowerCase()] || '', logger: console };
    const service = new FanmuluArticle(ctx);
    // Preview only this theme, without changing production settings or cache files.
    service.ensureDirectories = async () => {};
    service.getSettings = async () => ({ enabled: true, enabledTemplates: [ 'download_portal' ], friendLinksEnabled: true, spiderStrongEnabled: false });
    service.getPageState = (identity, templates) => service.createPageState(identity, templates);
    return { ctx, service };
  }
  await serviceFor({ url: '/', headers: {} }).service.preloadRuntimeData(true);
  return http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/' || pathname === '/index.html' || pathname.startsWith('/Article/')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Portal-Preview', 'article-library-v1');
    const { ctx, service } = serviceFor(req);
    service.buildPage(ctx, { globalRoute: true }).then(page => {
      res.end(env.render(page.template, page.data));
    }).catch(error => {
      console.error(error);
      res.statusCode = 500;
      res.end('Preview rendering failed; check the preview console.');
    });
    return;
  }
  const file = path.resolve(publicRoot, '.' + pathname);
  if (!file.startsWith(publicRoot + path.sep)) { res.statusCode = 404; return res.end(); }
  fs.readFile(file, (error, bytes) => {
    if (error) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', { '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream');
    res.end(bytes);
  });
  });
}

module.exports = createPreviewServer;
if (require.main === module) {
  const port = Number(process.env.PORTAL_PREVIEW_PORT || 17865);
  createPreviewServer().then(server => {
    server.listen(port, '127.0.0.1', () => console.log('Article library preview: http://127.0.0.1:' + port + '/'));
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
