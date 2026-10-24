'use strict';

const Controller = require('egg').Controller;

function bodyData(ctx) {
  const body = ctx.request.body || {};
  if (body && typeof body.data === 'string') {
    try { return ctx.service.utils.jiemiFn(body.data) || {}; } catch (error) { return body; }
  }
  return body;
}

class MovieCategoryController extends Controller {
  async movieCategoryList() { this.ctx.body = await this.ctx.service.movie.categoryList(bodyData(this.ctx)); }
  async createMovieCategory() { this.ctx.body = await this.ctx.service.movie.createCategory(bodyData(this.ctx)); }
  async updateMovieCategory() {
    const body = bodyData(this.ctx);
    this.ctx.body = await this.ctx.service.movie.updateCategory(body.id, body.updates || body);
  }
  async delMovieCategory() { this.ctx.body = await this.ctx.service.movie.deleteCategory((this.ctx.request.body || {}).id); }
}

module.exports = MovieCategoryController;
