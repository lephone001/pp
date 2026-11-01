'use strict';

// Export the finite, currently reachable vn_waji_4 site from its running Egg server.
// node scripts/export-vn-waji4-static.js [--limit=10] [--no-assets]
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const cheerio = require('cheerio');
const fse = require('fs-extra');

const baseDir = path.resolve(__dirname, '..');
const templateDir = path.join(baseDir, 'app/view/template/vn_waji_4');
const outputDir = path.resolve(process.env.STATIC_EXPORT_DIR || 'C:/Windows/dev/ductoan_v4');
const origin = 'http://ductoan.cc:7005';
const originHost = new URL(origin).host;
const limitArg = process.argv.find(value => /^--limit=\d+$/.test(value));
const maxPages = limitArg ? Number(limitArg.split('=')[1]) : 3000;
const copyAssets = !process.argv.includes('--no-assets');
const excludedRootPages = /^(?:common_.*|article_cbd_detail|article_cdb_list|article_list|app_download|detail|news-detail(?: copy)?)\.html$/i;
const excludedDirs = new Set([ 'static', 'wp-content', 'wp-includes' ]);
const sourceFiles = new Set();
const queued = [];
const seen = new Set();
const exported = [];
const skipped = [];
const broken = [];
const numericRepresentative = new Map();
const numericRepresentativeValues = new Set();
let homepageResponse = null;
let repairedLinks = 0;
let repairedAssets = 0;
let removedMetadata = 0;

