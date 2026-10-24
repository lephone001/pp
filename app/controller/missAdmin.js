'use strict';

const Controller = require('egg').Controller;

class MissAdminController extends Controller {
  async list() { this.ctx.body = await this.ctx.service.missAdmin.list(this.ctx.request.body || {}); }
  async find() { this.ctx.body = await this.ctx.service.missAdmin.find(this.ctx.request.body && this.ctx.request.body.id); }
  async create() {
    const user = {
      id: this.ctx.service.utils.getTokenInfo('id'),
      username: this.ctx.service.utils.getTokenInfo('username'),
    };
    this.ctx.body = await this.ctx.service.missAdmin.create(this.ctx.request.body || {}, user);
  }
  async update() {
    const body = this.ctx.request.body || {};
    this.ctx.body = await this.ctx.service.missAdmin.update(body.id, body.updates || body);
  }
  async remove() { this.ctx.body = await this.ctx.service.missAdmin.remove(this.ctx.request.body && this.ctx.request.body.id); }
  async leaderList() { this.ctx.body = await this.ctx.service.missAdmin.leaderList(this.ctx.request.body || {}); }
  async leaderFind() { this.ctx.body = await this.ctx.service.missAdmin.leaderFind(this.ctx.request.body && this.ctx.request.body.id); }
  async leaderCreate() { this.ctx.body = await this.ctx.service.missAdmin.leaderCreate(this.ctx.request.body || {}); }
  async leaderUpdate() {
    const body = this.ctx.request.body || {};
    this.ctx.body = await this.ctx.service.missAdmin.leaderUpdate(body.id, body.updates || body);
  }
  async leaderRemove() { this.ctx.body = await this.ctx.service.missAdmin.leaderRemove(this.ctx.request.body && this.ctx.request.body.id); }
  async categoryList() { this.ctx.body = await this.ctx.service.missAdmin.categoryList(); }
  async categoryCreate() { this.ctx.body = await this.ctx.service.missAdmin.createCategory(this.ctx.request.body || {}); }
  async categoryUpdate() {
    const body = this.ctx.request.body || {};
    this.ctx.body = await this.ctx.service.missAdmin.updateCategory(body.id, body.updates || body);
  }
  async categoryRemove() { this.ctx.body = await this.ctx.service.missAdmin.removeCategory(this.ctx.request.body && this.ctx.request.body.id); }
  async cityList() { this.ctx.body = await this.ctx.service.missAdmin.cityList(this.ctx.request.body || {}); }
  async cityExport() { this.ctx.body = await this.ctx.service.missAdmin.exportCity(); }
  async cityCreate() { this.ctx.body = await this.ctx.service.missAdmin.createCity(this.ctx.request.body || {}); }
  async cityUpdate() {
    const body = this.ctx.request.body || {};
    this.ctx.body = await this.ctx.service.missAdmin.updateCity(body.id, body.updates || body);
  }
  async cityRemove() { this.ctx.body = await this.ctx.service.missAdmin.removeCity(this.ctx.request.body && this.ctx.request.body.id); }
  async cityBatchCreate() { this.ctx.body = await this.ctx.service.missAdmin.batchCreateCity(this.ctx.request.body || {}); }
  async cityImport() { this.ctx.body = await this.ctx.service.missAdmin.importCity(this.ctx.request.body || {}); }
}

module.exports = MissAdminController;
