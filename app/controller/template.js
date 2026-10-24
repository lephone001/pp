'use strict';

const Controller = require('egg').Controller;

class TemplateController extends Controller {
  async list() {
    this.ctx.body = await this.ctx.service.template.list(this.ctx.request.body || {});
  }

  async options() {
    this.ctx.body = await this.ctx.service.template.options();
  }

  async create() {
    this.ctx.body = await this.ctx.service.template.create(this.ctx.request.body || {});
  }

  async update() {
    const body = this.ctx.request.body || {};
    this.ctx.body = await this.ctx.service.template.update(body.id, body.updates || body);
  }

  async remove() {
    this.ctx.body = await this.ctx.service.template.remove(this.ctx.request.body && this.ctx.request.body.id);
  }

  async importRows() {
    this.ctx.body = await this.ctx.service.template.importRows(this.ctx.request.body || {});
  }

  async exportRows() {
    this.ctx.body = await this.ctx.service.template.exportRows();
  }
}

module.exports = TemplateController;