function safeRelative(relative) {
  const parts = relative.split('/').map(part => {
    try { return decodeURIComponent(part); } catch (_) { return part; }
  });
  if (parts.some(part => !part || part === '.' || part === '..' || /[<>:"\\|?*\u0000-\u001f]/.test(part))) return null;
  return parts.join('/');
}

function outputPath(url) {
  const pathname = url.pathname;
  let relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  if (pathname.endsWith('/') && pathname !== '/') relative += 'index.html';
  else if (!/\.html?$/i.test(relative)) relative += '/index.html';
  if (url.search && /(?:^|[?&])(?:cursor|lastId|prevId)=/.test(url.search)) {
    const hash = crypto.createHash('sha1').update(url.search).digest('hex').slice(0, 12);
    relative = relative.replace(/\.html?$/i, '-q-' + hash + '.html');
  }
  relative = safeRelative(relative);
  if (!relative) return null;
  const full = path.resolve(outputDir, relative);
  if (!full.startsWith(outputDir + path.sep)) return null;
  return { relative: relative.split(path.sep).join('/'), full };
}

function staticHref(url) {
  const output = outputPath(url);
  return output ? '/' + output.relative + url.hash : '';
}

function normalizeUrl(input, parent = origin + '/') {
  let url;
  try { url = new URL(input, parent); } catch (_) { return null; }
  if (!/^https?:$/.test(url.protocol) || url.host !== originHost) return null;
  if (url.pathname.startsWith('/vn_waji_4/') && /\.html?$/i.test(url.pathname)) {
    url.pathname = url.pathname.replace(/^\/vn_waji_4/, '');
  }
  const numeric = /^(\/[^?#]+)\/(\d+)\/?$/.exec(url.pathname);
  if (numeric && numericRepresentative.has(numeric[1])) url.pathname = numericRepresentative.get(numeric[1]);
  if (/^\/Duc(?:%20| )Toan\/\d+\/?$/i.test(url.pathname)) url.pathname = '/duc-toan.html';
  if (/^\/(?:api|admin|dist|uploads|images|static|vn_waji_4\/static|vn_waji_4\/wp-)/i.test(url.pathname)) return null;
  if (!url.pathname.startsWith('/') || url.pathname.includes('/../')) return null;
  if (url.search && !/(?:^|[?&])(?:cursor|lastId|prevId)=/.test(url.search)) url.search = '';
  url.hash = '';
  return url;
}

function isKnownPage(url) {
  const pathname = url.pathname;
  if (numericRepresentativeValues.has(pathname)) return true;
  if (/^\/(?:detail|v-nd)\/[a-f0-9]{24}(?:\.html|\/index\.html)?$/i.test(pathname)) return true;
  if (/^\/(?:v-nl\/list|article|sitemap)\.html$/i.test(pathname)) return true;
  const relative = safeRelative(pathname.replace(/^\/+/, ''));
  if (!relative) return pathname === '/';
  return sourceFiles.has(relative) || sourceFiles.has(relative + '.html') || sourceFiles.has(relative.replace(/\/$/, '') + '/index.html');
}

function addPage(input, parent, fromHomepage = false) {
  const url = normalizeUrl(input, parent);
  if (!url || (!fromHomepage && !isKnownPage(url))) return;
  const output = outputPath(url);
  if (!output) return;
  const key = url.pathname + url.search;
  if (seen.has(key) || seen.size >= maxPages) return;
  seen.add(key);
  queued.push(url);
}

async function walk(dir, prefix = '') {
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const relative = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      if (!excludedDirs.has(entry.name) || prefix) await walk(path.join(dir, entry.name), relative);
    } else if (entry.isFile() && /\.html?$/i.test(entry.name) && !relative.split('/').some(part => excludedDirs.has(part))) {
      sourceFiles.add(relative);
    }
  }
}

async function request(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = http.get(url.href, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0', Accept: 'text/html,application/xhtml+xml' }, timeout: 15000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 4) {
        res.resume();
        const next = normalizeUrl(res.headers.location, url.href);
        if (!next) return reject(new Error('redirect left site'));
        return request(next, redirects + 1).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, type: String(res.headers['content-type'] || ''), body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.on('error', reject);
  });
}

function localAsset(value) {
  if (!value) return value;
  return value.replace(/^https?:\/\/ductoan\.com(?=\/vn_waji_4\/)/i, '')
    .replace(/^https?:\/\/ductoan\.cc:7005(?=\/)/i, '')
    .replace(/^\/\/ductoan\.cc:7005(?=\/)/i, '');
}

function prepareHtml(html, url) {
  html = html.replace(/https?:\/\/ductoan\.com(?=\/vn_waji_4\/)/gi, '');
  html = html.replace(/(?:(?:https?:)?\/\/ductoan\.cc:7005)?\/vn_waji_5\/static\/assets\/bimg\/\d+\.png/gi, '/vn_waji_4/static/assets/img/hero-oil.jpg');
  const doc = cheerio.load(html, { decodeEntities: false });
  doc('a[href]').each((_, element) => {
    const link = doc(element);
    const raw = link.attr('href');
    if (!raw || raw.startsWith('#')) return;
    if (link.hasClass('pinterest') && /&(?:amp;)?media=/i.test(raw)) {
      link.attr('href', 'https://www.pinterest.com/pin/create/button/?url=' + encodeURIComponent('https://ductoan.com' + url.pathname));
      return;
    }
    if (/\/0972112131\/?$/.test(raw)) { link.attr('href', 'tel:0972112131'); return; }
    const localRootPage = !/^(?:\/|https?:|\/\/)/i.test(raw) && sourceFiles.has(raw) ? '/' + raw : raw;
    const target = normalizeUrl(localRootPage, url.href);
    if (!target) return;
    if (isKnownPage(target)) {
      link.attr('href', staticHref(target));
      addPage(target.href, url.href);
    } else if (url.pathname === '/') {
      // Home navigation contains a finite set of public paths without source files.
      link.attr('href', staticHref(target));
      addPage(target.href, url.href, true);
    } else if (/^https?:\/\/ductoan\.cc:7005|^\/\/ductoan\.cc:7005/i.test(raw)) {
      link.attr('href', target.pathname + target.search + target.hash);
    }
  });
  doc('img[src],script[src],source[src],video[poster],link[rel="stylesheet"],link[rel="icon"]').each((_, element) => {
    const link = doc(element);
    const attribute = link.attr('src') !== undefined ? 'src' : link.attr('poster') !== undefined ? 'poster' : 'href';
    link.attr(attribute, localAsset(link.attr(attribute)));
  });
  doc('source[srcset],img[srcset]').each((_, element) => {
    const link = doc(element);
    link.attr('srcset', link.attr('srcset').split(',').map(part => localAsset(part.trim())).join(', '));
  });
  return doc.html();
}

function localFile(value, page) {
  let url;
  try { url = new URL(value, 'https://static.test/' + page); } catch (_) { return null; }
  if (url.host !== 'static.test' && url.host !== originHost) return null;
  let relative;
  try { relative = decodeURIComponent(url.pathname).replace(/^\/+/, ''); } catch (_) { return null; }
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  else if (!path.extname(relative)) relative += '/index.html';
  if (relative.split('/').some(part => part === '..')) return null;
  return path.join(outputDir, relative);
}

async function repairLocalReferences() {
  const fallback = '/vn_waji_4/static/assets/img/hero-oil.jpg';
  for (const item of exported) {
    const filename = path.join(outputDir, item.file);
    const doc = cheerio.load(await fsp.readFile(filename, 'utf8'), { decodeEntities: false });
    let changed = false;
    doc('a[href]').each((_, element) => {
      const link = doc(element), href = link.attr('href');
      if (/^(?:#|data:|javascript:|mailto:|tel:)/i.test(href)) return;
      const local = localFile(href, item.file);
      if (local && !fs.existsSync(local)) {
        if (link.closest('.breadcrumb').length) link.attr('href', '/news-list.html');
        else link.removeAttr('href');
        repairedLinks++; changed = true;
      }
    });
    doc('img[src]').each((_, element) => {
      const image = doc(element), src = image.attr('src');
      const local = localFile(src, item.file);
      if (local && !fs.existsSync(local)) {
        image.attr('src', fallback); repairedAssets++; changed = true;
      }
    });
    doc('link[href]').each((_, element) => {
      const link = doc(element), href = link.attr('href');
      if (/\b(?:canonical|stylesheet|icon)\b/i.test(link.attr('rel') || '')) return;
      const local = localFile(href, item.file);
      if (local && !fs.existsSync(local)) {
        link.remove(); removedMetadata++; changed = true;
      }
    });
    if (changed) await fsp.writeFile(filename, doc.html(), 'utf8');
  }
}

async function removeStaleNumericPages() {
  const valid = new Set(exported.map(item => item.file));
  for (const prefix of numericRepresentative.keys()) {
    const parent = path.join(outputDir, prefix.slice(1));
    let entries;
    try { entries = await fsp.readdir(parent, { withFileTypes: true }); } catch (_) { continue; }
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
      const relative = prefix.slice(1) + '/' + entry.name + '/index.html';
      if (valid.has(relative)) continue;
      const filename = path.join(parent, entry.name, 'index.html');
      try { await fsp.unlink(filename); await fsp.rmdir(path.dirname(filename)); } catch (_) { /* Preserve any unrelated files. */ }
    }
  }
}

async function exportOne(url) {
  let response;
  try { response = url.pathname === '/' && homepageResponse ? homepageResponse : await request(url); }
  catch (error) { broken.push({ url: url.pathname + url.search, error: error.message }); return; }
  const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(response.body) || [ , '' ])[1].replace(/<[^>]*>/g, '').trim();
  if (response.status !== 200 || !/html/i.test(response.type) || /^404(?:\s|$)/i.test(title) || !/<html[\s>]/i.test(response.body)) {
    skipped.push({ url: url.pathname + url.search, status: response.status, type: response.type, title: title.slice(0, 80) });
    return;
  }
  const output = outputPath(url);
  const html = prepareHtml(response.body, url);
  await fsp.mkdir(path.dirname(output.full), { recursive: true });
  await fsp.writeFile(output.full, html, 'utf8');
  exported.push({ source: url.pathname + url.search, file: output.relative, title: title.slice(0, 160) });
  if (exported.length % 25 === 0) console.log('pages exported:', exported.length, 'queued:', queued.length);
}

async function workers(count) {
  await Promise.all(Array.from({ length: count }, async () => {
    while (queued.length) {
      const url = queued.shift();
      await exportOne(url);
    }
  }));
}

async function copySiteAssets() {
  await fse.copy(templateDir, path.join(outputDir, 'vn_waji_4'), {
    overwrite: true,
    filter: source => source === templateDir || !/\.html?$/i.test(source) || source.includes(path.sep + 'wp-json' + path.sep),
  });
  await fse.copy(path.join(baseDir, 'app/public/js/jquery.min.js'), path.join(outputDir, 'js/jquery.min.js'));
  await fsp.copyFile(path.join(templateDir, 'favicon.ico'), path.join(outputDir, 'favicon.ico'));
}

async function main() {
  await fsp.mkdir(outputDir, { recursive: true });
  await walk(templateDir);
  console.log('template HTML files:', sourceFiles.size);
  homepageResponse = await request(new URL('/', origin));
  const homepage = cheerio.load(homepageResponse.body);
  homepage('.nav-seo-links a[href]').each((_, element) => {
    const href = homepage(element).attr('href');
    const match = /^(\/[^?#]+)\/\d+\/?$/.exec(href || '');
    if (match) {
      numericRepresentative.set(match[1], href.replace(/\/$/, ''));
      numericRepresentativeValues.add(href.replace(/\/$/, ''));
    }
  });
  addPage('/', origin, true);
  for (const relative of sourceFiles) {
    if (!relative.includes('/') && excludedRootPages.test(relative)) continue;
    addPage(relative === 'index.html' ? '/' : '/' + relative, origin);
  }
  const sitemap = await request(new URL('/sitemap.xml', origin));
  for (const match of sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    if (!/\/sitemap\.html(?:<|$)/.test(match[1])) addPage(match[1], origin, true);
  }
  addPage('/article.html', origin, true);
  addPage('/v-nl/list.html', origin, true);
  await workers(6);
  if (copyAssets) {
    console.log('copying template assets...');
    await copySiteAssets();
    await repairLocalReferences();
  }
  await removeStaleNumericPages();
  const urls = exported.filter(item => !item.file.includes('-q-')).map(item =>
    '  <url><loc>' + origin + '/' + item.file.replace(/&/g, '&amp;') + '</loc></url>');
  await fsp.writeFile(path.join(outputDir, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n');
  await fsp.writeFile(path.join(outputDir, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: ' + origin + '/sitemap.xml\n');
  const report = { source: origin, output: outputDir, exportedAt: new Date().toISOString(), templateHtmlCount: sourceFiles.size, exportedCount: exported.length, skippedCount: skipped.length, brokenCount: broken.length, copiedAssets: copyAssets, repairedLinks, repairedAssets, removedMetadata, exported, skipped, broken };
  await fsp.writeFile(path.join(outputDir, 'EXPORT_REPORT.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ exported: exported.length, skipped: skipped.length, broken: broken.length, copiedAssets: copyAssets, output: outputDir }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
