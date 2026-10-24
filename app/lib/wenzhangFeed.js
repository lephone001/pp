'use strict';
const axios = require('axios');
const dns = require('dns').promises;
const http = require('http');
const https = require('https');
const cheerio = require('cheerio');
const xss = require('xss');

function url(value, base) {
  if (!String(value || '').trim()) return '';
  try {
    const parsed = new URL(String(value || ''), base);
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) return '';
    parsed.hash = '';
    return parsed.href;
  } catch (_) { return ''; }
}
function publicIPv4(address) {
  const p = address.split('.').map(Number);
  return p.length === 4 && p.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
    ![ 0, 10, 127 ].includes(p[0]) && p[0] < 224 &&
    !(p[0] === 169 && p[1] === 254) && !(p[0] === 172 && p[1] >= 16 && p[1] <= 31) &&
    !(p[0] === 192 && p[1] === 168) && !(p[0] === 100 && p[1] >= 64 && p[1] <= 127) &&
    !(p[0] === 198 && [ 18, 19 ].includes(p[1]));
}
function pinnedLookup(addresses) {
  const list = addresses.map(item => ({ address: item.address, family: Number(item.family) || 4 }));
  return (_, options, callback) => {
    // Node 20+ may request all addresses for automatic family selection.
    if (options && options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  };
}
async function fetchFeed(input) {
  let target = url(input);
  const deadline = Date.now() + 30000;
  for (let redirect = 0; redirect <= 3; redirect++) {
    if (!target) throw new Error('采集源必须是 HTTP(S) 订阅地址');
    const host = new URL(target).hostname;
    const addresses = await dns.lookup(host, { family: 4, all: true });
    if (!addresses.length || addresses.some(item => !publicIPv4(item.address))) throw new Error('采集源必须使用公网地址');
    const lookup = pinnedLookup(addresses);
    const httpAgent = new http.Agent({ lookup });
    const httpsAgent = new https.Agent({ lookup });
    try {
      if (Date.now() >= deadline) throw new Error('采集源请求超时');
      const response = await axios.get(target, {
        timeout: deadline - Date.now(), maxRedirects: 0, maxContentLength: 5 * 1024 * 1024,
        responseType: 'text', proxy: false, httpAgent, httpsAgent,
        headers: { 'User-Agent': 'WenzhangFeedReader/1.0', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
        validateStatus: code => code >= 200 && code < 400,
      });
      if (response.status >= 300) { target = url(response.headers.location, target); continue; }
      return { text: response.data, url: target };
    } finally { httpAgent.destroy(); httpsAgent.destroy(); }
  }
  throw new Error('采集源重定向次数过多');
}
function localLink(value, base) {
  const text = String(value || '').trim();
  if (text.startsWith('#')) return text;
  try {
    const parsed = new URL(text, base || 'https://local.invalid/');
    if (!/^https?:$/.test(parsed.protocol)) return '/WenZhang/list.html';
    // Exactly one leading slash prevents protocol-relative external navigation.
    const pathname = '/' + parsed.pathname.replace(/^\/+/, '').replace(/\\/g, '%5C');
    return pathname + parsed.search + parsed.hash;
  } catch (_) { return '/WenZhang/list.html'; }
}
function cleanContent(html, base) {
  const $ = cheerio.load(String(html || '').slice(0, 500000));
  $('script,style,link,iframe,frame,frameset,object,embed,form,base,meta').remove();
  $('[style]').removeAttr('style');
  $('[href]').each((_, element) => {
    $(element).attr('href', localLink($(element).attr('href'), base));
  });
  $('[src]').each((_, element) => {
    $(element).attr('src', url($(element).attr('src'), base));
  });
  return xss($.html(), { stripIgnoreTag: true, stripIgnoreTagBody: [ 'script', 'style' ] });
}
function parseFeed(text, base, limit = 20) {
  const $ = cheerio.load(String(text || ''), { xmlMode: true, decodeEntities: true });
  if (!$('rss,feed,RDF').length && !$('rdf\\:RDF').length) throw new Error('地址返回的不是 RSS/Atom 订阅内容');
  const result = [], seen = new Set();
  $('item,entry').each((_, entry) => {
    if (result.length >= Math.min(50, Math.max(1, limit))) return;
    const node = $(entry);
    const get = name => node.children().filter((i, el) => el.name === name).first().text().trim();
    const sourceUrl = url(get('link') || node.find('link[rel="alternate"]').attr('href') || node.find('link').attr('href') || get('guid'), base);
    const title = cheerio.load(get('title')).text().trim().slice(0, 300);
    if (!sourceUrl || !title || seen.has(sourceUrl)) return;
    seen.add(sourceUrl);
    const content = cleanContent(get('content:encoded') || get('content') || get('description') || get('summary'), sourceUrl);
    const description = cheerio.load(content).text().replace(/\s+/g, ' ').trim().slice(0, 300);
    const published = new Date(get('pubDate') || get('published') || get('updated'));
    result.push({ title, sourceUrl, content, description,
      image: url(cheerio.load(content)('img').first().attr('src') || '', sourceUrl),
      publishedAt: Number.isNaN(published.getTime()) ? new Date() : published });
  });
  return result;
}
module.exports = { url, publicIPv4, pinnedLookup, cleanContent, parseFeed, fetchFeed };
