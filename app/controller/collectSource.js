'use strict';

const Controller = require('egg').Controller;

function bodyData(ctx) {
  const body = ctx.request.body || {};
  if (body && typeof body.data === 'string') {
    try { return ctx.service.utils.jiemiFn(body.data) || {}; } catch (error) { return body; }
  }
  return body;
}

class CollectSourceController extends Controller {
  async collectSourceList() { this.ctx.body = await this.ctx.service.collectSource.list(bodyData(this.ctx)); }
  async tongbuVideoCollectSourceList() { this.ctx.body = await this.ctx.service.collectSource.videoSyncList(bodyData(this.ctx)); }
  async tongbuVideoCollectSourceSync() { this.ctx.body = await this.ctx.service.collectSource.videoSync(bodyData(this.ctx)); }
  async createCollectSource() { this.ctx.body = await this.ctx.service.collectSource.create(bodyData(this.ctx)); }
  async updateCollectSource() {
    const body = bodyData(this.ctx);
    this.ctx.body = await this.ctx.service.collectSource.update(body.id, body.updates || body);
  }
  async delCollectSource() { this.ctx.body = await this.ctx.service.collectSource.remove((this.ctx.request.body || {}).id); }
  async clearCollectSourceMovies() {
    const body = bodyData(this.ctx);
    this.ctx.body = await this.ctx.service.collectSource.clearMovies(body.id);
  }
  async collectTaskList() { this.ctx.body = await this.ctx.service.collectSource.taskList(bodyData(this.ctx)); }
  async createCollectTask() { this.ctx.body = await this.ctx.service.collectSource.createTask(bodyData(this.ctx)); }
  async pauseCollectTask() { this.ctx.body = await this.ctx.service.collectSource.pauseTask(bodyData(this.ctx).id); }
  async resumeCollectTask() { this.ctx.body = await this.ctx.service.collectSource.resumeTask(bodyData(this.ctx).id); }
  async deleteCollectTask() { this.ctx.body = await this.ctx.service.collectSource.deleteTask(bodyData(this.ctx).id); }
  async retryCollectTask() { this.ctx.body = await this.ctx.service.collectSource.retryTask((this.ctx.request.body || {}).id); }
  async collectSourceCategoryMappings() { this.ctx.body = await this.ctx.service.collectSource.categoryMappings((this.ctx.request.body || {}).id); }
  async updateCollectSourceCategoryMappings() {
    const body = bodyData(this.ctx);
    this.ctx.body = await this.ctx.service.collectSource.updateCategoryMappings(body.id, body.mappings || []);
  }
  async collectSourceRemoteCategories() {
    const body = bodyData(this.ctx);
    this.ctx.body = await this.ctx.service.collectSource.remoteCategories(body.id, body);
  }
}

module.exports = CollectSourceController;
