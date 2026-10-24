'use strict';

const Service = require('egg').Service;
const control = require('../lib/statsControl');
const net = require('net');
const urlUtil = require('url');

const SPIDER_RULES = [
  { name: '百度蜘蛛', reg: /Baiduspider/i },
  { name: 'Google蜘蛛', reg: /Googlebot|Google-InspectionTool/i },
  { name: 'Bing蜘蛛', reg: /bingbot|BingPreview/i },
  { name: '360/Haosou蜘蛛', reg: /360Spider|HaosouSpider|HaoSouSpider/i },
  { name: '搜狗蜘蛛', reg: /Sogou/i },
  { name: '神马蜘蛛', reg: /YisouSpider|SMSpider/i },
  { name: '头条/Bytespider', reg: /Bytespider|ToutiaoSpider/i },
  { name: 'Yandex蜘蛛', reg: /YandexBot/i },
  { name: '其他蜘蛛', reg: /bot|crawler|spider|slurp|archiver|巡检/i },
];

const SEARCH_RULES = [
  { name: '百度', hosts: [ 'baidu.com' ] },
  { name: 'Google', hosts: [ 'google.com', 'google.' ] },
  { name: 'Bing', hosts: [ 'bing.com' ] },
  { name: '360搜索', hosts: [ 'so.com' ] },
  { name: '搜狗', hosts: [ 'sogou.com' ] },
  { name: '神马搜索', hosts: [ 'sm.cn' ] },
];

const MOBILE_UA = /(mobile|android|iphone|ipad|ipod|windows phone|blackberry|opera mini|webos|mobi|tablet)/i;

function clean(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function normalizeIp(value) {
  const ip = clean(value, 64);
  if (ip.indexOf('::ffff:') === 0) return ip.slice(7);
  return ip;
}

function ipv4ToNumber(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = Number(parts[i]);
    if (!Number.isInteger(part) || part < 0 || part > 255) return null;
    result = result * 256 + part;
  }
  return result;
}

function ipInCidr(ip, cidr) {
  const parts = String(cidr || '').split('/');
  const network = normalizeIp(parts[0]);
  const bits = parts.length > 1 ? Number(parts[1]) : 32;
  const value = ipv4ToNumber(ip);
  const networkValue = ipv4ToNumber(network);
  if (value === null || networkValue === null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
    return ip === network;
  }
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return ((value >>> 0) & mask) === ((networkValue >>> 0) & mask);
}

function isTrustedProxy(ip, cidrs) {
  if (!ip || net.isIP(ip) === 0) return false;
  return (cidrs || []).some(cidr => {
    const value = String(cidr || '').trim();
    if (!value) return false;
    if (value.indexOf(':') !== -1) return ip === normalizeIp(value.split('/')[0]);
    return ipInCidr(ip, value);
  });
}

function dateInShanghai(timestamp) {
  const date = new Date(timestamp);
  const shanghai = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shanghai.toISOString().slice(0, 10);
}

function normalizeHost(value) {
  let host = clean(value, 255).toLowerCase();
  if (host.charAt(0) === '[') {
    const end = host.indexOf(']');
    if (end !== -1) host = host.slice(1, end);
  } else {
    host = host.replace(/:\d+$/, '');
  }
  return host;
}

function normalizePath(ctx, whitelist) {
  let path = clean(ctx.path || '/', 1024);
  if (path.charAt(0) !== '/') path = '/' + path;
  if (!whitelist || !whitelist.length) return path;
  const query = ctx.query || {};
  const values = [];
  whitelist.forEach(name => {
    if (Object.prototype.hasOwnProperty.call(query, name)) {
      values.push(encodeURIComponent(name) + '=' + encodeURIComponent(clean(query[name], 128)));
    }
  });
  return path + (values.length ? '?' + values.join('&') : '');
}

function spiderType(userAgent) {
  for (let i = 0; i < SPIDER_RULES.length; i++) {
    if (SPIDER_RULES[i].reg.test(userAgent)) return SPIDER_RULES[i].name;
  }
  return '';
}

function searchEngine(referer) {
  if (!referer) return '';
  let parsed;
  try {
    parsed = urlUtil.parse(referer);
  } catch (error) {
    return '';
  }
  const hostname = String(parsed.hostname || '').toLowerCase();
  if (!hostname) return '';
  for (let i = 0; i < SEARCH_RULES.length; i++) {
    if (SEARCH_RULES[i].hosts.some(host => hostname === host || hostname.endsWith('.' + host) || hostname.indexOf(host) !== -1)) {
      return SEARCH_RULES[i].name;
    }
  }
  return '';
}

function refererHost(referer) {
  if (!referer) return '';
  try {
    return normalizeHost(urlUtil.parse(referer).hostname || '');
  } catch (error) {
    return '';
  }
}

class StatsCollector extends Service {
  get statsConfig() {
    return this.app.config.stats || {};
  }

  get state() {
    if (!this.app.statsCollectorState) {
      this.app.statsCollectorState = {
        queue: [],
        summary: Object.create(null),
        dropped: 0,
        timer: null,
        flushing: false,
        lastErrorAt: 0,
      };
    }
    return this.app.statsCollectorState;
  }

  ensureTimer() {
    const state = this.state;
    if (state.timer) return;
    const interval = Math.max(10000, Number(this.statsConfig.flushIntervalMs) || 300000);
    const app = this.app;
    state.timer = setInterval(() => {
      // 不持有首次前台请求的 ctx，避免定时器长期保留整条请求对象。
      const timerCtx = app.createAnonymousContext();
      timerCtx.service.statsCollector.flush().catch(error => {
        app.logger.warn('[stats] scheduled queue flush failed: ' + clean(error && error.message, 300));
      });
    }, interval);
    if (state.timer.unref) state.timer.unref();
  }

