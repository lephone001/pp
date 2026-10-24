
'use strict';

const Controller = require('egg').Controller;
class OutlinkController extends Controller {

  async outlinkList () {
    const { ctx } = this;
    this.ctx.body = await ctx.service.outlink.outlinkList(ctx.request.body)
  }
  async createOutlink () {
    const { ctx } = this;
    const createRule = {
      outlinkname: { type: 'string', allowEmpty: false, message: '站点名称不能为空！' },
    };
    ctx.validate(createRule, ctx.request.body)
    this.ctx.body = await ctx.service.outlink.createOutlink(ctx.request.body)
  }
  async findOutlink () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.outlink.findOutlink(options.id)
  }
  async updateOutlink () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0,
      updates: ctx.request.body.updates
    }
    // console.log(ctx.request.body)
    const rule = {
      id: { type: ['number'], allowEmpty: false, message: 'id不能为空！' },
      updates: {
        type: ['object'], allowEmpty: false,
      }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.outlink.updateOutlink(options.id, options.updates)
  }
  async delOutlink () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.outlink.delOutlink(options.id)
  }
}
module.exports = OutlinkController;