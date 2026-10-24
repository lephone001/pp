'use strict';

const fs = require('fs').promises;
const path = require('path');
const { isIP } = require('net');
const { URL } = require('url');

const caches = new Map();
const READ_RETRY_DELAYS_MS = [ 100, 200 ];

function normalizeHost(value, { allowUnderscore = false } = {}) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || /[\s\\\/?#@%]/.test(raw)) return null;
  try {
    // link 和请求 Host 都可能带端口；统一按域名或 IP 归属判断。
    const authority = isIP(raw) === 6 ? '[' + raw + ']' : raw;
    let hostname = new URL('http://' + authority).hostname.toLowerCase().replace(/\.$/, '');
    if (hostname.startsWith('[')) hostname = hostname.slice(1, -1);
    if (isIP(hostname)) return { hostname, ip: true };
    const labelPattern = allowUnderscore
      ? /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/
      : /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
    if (hostname.length > 253 || hostname.split('.').some(label => !labelPattern.test(label))) return null;
    return { hostname, ip: false };
  } catch (error) {
    return null;
  }
}

function parseList(content) {
  const domains = new Set();
  const ips = new Set();
  for (const line of content.split(/\r?\n/)) {
    const host = normalizeHost(line.trim().replace(/^\*\./, ''));
    if (host) (host.ip ? ips : domains).add(host.hostname);
  }
  return { domains, ips };
}

function getCache(baseDir) {
  const filename = path.resolve(baseDir, 'app', 'local_data', 'allDomainList.txt');
  if (!caches.has(filename)) {
    caches.set(filename, { filename, list: null, loading: null, revision: 0, lastReadError: '' });
  }
  return caches.get(filename);
}

function setDomainHostList(baseDir, content) {
  const cache = getCache(baseDir);
  cache.revision++;
  cache.list = parseList(content);
  cache.lastReadError = '';
  return cache.list;
}

function readFailed(cache, error, logger) {
  // 重试后仍读取失败则拒绝访问，后续请求直接使用空缓存。
  cache.list = parseList('');
  const message = error.code || error.message;
  if (message !== cache.lastReadError) {
    if (logger) logger.warn('[domain-host-guard] cannot read domain list: %s', message);
    cache.lastReadError = message;
  }
}

function reloadDomainHostList(baseDir, logger) {
  const cache = getCache(baseDir);
  const revision = ++cache.revision;
  const loading = (async () => {
    // 只在本次加载失败时有限重试，不启动定时文件检查。
    for (let attempt = 0; attempt <= READ_RETRY_DELAYS_MS.length; attempt++) {
      try {
        const content = await fs.readFile(cache.filename, 'utf8');
        if (cache.revision === revision) {
          cache.list = parseList(content);
          cache.lastReadError = '';
        }
        break;
      } catch (error) {
        if (cache.revision !== revision) break;
        if (attempt === READ_RETRY_DELAYS_MS.length) {
          readFailed(cache, error, logger);
          break;
        }
        await new Promise(resolve => setTimeout(resolve, READ_RETRY_DELAYS_MS[attempt]));
        if (cache.revision !== revision) break;
      }
    }
    return cache.list || cache.loading;
  })().finally(() => {
    if (cache.loading === loading) cache.loading = null;
  });
  cache.loading = loading;
  return loading;
}

function getDomainHostList(baseDir, logger) {
  const cache = getCache(baseDir);
  return cache.list || cache.loading || reloadDomainHostList(baseDir, logger);
}

module.exports = {
  normalizeHost, getDomainHostList, reloadDomainHostList, setDomainHostList,
};
