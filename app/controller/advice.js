/*
 * @Author: Ant
 * @Date: 2020-06-19 18:51:19
 * @LastEditors: Ant
 * @LastEditTime: 2020-06-24 12:29:51
 * @Description: file content
 */

'use strict';

const Controller = require('egg').Controller;
class AdviceController extends Controller {
  async adviceList () {
    const { ctx } = this;
    this.ctx.body = await ctx.service.advice.adviceList(ctx.request.body)
  }
  async createAdvice () {
    const { ctx } = this;
    const createRule = {
      sid: { type: 'number', allowEmpty: false, message: '站点名称不能为空！' },
      content: { type: 'string', minLength: 4, maxLength: 500, allowEmpty: false, message: '站点名称不能为空！' },
    };
    ctx.validate(createRule, ctx.request.body)
    this.ctx.body = await ctx.service.advice.createAdvice(
      ctx.request.body
    )
  }
  async findAdvice () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.advice.findAdvice(options.id)
  }
  async updateAdvice () {
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
    this.ctx.body = await ctx.service.advice.updateAdvice(options.id, options.updates)
  }
  async delAdvice () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.advice.delAdvice(options.id)
  }
}
module.exports = AdviceController;