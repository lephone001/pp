'use strict';

const PASS_THROUGH_EXACT = [
  '/html/sbb02.html', '/html/bc01.html', '/sbb02.html',
  '/favicon.ico',
  '/robots.txt',
  '/article.xml',
  '/hls-proxy',
  '/html/appjs',
];

const PASS_THROUGH_PREFIXES = [
  '/api',
  '/uplink',
  '/admin',
  '/dist',
  '/uploads',
  '/assets',
  '/static',
  '/public',
  '/health',
  '/healthz',
  '/status',
  '/socket.io',
  '/.well-known',
  '/baidu_verify',
  '/sitemap',
  '/picturs',
  '/image_site',
  '/image_article',
  '/image_mulu',
  '/proxy',
  '/getArticleData',
  '/update/agentlink',
];

const ASSET_EXTENSION = /\.(?:css|js|mjs|map|jpg|jpeg|png|gif|webp|svg|ico|woff|woff2|ttf|eot|mp3|wav|ogg|mp4|webm|avi|mkv|m4v|zip|rar|7z|apk|xml|txt|json|pdf)$/i;

function hasPrefix(pathname, prefix) {
  return pathname === prefix || pathname.indexOf(prefix + '/') === 0;
}

function shouldHandleAsSelectedRoute(ctx) {
  const method = String(ctx.method || '').toUpperCase();
  if ([ 'GET', 'HEAD' ].indexOf(method) === -1) return false;

  const pathname = String(ctx.path || '/');
  const lower = pathname.toLowerCase();
  if (PASS_THROUGH_EXACT.indexOf(lower) !== -1) return false;
  if (PASS_THROUGH_PREFIXES.some(prefix => hasPrefix(lower, prefix.toLowerCase()))) return false;
  if (ASSET_EXTENSION.test(lower) && !/\.html?$/i.test(lower)) return false;

  const accept = String(ctx.get('Accept') || '').toLowerCase();
  return accept === '' || accept.indexOf('text/html') !== -1 || accept.indexOf('*/*') !== -1;
}

module.exports = {
  shouldHandleAsSelectedRoute,
};
