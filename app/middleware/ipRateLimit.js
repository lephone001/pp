'use strict';

const RATE_LIMIT_SCRIPT = `
local blacklistKey = KEYS[1]
local rateKey = KEYS[2]
local violationKey = KEYS[3]

local maxRequests = tonumber(ARGV[1])
local windowSeconds = tonumber(ARGV[2])
local violationTtl = tonumber(ARGV[3])
local firstBanSeconds = tonumber(ARGV[4])
local secondBanSeconds = tonumber(ARGV[5])
local permanentBanSeconds = tonumber(ARGV[6])

local blacklistTtl = redis.call('TTL', blacklistKey)
if blacklistTtl > 0 or blacklistTtl == -1 then
  return { 0, 0, blacklistTtl, tonumber(redis.call('GET', violationKey) or '0') }
end

local count = redis.call('INCR', rateKey)
if count == 1 then
  redis.call('EXPIRE', rateKey, windowSeconds + 5)
end

if count <= maxRequests then
  return { 1, count, redis.call('TTL', rateKey), tonumber(redis.call('GET', violationKey) or '0') }
end

local violations = redis.call('INCR', violationKey)
if violations == 1 then
  redis.call('EXPIRE', violationKey, violationTtl)
end

local banSeconds = firstBanSeconds
if violations == 2 then
  banSeconds = secondBanSeconds
elseif violations >= 3 then
  banSeconds = permanentBanSeconds
end

if banSeconds > 0 then
  redis.call('SET', blacklistKey, violations, 'EX', banSeconds)
else
  redis.call('SET', blacklistKey, violations)
end

return { 0, count, banSeconds, violations }
`;

function normalizeIp(ip = '') {
  let value = String(ip || '').trim();
  if (!value) return '';
  if (value.indexOf(',') >= 0) {
    value = value.split(',')[0].trim();
  }
  if (value.indexOf('::ffff:') === 0) {
    value = value.slice(7);
  }
  return value;
}

function getClientIp(ctx) {
  return normalizeIp(
    ctx.ip ||
    ctx.request.ip ||
    ctx.get('x-real-ip') ||
    ctx.get('x-forwarded-for') ||
    ''
  );
}

function ipv4ToLong(ip = '') {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const value = Number(part);
    if (value < 0 || value > 255) return null;
    num = (num << 8) + value;
  }
  return num >>> 0;
}

function parseCidr(cidr = '') {
  const parts = String(cidr).split('/');
  if (parts.length !== 2) return null;
  const baseIp = ipv4ToLong(parts[0]);
  const prefix = Number(parts[1]);
  if (baseIp === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return {
    network: baseIp & mask,
    mask,
  };
}

function buildIpWhitelist(list = []) {
  const exact = new Set();
  const cidrs = [];
  for (const item of list) {
    const value = String(item || '').trim();
    if (!value) continue;
    if (value.indexOf('/') > 0) {
      const cidr = parseCidr(value);
      if (cidr) cidrs.push(cidr);
    } else {
      exact.add(value);
    }
  }
  return { exact, cidrs };
}

function isWhitelistedIp(ip, whitelist) {
  if (!ip) return false;
  if (whitelist.exact.has(ip)) return true;
  const ipLong = ipv4ToLong(ip);
  if (ipLong === null) return false;
  return whitelist.cidrs.some(item => (ipLong & item.mask) === item.network);
}

function isStaticPath(pathname = '', staticExts) {
  const cleanPath = pathname.split('?')[0].toLowerCase();
  return staticExts.some(ext => cleanPath.endsWith(ext));
}

module.exports = (options = {}, app) => {
  const windowSeconds = Number(options.windowSeconds || 60);
  const maxRequests = Number(options.maxRequests || 180);
  const violationTtl = Number(options.violationTtl || 30 * 24 * 60 * 60);
  const firstBanSeconds = Number(options.firstBanSeconds || 60 * 60);
  const secondBanSeconds = Number(options.secondBanSeconds || 12 * 60 * 60);
  const permanentBanSeconds = Number(options.permanentBanSeconds || 0);
  const whitelistIps = buildIpWhitelist(options.whitelistIps || []);
  const whitelistPaths = new Set(options.whitelistPaths || []);
  const staticExts = options.staticExts || [
    '.css', '.js', '.map', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
    '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.txt', '.xml',
  ];
  const whitelistUserAgentReg = options.whitelistUserAgentReg ||
    /(Baiduspider|Googlebot|bingbot|360Spider|Sogou|Sogo|YisouSpider|SMSpider|Bytespider|Slurp)/i;

  return async function ipRateLimit(ctx, next) {
    const ip = getClientIp(ctx);
    const pathname = ctx.path || '';
    const userAgent = ctx.get('user-agent') || '';

    if (
      !ip ||
      isWhitelistedIp(ip, whitelistIps) ||
      whitelistPaths.has(pathname) ||
      whitelistUserAgentReg.test(userAgent) ||
      isStaticPath(pathname, staticExts)
    ) {
      return next();
    }

    const redis = app.redis;
    if (!redis || typeof redis.eval !== 'function') {
      return next();
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const windowId = Math.floor(nowSeconds / windowSeconds);
    const blacklistKey = `security:blacklist:ip:${ip}`;
    const rateKey = `security:rate:ip:${ip}:${windowId}`;
    const violationKey = `security:violation:ip:${ip}`;

    try {
      const result = await redis.eval(
        RATE_LIMIT_SCRIPT,
        3,
        blacklistKey,
        rateKey,
        violationKey,
        maxRequests,
        windowSeconds,
        violationTtl,
        firstBanSeconds,
        secondBanSeconds,
        permanentBanSeconds
      );
      const allowed = Number(result && result[0]);

      if (!allowed) {
        ctx.status = 444;
        ctx.body = '';
        return;
      }
    } catch (err) {
      if (app.logger && app.logger.warn) {
        app.logger.warn('[ipRateLimit] redis error: %s', err.message);
      }
      return next();
    }

    return next();
  };
};
