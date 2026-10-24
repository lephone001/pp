'use strict';
module.exports = {
  schedule: { cron: '0 20 4 * * *', cronOptions: { tz: 'Asia/Shanghai' }, type: 'worker', immediate: false },
  async task(ctx) {
    try { await ctx.service.wenzhang.daily(); }
    catch (error) { ctx.logger.warn('[wenzhang] daily collection failed: %s', error.message); }
  },
};
