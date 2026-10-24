'use strict';

const Controller = require('egg').Controller;

class ArticleComapanyController extends Controller {
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

  async articleComapanyList() {
    const { ctx } = this;
    ctx.body = await ctx.service.articleComapany.articleComapanyList(this.getRequestBody());
  }

  async articleComapanyCreate() {
    const { ctx } = this;
    ctx.body = await ctx.service.articleComapany.articleComapanyCreate(this.getRequestBody());
  }

  async articleComapanyGetOne() {
    const { ctx } = this;
    ctx.body = await ctx.service.articleComapany.articleComapanyGetOne(this.getRequestBody());
  }

  async articleComapanyUpdate() {
    const { ctx } = this;
    ctx.body = await ctx.service.articleComapany.articleComapanyUpdate(this.getRequestBody());
  }

  async articleComapanyDelete() {
    const { ctx } = this;
    ctx.body = await ctx.service.articleComapany.articleComapanyDelete(this.getRequestBody());
  }

  async articleComapanyStatus() {
    const { ctx } = this;
    ctx.body = await ctx.service.articleComapany.articleComapanyStatus(this.getRequestBody());
  }

  async articleComapanyClearFolder() {
    const { ctx } = this;
    ctx.body = await ctx.service.articleComapany.articleComapanyClearFolder(this.getRequestBody());
  }

  async articleComapanyDeleteCbdContent() {
    const { ctx } = this;
    ctx.body = await ctx.service.articleComapany.articleComapanyDeleteCbdContent(this.getRequestBody());
  }

  async articleComapanyGenerate() {
    const { ctx } = this;
    ctx.body = await ctx.service.articleComapany.articleComapanyGenerate(this.getRequestBody());
  }

  async articleComapanyImportCbd() {
    const { ctx } = this;
    ctx.body = await ctx.service.articleComapany.articleComapanyImportCbd(this.getRequestBody());
  }
}

module.exports = ArticleComapanyController;
