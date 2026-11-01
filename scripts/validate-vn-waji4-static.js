'use strict';

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const root = path.resolve(process.env.STATIC_EXPORT_DIR || 'C:/Windows/dev/ductoan_v4');
const report = JSON.parse(fs.readFileSync(path.join(root, 'EXPORT_REPORT.json'), 'utf8'));
const missing = new Map();
const exists = new Map();
const assetRoots = new Map();
let checked = 0;

function check(value, page, kind) {
  if (!value || /^(?:#|data:|javascript:|mailto:|tel:)/i.test(value)) return;
  let url;
  try { url = new URL(value, 'https://static.test/' + page); } catch (_) { return; }
  if (url.hostname !== 'static.test') return;
  let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  else if (!path.extname(relative)) relative += '/index.html';
  if (relative.split('/').includes('..')) return;
  checked++;
  if (kind === 'asset') {
    const top = relative.split('/')[0];
    assetRoots.set(top, (assetRoots.get(top) || 0) + 1);
  }
  if (!exists.has(relative)) exists.set(relative, fs.existsSync(path.join(root, relative)));
  if (!exists.get(relative)) {
    const key = kind + ' ' + url.pathname;
    if (!missing.has(key)) missing.set(key, []);
    if (missing.get(key).length < 3) missing.get(key).push(page);
  }
}

for (const item of report.exported) {
  const html = fs.readFileSync(path.join(root, item.file), 'utf8');
  const doc = cheerio.load(html);
  doc('a[href]').each((_, el) => check(doc(el).attr('href'), item.file, 'link'));
  doc('img[src],script[src],source[src],video[poster],link[href]').each((_, el) => {
    const $el = doc(el);
    check($el.attr('src') || $el.attr('poster') || $el.attr('href'), item.file, 'asset');
  });
  doc('[srcset]').each((_, el) => {
    for (const choice of doc(el).attr('srcset').split(',')) check(choice.trim().split(/\s+/)[0], item.file, 'asset');
  });
}
const paths = Array.from(missing.keys());
fs.writeFileSync(path.join(root, 'VALIDATION_REPORT.json'), JSON.stringify(Array.from(missing, ([path, from]) => ({ path, from })), null, 2));
console.log(JSON.stringify({ pages: report.exportedCount, pathsChecked: checked, missing: missing.size,
  assetRoots: Array.from(assetRoots, ([root, count]) => ({ root, count })).sort((a, b) => b.count - a.count).slice(0, 30),
  categories: { pinterest: paths.filter(x => x.includes('&media=')).length, xmlrpc: paths.filter(x => x.includes('xmlrpc')).length, other: paths.filter(x => !x.includes('&media=') && !x.includes('xmlrpc')).length },
  examples: Array.from(missing, ([path, from]) => ({ path, from })).filter(x => !x.path.includes('&media=') && !x.path.includes('xmlrpc')).slice(0, 60) }, null, 2));
if (missing.size) process.exitCode = 1;
