'use strict';

const net = require('net');

const SPIDER_UA = /(Baiduspider|Googlebot|Google-InspectionTool|bingbot|BingPreview|360Spider|HaosouSpider|HaoSouSpider|Sogou|YisouSpider|SMSpider|Bytespider|ToutiaoSpider|YandexBot|PetalBot|AhrefsBot|bot|crawler|spider|slurp)/i;
const SPIDER_RULES = [
  { name: '百度蜘蛛', pattern: /Baiduspider/i },
  { name: '360蜘蛛', pattern: /(?:360Spider|HaosouSpider|HaoSouSpider)/i },
  { name: '必应蜘蛛', pattern: /(?:bingbot|BingPreview)/i },
  { name: '搜狗蜘蛛', pattern: /Sogou/i },
  { name: '头条蜘蛛', pattern: /(?:Bytespider|ToutiaoSpider)/i },
  { name: 'Yisou蜘蛛', pattern: /(?:YisouSpider|SMSpider)/i },
  { name: 'Applebot', pattern: /Applebot/i },
  { name: 'GPTBot', pattern: /GPTBot/i },
  { name: 'ClaudeBot', pattern: /ClaudeBot/i },
  { name: 'Googlebot', pattern: /(?:Googlebot|Google-InspectionTool)/i },
];
const MOBILE_UA = /(mobile|android|iphone|ipad|ipod|windows phone|blackberry|opera mini|webos|mobi)/i;
const STATIC_EXTENSIONS = [
  '.css', '.js', '.map', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.avi', '.mkv', '.m4v',
  '.zip', '.rar', '.7z', '.apk', '.xml', '.txt', '.json', '.pdf',
];

function normalizeIp(value) {
  let ip = String(value || '').trim();
  if (ip.indexOf(',') !== -1) ip = ip.split(',')[0].trim();
  if (ip.indexOf('::ffff:') === 0) ip = ip.slice(7);
  return ip;
}

function ipv4ToLong(ip) {
  const parts = String(ip || '').split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (let i = 0; i < parts.length; i++) {
    if (!/^\d+$/.test(parts[i])) return null;
    const value = Number(parts[i]);
    if (value < 0 || value > 255) return null;
    result = result * 256 + value;
  }
  return result >>> 0;
}

function ipMatches(ip, rule) {
  const value = String(rule || '').trim();
  if (!value) return false;
  if (value.indexOf('/') === -1) return ip === normalizeIp(value);
  const parts = value.split('/');
  const network = ipv4ToLong(parts[0]);
  const current = ipv4ToLong(ip);
  const prefix = Number(parts[1]);
  if (network === null || current === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (current & mask) === (network & mask);
}

function isSpiderIp(ctx, value) {
  const ip = normalizeIp(ctx.ip || ctx.request.ip || ctx.get('X-Real-IP') || '');
  if (!ip || net.isIP(ip) === 0) return false;
  const rules = String(value || '').split(/[\s,;]+/).filter(Boolean);
  return rules.some(rule => ipMatches(ip, rule));
}

function shouldHandle(ctx) {
  const method = String(ctx.method || '').toUpperCase();
  if ([ 'GET', 'HEAD' ].indexOf(method) === -1) return false;
  if (ctx.status < 200 || ctx.status >= 400) return false;
  const pathname = String(ctx.path || '/');
  const lower = pathname.toLowerCase();
  if ([ '/api', '/uplink', '/dist', '/admin', '/uploads', '/health', '/status' ].some(prefix => lower === prefix || lower.indexOf(prefix + '/') === 0)) return false;
  // /Article/* 是本地泛目录文章路由，也需要使用全局站点屏蔽配置。
  // 其他旧的 /article 路由继续排除，避免改变原有文章页面行为。
  const routeConfig = ctx.app && ctx.app.siteServerInfoRuntime && ctx.app.siteServerInfoRuntime.route_config;
  const configuredDirectory = routeConfig && routeConfig.enabled === true && routeConfig.directory
    ? '/' + String(routeConfig.directory).toLowerCase()
    : '';
  const lowerPathname = pathname.toLowerCase();
  const isFanmuluArticle = pathname === '/Article' || pathname.indexOf('/Article/') === 0
    || (configuredDirectory && (lowerPathname === configuredDirectory || lowerPathname.indexOf(configuredDirectory + '/') === 0));
  if ((lower === '/article' || lower.indexOf('/article/') === 0) && !isFanmuluArticle) return false;
  if ([ '/robots.txt', '/favicon.ico', '/html/sbb02.html', '/html/bc01.html', '/sbb02.html' ].indexOf(lower) !== -1 || /sitemap(?:_index)?\.(?:xml|txt)$/i.test(lower)) return false;
  if (STATIC_EXTENSIONS.some(extension => lower.slice(-extension.length) === extension)) return false;
  const accept = String(ctx.get('Accept') || '').toLowerCase();
  return accept === '' || accept.indexOf('text/html') !== -1 || accept.indexOf('*/*') !== -1;
}

function appendStats(html, statsCode) {
  const page = String(html || '');
  const stats = String(statsCode || '');
  if (!stats) return page;
  if (/<\/body\s*>/i.test(page)) return page.replace(/<\/body\s*>/i, stats + '</body>');
  return page + stats;
}

function pageStatusCode(value) {
  const status = Number(value);
  return [ 503, 502, 410, 403, 444 ].indexOf(status) !== -1 ? status : 403;
}

function spiderName(userAgent) {
  const value = String(userAgent || '');
  for (let i = 0; i < SPIDER_RULES.length; i++) {
    if (SPIDER_RULES[i].pattern.test(value)) return SPIDER_RULES[i].name;
  }
  return SPIDER_UA.test(value) ? '其他蜘蛛' : '';
}

module.exports = () => async function sitePageOverride(ctx, next) {
  await next();

  try {
    if (!shouldHandle(ctx)) return;
    const config = await ctx.service.localData.getRuntimeSiteServerInfo();
    const firewall = config.spider_firewall && typeof config.spider_firewall === 'object'
      ? config.spider_firewall : {};
    if (firewall.enabled === true) {
      const currentSpider = spiderName(ctx.get('User-Agent'));
      const allowedSpiders = Array.isArray(firewall.allowed_spiders) ? firewall.allowed_spiders : [];
      if (currentSpider && allowedSpiders.indexOf(currentSpider) === -1) {
        ctx.status = 403;
        ctx.type = 'text/plain; charset=utf-8';
        ctx.body = '';
        return;
      }
    }

    const mode = String(config.shield_mode || 'allow_all');
    if ([ 'spider_ua', 'spider_ip' ].indexOf(mode) === -1) return;

    const userAgent = String(ctx.get('User-Agent') || '');
    if (mode === 'spider_ua' && SPIDER_UA.test(userAgent)) return;
    if (mode === 'spider_ip' && isSpiderIp(ctx, config.spider_ip_whitelist)) return;

    const device = MOBILE_UA.test(userAgent) ? 'h5' : 'pc';
    const pageConfig = config[device + '_page'] || {};
    const html = await ctx.service.localData.getRuntimePageHtml(device, config);
    if (!html) return;

    ctx.status = pageStatusCode(pageConfig.status_code);
    ctx.type = 'text/html; charset=utf-8';
    ctx.body = appendStats(html, pageConfig.stats_code);
  } catch (error) {
    // 替换页面失败时保留原页面，不能影响前台请求。
    ctx.app.logger.warn('[site-page-override] failed: ' + String(error && error.message || error));
  }
};