  logFlushError(error) {
    const state = this.state;
    const now = Date.now();
    if (now - state.lastErrorAt < 60000) return;
    state.lastErrorAt = now;
    this.ctx.app.logger.warn('[stats] queue flush failed: ' + clean(error && error.message, 300));
  }

  shouldTrack(ctx) {
    if (!control.enabled(this.app)) return false;
    const config = this.statsConfig;
    if (config.enabled === false) return false;
    const method = String(ctx.method || '').toUpperCase();
    if ([ 'GET', 'HEAD' ].indexOf(method) === -1) return false;
    const path = String(ctx.path || '/');
    const lowerPath = path.toLowerCase();
    const excludedPaths = config.excludePaths || [];
    const excludedPrefixes = config.excludePrefixes || [];
    if (excludedPaths.indexOf(path) !== -1) return false;
    if (excludedPrefixes.some(prefix => lowerPath.indexOf(String(prefix).toLowerCase()) === 0)) return false;
    if ((config.excludeExtensions || []).some(ext => lowerPath.slice(-String(ext).length) === String(ext).toLowerCase())) return false;
    return true;
  }

  getClientIp(ctx) {
    const socket = ctx.socket || (ctx.req && ctx.req.socket);
    const peer = normalizeIp(socket && socket.remoteAddress);
    const trusted = isTrustedProxy(peer, this.statsConfig.trustedProxyCidrs || []);
    if (trusted) {
      const xReal = normalizeIp(ctx.get('X-Real-IP'));
      if (net.isIP(xReal)) return xReal;
      const forwarded = clean(ctx.get('X-Forwarded-For'), 512).split(',');
      for (let i = 0; i < forwarded.length; i++) {
        const candidate = normalizeIp(forwarded[i]);
        if (net.isIP(candidate)) return candidate;
      }
    }
    if (net.isIP(peer)) return peer;
    return normalizeIp(ctx.ip || '0.0.0.0');
  }

  buildEvent(ctx, statusOverride) {
    const timestamp = Date.now();
    const userAgent = clean(ctx.get('User-Agent'), 512);
    const referer = clean(ctx.get('Referer'), 1024);
    const type = spiderType(userAgent);
    const path = normalizePath(ctx, this.statsConfig.queryWhitelist || []);
    return {
      timestamp,
      date: dateInShanghai(timestamp),
      siteKey: normalizeHost(ctx.host || ctx.get('Host') || ''),
      path,
      method: String(ctx.method || 'GET').toUpperCase(),
      status: statusOverride || Number(ctx.status) || 200,
      ip: this.getClientIp(ctx),
      ua: userAgent,
      device: MOBILE_UA.test(userAgent) ? 'mobile' : 'pc',
      spiderType: type,
      referer,
      refererHost: refererHost(referer),
      searchEngine: searchEngine(referer),
    };
  }

  enqueue(event) {
    if (!control.enabled(this.app)) return false;
    if (!event || !event.siteKey || !event.path) return false;
    this.ensureTimer();
    const state = this.state;
    const maxLength = Math.max(100, Number(this.statsConfig.queueMaxLength) || 1000);
    // Count even when the bounded detail queue is full.
    this.ctx.service.statsSummary.accumulate(state.summary, event);
    if (state.queue.length >= maxLength) {
      state.dropped++;
      return false;
    }
    state.queue.push(event);
    return true;
  }

  async flush() {
    if (!control.enabled(this.app)) return 0;
    const state = this.state;
    if (state.flushing || !state.queue.length && !state.dropped && !Object.keys(state.summary).length) return 0;
    state.flushing = true;
    const batchSize = Math.max(50, Number(this.statsConfig.flushBatchSize) || 500);
    const batch = state.queue.splice(0, batchSize);
    const dropped = state.dropped;
    state.dropped = 0;
    const summary = state.summary;
    state.summary = Object.create(null);
    try {
      if (!this.app.redis) {
        state.dropped += batch.length + dropped;
        return 0;
      }
      const key = this.statsConfig.redisStreamKey || 'stats:events';
      const maxLength = Math.max(1000, Number(this.statsConfig.redisMaxLength) || 10000);
      const payloads = batch.map(item => JSON.stringify(item));
      // Summary counters do not depend on MongoDB writes or stream consumption.
      try {
        await this.ctx.service.statsSummary.recordTotals(summary);
      } catch (error) {
        // A summary error must not prevent existing detail collection.
        this.logFlushError(error);
      }
      if (payloads.length) {
        if (!control.enabled(this.app)) return 0;
        const pipeline = this.app.redis.pipeline();
        payloads.forEach(payload => {
          pipeline.xadd(key, 'MAXLEN', '~', maxLength, '*', 'payload', payload);
        });
        await pipeline.exec();
        await this.app.redis.expire(key, Number(this.statsConfig.redisTtlSeconds) || 86400);
      }
      if (dropped) {
        const droppedKey = this.statsConfig.redisDroppedKey || 'stats:dropped';
        await this.app.redis.incrby(droppedKey, dropped);
        await this.app.redis.expire(droppedKey, 172800);
      }
      return batch.length;
    } catch (error) {
      state.dropped += batch.length + dropped;
      this.logFlushError(error);
      return 0;
    } finally {
      state.flushing = false;
    }
  }
}

module.exports = StatsCollector;
