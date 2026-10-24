'use strict';

module.exports = {
  schedule: {
    interval: '1m',
    type: 'worker',
    immediate: true,
  },
  async task(ctx) {
    return ctx.service.movieCollectScheduler.tick();
  },
};
