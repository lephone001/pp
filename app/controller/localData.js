'use strict';

const Controller = require('egg').Controller;

class LocalDataController extends Controller {
  async siteServerInfo() {
    this.ctx.body = { code: 200, data: await this.ctx.service.localData.getSiteServerInfo() };
  }

  async saveSiteServerInfo() {
    const data = await this.ctx.service.localData.saveSiteServerInfo(this.ctx.request.body || {});
    this.ctx.body = {
      code: 200,
      message: data.route_restart_required
        ? '配置已保存，路由修改将在重启服务后生效'
        : '站群全局信息保存成功',
      data,
    };
  }
}

module.exports = LocalDataController;
