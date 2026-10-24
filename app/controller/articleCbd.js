'use strict';

const Controller = require('egg').Controller;

class ArticleCbdController extends Controller {
  getRequestBody() {
    const { ctx } = this;
    const body = ctx.request.body || {};

    if (body.data) {
      try {
        return ctx.service.utils.jiemiFn(body.data);
      } catch (e) {
        return body;
      }
    }

    return body;
  }

  async articleCbdList() {
    const { ctx } = this;
    ctx.body = await ctx.service.articleCbd.articleCbdList(this.getRequestBody());
  }

  async articleCbdCreate() {
    const { ctx } = this;
    ctx.body = await ctx.service.articleCbd.articleCbdCreate(this.getRequestBody());
  }

  async articleCbdGetOne() {
    const { ctx } = this;
    ctx.body = await ctx.service.articleCbd.articleCbdGetOne(this.getRequestBody());
  }

  async articleCbdUpdate() {
    const { ctx } = this;
    ctx.body = await ctx.service.articleCbd.articleCbdUpdate(this.getRequestBody());
  }

  async articleCbdDelete() {
    const { ctx } = this;
    ctx.body = await ctx.service.articleCbd.articleCbdDelete(this.getRequestBody());
  }

  async articleCbdRefreshCache() {
    const { ctx } = this;
    ctx.body = await ctx.service.articleCbd.articleCbdRefreshCache(this.getRequestBody());
  }
}

module.exports = ArticleCbdController;
