'use strict';

const Controller = require('egg').Controller;

class HlsProxyController extends Controller {
  async index() {
    await this.ctx.service.hlsProxy.proxy(this.ctx.query.url);
  }
}

module.exports = HlsProxyController;
