'use strict';

const Subscription = require('egg').Subscription;

class StatsSnapshot extends Subscription {
  static get schedule() {
    return { type: 'worker', interval: '1m', immediate: true };
  }

  async subscribe() {
    try {
      await this.ctx.service.statsSummary.snapshot();
    } catch (error) {
      this.ctx.logger.warn('[stats] summary snapshot failed: %s', error.message);
    }
  }
}

module.exports = StatsSnapshot;
