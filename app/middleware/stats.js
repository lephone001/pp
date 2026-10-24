'use strict';

module.exports = () => async function statsMiddleware(ctx, next) {
  const collector = ctx.service.statsCollector;
  if (!collector.shouldTrack(ctx)) {
    await next();
    return;
  }

  let failed = false;
  try {
    await next();
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      collector.enqueue(collector.buildEvent(ctx, failed ? 500 : null));
    } catch (error) {
      // 统计失败绝不能改变前台页面的状态码和响应内容。
      ctx.app.logger.warn('[stats] collect failed: ' + String(error && error.message || '').slice(0, 300));
    }
  }
};
