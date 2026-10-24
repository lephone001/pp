
'use strict';

const Controller = require('egg').Controller;
class VideoCategoryController extends Controller {

  async videoCategoryList () {
    const { ctx } = this;
    this.ctx.body = await ctx.service.videoCategory.videoCategoryList(ctx.request.body)
  }
  async createVideoCategory () {
    const { ctx } = this;
    let jmdata = ctx.service.utils.jiemiFn(ctx.request.body.data)
    this.ctx.body = await ctx.service.videoCategory.createVideoCategory(jmdata)
  }
  async findVideoCategory () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id 
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.videoCategory.findVideoCategory(options.id)
  }
  async updateVideoCategory () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id,
      updates: ctx.request.body.updates
    }
    this.ctx.body = await ctx.service.videoCategory.updateVideoCategory(options.id, options.updates)
  }
  async disableVideoCategory () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id,
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' },
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.videoCategory.disableVideoCategory(options.id, options.updates)
  }
  async delVideoCategory () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id
    }
    this.ctx.body = await ctx.service.videoCategory.delVideoCategory(options.id)
  }
}
module.exports = VideoCategoryController;