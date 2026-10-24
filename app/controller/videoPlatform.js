
'use strict';

const Controller = require('egg').Controller;
class VideoPlatformController extends Controller {

  async videoPlatformList () {
    const { ctx } = this;
    this.ctx.body = await ctx.service.videoPlatform.videoPlatformList(ctx.request.body)
  }
  async createVideoPlatform () {
    const { ctx } = this;
    const createRule = {
      name: { type: 'string', allowEmpty: false, message: '站点名称不能为空！' },
      link: { type: 'string', allowEmpty: false, message: '站点拼音不能为空！' },
    };
    try{
      ctx.validate(createRule, ctx.request.body)
    }catch{
     return;
    }
    this.ctx.body = await ctx.service.videoPlatform.createVideoPlatform(ctx.request.body)
  }
  async findVideoPlatform () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.videoPlatform.findVideoPlatform(options.id)
  }
  async updateVideoPlatform () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id,
      updates: ctx.request.body.updates
    }
    // const rule = {
    //   id: { type: 'number', allowEmpty: false, message: 'id不能为空！' },
    //   updates: {
    //     type: 'object', allowEmpty: false,
    //   }
    // };
    // ctx.validate(rule, options)
    this.ctx.body = await ctx.service.videoPlatform.updateVideoPlatform(options.id, options.updates)
  }
  async disableVideoPlatform () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0,
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' },
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.videoPlatform.disableVideoPlatform(options.id, options.updates)
  }
  async delVideoPlatform () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    this.ctx.body = await ctx.service.videoPlatform.delVideoPlatform(options.id)
  }
}
module.exports = VideoPlatformController;