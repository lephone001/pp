'use strict';

const Subscription = require('egg').Subscription;

class StatsAggregate extends Subscription {
  static get schedule() {
    return {
      type: 'worker',
      interval: '5m',
      immediate: false,
      disable: false,
    };
  }

  async subscribe() {
    try {
      await this.ctx.service.statsAggregator.consumeAvailable(20);
    } catch (error) {
      this.ctx.app.logger.warn('[stats] scheduled aggregate failed: ' + String(error && error.message || error).slice(0, 300));
    }
  }
}

module.exports = StatsAggregate;
