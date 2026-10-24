'use strict';

module.exports = {
  schedule: {
    // 每天北京时间 05:40 执行一次，仅处理已开启定时的采集源。
    cron: '0 40 5 * * *',
    cronOptions: {
      tz: process.env.VIDEO_COLLECT_TIMEZONE || 'Asia/Shanghai',
    },
    type: 'worker',
    immediate: false,
  },
  async task(ctx) {
    return ctx.service.movieCollectScheduler.runVideoDaily();
  },
};
