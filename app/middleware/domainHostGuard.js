'use strict';

const { isIP } = require('net');
const { normalizeHost, getDomainHostList } = require('../lib/domainHostCache');

const PUBLIC_PATHS = new Set([
  '/sbb02.html',
  '/html/sbb02.html',
  '/app.js',
  '/html/app.js',
  '/app.json',
  '/html/app.json',
]);

module.exports = () => {
  return async function domainHostGuard(ctx, next) {
    if (ctx.method === 'POST') return next();
    // 公开页面和数据资源跳过 Host/IP 校验，查询参数不影响路径匹配。
    if ((ctx.method === 'GET' || ctx.method === 'HEAD') && PUBLIC_PATHS.has(ctx.path)) return next();
    // 使用真实 Host 头，不使用可由 X-Forwarded-Host 改写的 ctx.host。
    const host = normalizeHost(ctx.get('host'), { allowUnderscore: true });
    let allowed = false;
    // 直接使用 IPv4/IPv6 访问一律拒绝，即使清单里包含该 IP。
    if (host && !isIP(host.hostname)) {
      // 启动时加载，后续请求只查询进程内存；更新清单时主动刷新。
      const list = await getDomainHostList(ctx.app.baseDir || process.cwd(), ctx.logger || ctx.app.logger);
      let candidate = host.hostname;
      while (candidate) {
        if (list.domains.has(candidate)) {
          allowed = true;
          break;
        }
        const dot = candidate.indexOf('.');
        candidate = dot < 0 ? '' : candidate.slice(dot + 1);
      }
    }
    if (!allowed) {
      ctx.status = 444;
      ctx.body = '';
      return;
    }
    return next();
  };
};
