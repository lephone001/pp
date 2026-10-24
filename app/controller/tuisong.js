
'use strict';

const Controller = require('egg').Controller;
class TuisongController extends Controller {

  async tuisongList () {
    const { ctx } = this;
    this.ctx.body = await ctx.service.tuisong.tuisongList(ctx.request.body)
  }
  async createTuisong () {
    const { ctx } = this;
    this.ctx.body = await ctx.service.tuisong.createTuisong(ctx.request.body)
  }
  async findTuisong () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.tuisong.findTuisong(options.id)
  }
  async updateTuisong () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0,
      updates: ctx.request.body.updates
    }
    // console.log(ctx.request.body)
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' },
      updates: {
        type: ['object'], allowEmpty: false,
      }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.tuisong.updateTuisong(options.id, options.updates)
  }
  async delTuisong () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.tuisong.delTuisong(options.id)
  }
}
module.exports = TuisongController;