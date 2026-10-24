'use strict';

const Controller = require('egg').Controller;

class MissUploadController extends Controller {
  async upload() {
    this.ctx.body = await this.ctx.service.missUpload.upload();
  }

  async sourceUpload() {
    this.ctx.body = await this.ctx.service.missUpload.sourceUpload();
  }

  async list() {
    this.ctx.body = await this.ctx.service.missUpload.list(this.ctx.request.body || {});
  }

  async file() {
    await this.ctx.service.missUpload.stream(this.ctx.params.filename || this.ctx.params[0]);
  }
}

module.exports = MissUploadController;
