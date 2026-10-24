'use strict';

const { shouldHandleAsSelectedRoute } = require('./requestPolicy');

function requestFile(pathname, fallbackPath) {
  let target = String(pathname || '/').replace(/^\/+/, '');
  try {
    target = decodeURIComponent(target);
  } catch (error) {
    return fallbackPath;
  }
  if (!target) return fallbackPath;
  if (target.length > 200 || target.indexOf('\\') !== -1 || target.indexOf('..') !== -1) return fallbackPath;
  if (target.slice(-1) === '/') target += 'index.html';
  if (!/\.[A-Za-z0-9]+$/.test(target)) target += '.html';
  return /\.html?$/i.test(target) ? target : fallbackPath;
}

module.exports = app => {
  app.logger.info('[route-loader] static route file selected');

  app.router.get('selected-static-route', '/*', async (ctx, next) => {
    if (!shouldHandleAsSelectedRoute(ctx)) {
      await next();
      return;
    }

    try {
      const fallbackPath = 'index.html';
      const target = requestFile(ctx.path, fallbackPath);
      let html = await ctx.service.localData.getStaticRouteHtml(target);
      if (!html && target !== fallbackPath) {
        html = await ctx.service.localData.getStaticRouteHtml(fallbackPath);
      }
      if (!html) {
        ctx.status = 404;
        ctx.type = 'text/plain; charset=utf-8';
        ctx.body = '静态页面不存在';
        return;
      }

      ctx.status = 200;
      ctx.type = 'text/html; charset=utf-8';
      ctx.body = html;
    } catch (error) {
      ctx.logger.error('[static-route] render failed: %s', error && error.stack || error);
      ctx.status = 500;
      ctx.type = 'text/plain; charset=utf-8';
      ctx.body = '静态页面读取失败';
    }
  });
};

module.exports.requestFile = requestFile;
