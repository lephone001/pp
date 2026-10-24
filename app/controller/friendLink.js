
'use strict';

const Controller = require('egg').Controller;
class FriendLinkController extends Controller {

  async friendLinkList () {
    const { ctx } = this;
    this.ctx.body = await ctx.service.friendLink.friendLinkList(ctx.request.body)
  }
  async createFriendLink () {
    const { ctx } = this;

    let options = {
      name: ctx.request.body.name,
      link: ctx.request.body.link,
      sid: ctx.request.body.sid,
      // scid: ctx.request.body.sid
    }
    const createRule = {
      name: { type: 'string', allowEmpty: false, message: '名称不能为空！' },
      link: { type: 'string', allowEmpty: false, message: '链接不能为空！' },
    };
    try{
      ctx.validate(createRule, options)
    }catch{
      return {
        code:-1,message:'参数错误！'
      }
    }
    this.ctx.body = await ctx.service.friendLink.createFriendLink(ctx.request.body)
  }
  async findFriendLink () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.friendLink.findFriendLink(options.id)
  }
  async updateFriendLink () {
    const { ctx } = this;
    let options = {
      _id: ctx.request.body._id,
      type: ctx.request.body.type,
      link: ctx.request.body.link,
    }
    if (!options.id && !options.link) {
      this.ctx.body = {
        code: 400,
        message: 'error'
      }
      return
    }
    // console.log(ctx.request.body)
    // const rule = {
    //     id: { type: ['number'], allowEmpty: false, message: 'id不能为空！' },
    //     updates: {
    //         type: ['object'], allowEmpty: false,
    //     }
    // };
    // ctx.validate(rule, options)
    this.ctx.body = await ctx.service.friendLink.updateFriendLink(options)
  }
  async delFriendLink () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id
    }
    const rule = {
      id: { type: 'string', allowEmpty: false, message: 'id不能为空！' }
    };
    try{
      ctx.validate(rule, options)
    }catch{
      this.ctx.body = {code:-1,message:'参数错误！'}
    }
    this.ctx.body = await ctx.service.friendLink.delFriendLink(options.id)
  }
}
module.exports = FriendLinkController;