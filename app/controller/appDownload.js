'use strict';

const Controller = require('egg').Controller;

class AppDownloadController extends Controller {
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

  async appDownloadList() {
    const { ctx } = this;
    ctx.body = await ctx.service.appDownload.appDownloadList(this.getRequestBody());
  }

  async appDownloadCreate() {
    const { ctx } = this;
    ctx.body = await ctx.service.appDownload.appDownloadCreate(this.getRequestBody());
  }

  async appDownloadGetOne() {
    const { ctx } = this;
    ctx.body = await ctx.service.appDownload.appDownloadGetOne(this.getRequestBody());
  }

  async appDownloadUpdate() {
    const { ctx } = this;
    ctx.body = await ctx.service.appDownload.appDownloadUpdate(this.getRequestBody());
  }

  async appDownloadDelete() {
    const { ctx } = this;
    ctx.body = await ctx.service.appDownload.appDownloadDelete(this.getRequestBody());
  }

  async appDownloadStatus() {
    const { ctx } = this;
    ctx.body = await ctx.service.appDownload.appDownloadStatus(this.getRequestBody());
  }

  async addDownloadList() {
    return this.appDownloadList();
  }

  async addDownloadCreate() {
    return this.appDownloadCreate();
  }

  async addDownloadGetOne() {
    return this.appDownloadGetOne();
  }

  async addDownloadUpdate() {
    return this.appDownloadUpdate();
  }

  async addDownloadDelete() {
    return this.appDownloadDelete();
  }

  async addDownloadStatus() {
    return this.appDownloadStatus();
  }
}

module.exports = AppDownloadController;
