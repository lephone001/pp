'use strict';

const Controller = require('egg').Controller;

function bodyData(ctx) {
  const body = ctx.request.body || {};
  if (body && typeof body.data === 'string') {
    try { return ctx.service.utils.jiemiFn(body.data) || {}; } catch (error) { return body; }
  }
  return body;
}

class MovieController extends Controller {
  async movieList() { this.ctx.body = await this.ctx.service.movie.movieList(bodyData(this.ctx)); }
  async createMovie() { this.ctx.body = await this.ctx.service.movie.createMovie(bodyData(this.ctx)); }
  async findMovie() { this.ctx.body = await this.ctx.service.movie.findMovie((this.ctx.request.body || {}).id); }
  async updateMovie() {
    const body = bodyData(this.ctx);
    this.ctx.body = await this.ctx.service.movie.updateMovie(body.id, body.updates || body);
  }
  async delMovie() { this.ctx.body = await this.ctx.service.movie.deleteMovie((this.ctx.request.body || {}).id); }
}

module.exports = MovieController;
