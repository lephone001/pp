'use strict';

const Controller = require('egg').Controller;

class FanmuluArticleAdminController extends Controller {
  success(data) {
    this.ctx.body = { code: 200, data };
  }

  failure(error) {
    this.ctx.body = { code: -1, message: String(error && error.message || '操作失败').slice(0, 300) };
  }

  async summary() {
    try {
      this.success(await this.ctx.service.fanmuluArticle.adminSummary());
    } catch (error) {
      this.failure(error);
    }
  }

  async read() {
    try {
      this.success(await this.ctx.service.fanmuluArticle.adminRead(this.ctx.request.body || {}));
    } catch (error) {
      this.failure(error);
    }
  }

  async save() {
    try {
      this.success(await this.ctx.service.fanmuluArticle.adminSave(this.ctx.request.body || {}));
    } catch (error) {
      this.failure(error);
    }
  }

  async create() {
    try {
      this.success(await this.ctx.service.fanmuluArticle.adminCreate(this.ctx.request.body || {}));
    } catch (error) {
      this.failure(error);
    }
  }

  async remove() {
    try {
      this.success(await this.ctx.service.fanmuluArticle.adminRemove(this.ctx.request.body || {}));
    } catch (error) {
      this.failure(error);
    }
  }

  async settings() {
    try {
      this.success(await this.ctx.service.fanmuluArticle.adminSaveSettings(this.ctx.request.body || {}));
    } catch (error) {
      this.failure(error);
    }
  }

  async clearCache() {
    try {
      this.success(await this.ctx.service.fanmuluArticle.adminClearCache());
    } catch (error) {
      this.failure(error);
    }
  }
}

module.exports = FanmuluArticleAdminController;
