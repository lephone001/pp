
'use strict';

const Controller = require('egg').Controller;
class LogsController extends Controller {

  async logsList () {
    const { ctx } = this;
    this.ctx.body = await ctx.service.logs.logsList(ctx.request.body)
  }
  async createLogs () {
    const { ctx } = this;
    const createRule = {
      logsname: { type: 'string', allowEmpty: false, message: '站点名称不能为空！' },
    };
    ctx.validate(createRule, ctx.request.body)
    this.ctx.body = await ctx.service.logs.createLogs(ctx.request.body)
  }
  async findLogs () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.logs.findLogs(options.id)
  }
  async updateLogs () {
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
    this.ctx.body = await ctx.service.logs.updateLogs(options.id, options.updates)
  }
  async delLogs () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.logs.delLogs(options.id)
  }
}
module.exports = LogsController;