'use strict';

module.exports = {
  schedule: {
    cron: '0 30 4 * * *',
    cronOptions: { tz: 'Asia/Shanghai' },
    type: 'worker',
    immediate: false,
  },
  async task(ctx) {
    // 顺序提交各类任务，避免本机同时创建多个大请求；远端仍按各自的批次推送。
    for (const type of [ 'wenzhang', 'articleCbd', 'video', 'app', 'article' ]) {
      try {
        const result = await ctx.service.wenzhangSync.run(type);
        if (!result.skipped) ctx.logger.info('[content-sync-schedule] type=%s %s', type, result.message);
      } catch (error) {
        ctx.logger.error('[content-sync-schedule] type=%s failed: %s', type, error.stack || error.message);
      }
    }
  },
};
