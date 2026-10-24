
'use strict';

const Controller = require('egg').Controller;
class AppController extends Controller {
  async appList() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.app.appList(ctx.request.body)
  }
  async getAppDataList(){
    const { ctx } = this;
    //验证密码
    // console.log(ctx.request.body.password)
    if(!ctx.request.body.password||ctx.request.body.password!=='123123') {
      return this.ctx.body = '.';
    }
    this.ctx.body = await ctx.service.app.appList(ctx.request.body)
  }
  async apptitleget() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.app.apptitleget(ctx.request.body)
  }
  async getDataCenter(){
    const { ctx } = this;
    this.ctx.body = await ctx.service.app.getDataCenter()
  }
  async createApp() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.app.createApp(ctx.request.body)
  }
  async commonCreateApp() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.app.commonCreateApp()
  }
  async findApp() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id
    }
    this.ctx.body = await ctx.service.app.findApp(options.id)
  }
  async appRefushNum() {
    await this.ctx.service.app.upadteCateNum()
    await this.ctx.service.app.upadteCateApps12()
    this.ctx.body = {
      message: '刷新成功!',
      code: 200
    }
  }
  async viewApp() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0,
      sid: ctx.request.body.sid - 0,
      link: ctx.request.body.link
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' },
      sid: { type: 'number', allowEmpty: false, message: 'sid不能为空！' },
      link: { type: 'text', allowEmpty: false, message: 'link不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.app.viewApp(options)
  }
  async viewAppAddOne() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id
    }
    this.ctx.body = await ctx.service.app.viewAppAddOne(options)
  }
  async updateApp() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id,
      updates: ctx.request.body.updates,
    };
    const rule = {
      id: { type: ["string"], allowEmpty: false, message: "id不能为空！" },
      updates: {
        type: ["object"],
        allowEmpty: false,
      },
    };
    try {
      ctx.validate(rule, options);
    } catch {
      return {
        code: -1,
        message: '参数有误!'
      }
    }
    this.ctx.body = await ctx.service.app.updateApp(
      options.id,
      options.updates
    );
  }
  async disableApp() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0,
    }
    const rule = {
      id: { type: ['number'], allowEmpty: false, message: 'id不能为空！' },
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.app.disableApp(options.id, options.updates)
  }
  async delApp() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.app.delApp(ctx.request.body)
  }
  async appCategoryList() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.app.appCategoryList(ctx.request.body)
  }
  async createAppCategory() {
    const { ctx } = this;
    let options = {
      name: ctx.request.body.name,
      sid: ctx.request.body.sid - 0,
      cid: ctx.request.body.cid - 0,
    }
    const createRule = {
      name: { type: 'string', allowEmpty: false, message: '名称不能为空！' },
    };
    try {
      ctx.validate(createRule, ctx.request.body)
    } catch {
      this.ctx.body = {
        message: '参数错误！',
        code: 200
      }
    }
    this.ctx.body = await ctx.service.app.createAppCategory(ctx.request.body)
  }
  async findAppCategoryName() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.app.findAppCategoryName(ctx.request.body)
  }
  async findAppCategory() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.app.findAppCategory(options.id)
  }
  async updateAppCategory() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id,
      updates: ctx.request.body.updates,
    };
    const rule = {
      id: { type: ["string"], allowEmpty: false, message: "id不能为空！" },
      updates: {
        type: ["object"],
        allowEmpty: false,
      },
    };
    try {
      ctx.validate(rule, options);
    } catch {
      return {
        code: -1,
        message: '参数有误!'
      }
    }
    this.ctx.body = await ctx.service.app.updateAppCategory(
      options.id,
      options.updates
    );
  }
  async delAppCategory() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.app.delAppCategory(options.id)
  }
  async imagesUploads() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.qiniu.imagesUploads()
  }
  async appStarAndBadAdd(){
    this.ctx.service.app.appStarAndBadAdd()
    this.ctx.body = {code:200,message:'成功!'} 
  }
  async appStarAndBadAddRequest(){
    this.ctx.body = await this.ctx.service.app.appStarAndBadAddRequest()
  }
  async commonCreateAppRequest() {
    const { ctx } = this;
    let { title, image, imageList, link, h5, app, logo, keywords, description, addIP,uid,uname } = ctx.request.body
    this.ctx.body = await this.ctx.service.app.commonCreateAppRequest({
      title,
      reltitle: title,
      image,
      imageList,
      link,
      slink: link,
      h5,
      app,
      logo,
      h5logo: logo,
      uid,
      uname,
      keywords,
      description,
      addIP
    })

  }
}
module.exports = AppController;