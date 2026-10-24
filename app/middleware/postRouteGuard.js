'use strict';

module.exports = (options, app) => {
  let dispatch;
  return async function postRouteGuard(ctx, next) {
    if (ctx.method !== 'POST') return next();
    const path = app.router.opts.routerPath || ctx.routerPath || ctx.path;
    const matched = app.router.match(path, 'POST');
    const hasRoute = matched.pathAndMethod.some(layer => layer.methods.length && layer.name !== 'allPostFallback');
    if (hasRoute) return next();

    // 复用底部路由的 allPost，直接返回 444，不读取请求体、不进入文件解析中间件。
    if (!dispatch) dispatch = app.router.routes();
    return dispatch(ctx, next);
  };
};
