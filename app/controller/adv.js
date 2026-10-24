
'use strict';

const Controller = require('egg').Controller;
class AdvController extends Controller {

  async advList () {
    const { ctx } = this;
    this.ctx.body = await ctx.service.adv.advList(ctx.request.body)
  }
  async createAdv () {
    const { ctx } = this;
    const createRule = {
      name: { type: 'string', allowEmpty: false, message: '站点名称不能为空！' },
      link: { type: 'string', allowEmpty: false, message: '链接不能为空！' },
      sid: { type: 'array', allowEmpty: false, message: '站点id不能为空！' },
    };
    ctx.validate(createRule, ctx.request.body)
    this.ctx.body = await ctx.service.adv.createAdv(ctx.request.body)
  }
  async findAdv () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.adv.findAdv(options.id)
  }
  async viewAdv () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0,
      sid: ctx.request.body.sid - 0,
      link:ctx.request.body.link
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' },
      sid: { type: 'number', allowEmpty: false, message: 'sid不能为空！' },
      link: { type: 'text', allowEmpty: false, message: 'link不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.adv.viewAdv(options)
  }
  async updateAdv () {
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
    this.ctx.body = await ctx.service.adv.updateAdv(options.id, options.updates)
  }
  async delAdv () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.adv.delAdv(options.id)
  }
}
module.exports = AdvController;