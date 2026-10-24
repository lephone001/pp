'use strict';

const Controller = require('egg').Controller;
const control = require('../lib/statsControl');

class StatsController extends Controller {
  async settings() {
    const { ctx } = this;
    const body = ctx.request.body || {};
    if (Object.prototype.hasOwnProperty.call(body, 'enabled')) {
      if (typeof body.enabled !== 'boolean') {
        ctx.body = { code: 400, message: '统计开关必须是布尔值' };
        return;
      }
      await ctx.service.localData.writeJson('stats_control', { enabled: body.enabled });
      control.apply(ctx.app, body.enabled);
      ctx.app.messenger.sendToApp('stats-control-updated', {});
    }
    ctx.body = { code: 200, data: { enabled: control.enabled(ctx.app) } };
  }

  stopped() {
    if (control.enabled(this.ctx.app)) return false;
    this.ctx.body = { code: 409, message: '统计已关闭，请在首页开启统计' };
    return true;
  }

  async overview() {
    if (this.stopped()) return;
    this.ctx.body = await this.ctx.service.statsAggregator.overview(this.ctx.request.body || {});
  }

  async list() {
    if (this.stopped()) return;
    const kind = String(this.ctx.params.kind || '');
    this.ctx.body = await this.ctx.service.statsAggregator.list(kind, this.ctx.request.body || {});
  }

  async dashboard() {
    try {
      this.ctx.body = await this.ctx.service.statsSummary.dashboard(this.ctx.request.body || {});
    } catch (error) {
      this.ctx.logger.error('[stats] dashboard snapshot read failed: %s', error.message);
      this.ctx.status = 503;
      this.ctx.body = { code: 503, message: '统计快照暂时不可用，请稍后重试' };
    }
  }

  async sites() {
    if (this.stopped()) return;
    this.ctx.body = await this.ctx.service.statsAggregator.sites(this.ctx.request.body || {});
  }
}

module.exports = StatsController;
