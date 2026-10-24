
'use strict';

const Controller = require('egg').Controller;
class NavController extends Controller {
  async navList() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.nav.navList(ctx.request.body)
  }
  async navtitleget() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.nav.navtitleget(ctx.request.body)
  }
  async navCollectPreview() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.nav.navCollectPreview(ctx.request.body)
  }
  async navCollectItems() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.nav.navCollectItems(ctx.request.body)
  }
  async navCollectDelete() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.nav.navCollectDelete(ctx.request.body)
  }
  async navCollectSave() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.nav.navCollectSave(ctx.request.body)
  }
  async createNav() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.nav.createNav(ctx.request.body)
  }
  async commonCreateNav() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.nav.commonCreateNav()
  }
  async findNav() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id
    }
    this.ctx.body = await ctx.service.nav.findNav(options.id)
  }
  async navRefushNum() {
    await this.ctx.service.nav.upadteCateNum()
    await this.ctx.service.nav.upadteCateNavs12()
    await this.ctx.service.nav.refreshNavHomepageCache()
    this.ctx.body = {
      message: '刷新成功!',
      code: 200
    }
  }
  async viewNav() {
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
    this.ctx.body = await ctx.service.nav.viewNav(options)
  }
  async viewNavAddOne() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id
    }
    this.ctx.body = await ctx.service.nav.viewNavAddOne(options)
  }
  async updateNav() {
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
    this.ctx.body = await ctx.service.nav.updateNav(
      options.id,
      options.updates
    );
  }
  async disableNav() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0,
    }
    const rule = {
      id: { type: ['number'], allowEmpty: false, message: 'id不能为空！' },
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.nav.disableNav(options.id, options.updates)
  }
  async delNav() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.nav.delNav(ctx.request.body)
  }


  async navCategoryList() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.nav.navCategoryList(ctx.request.body)
  }
  async createNavCategory() {
    const { ctx } = this;
    let categorys = ctx.service.utils.jiemiFn(ctx.request.body.categorys)
    this.ctx.body = await ctx.service.nav.createNavCategory(categorys)
  }
  async findNavCategory() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.nav.findNavCategory(ctx.request.body.id)
  }
  async updateNavCategory() {
    const { ctx } = this;
    let options = ctx.service.utils.jiemiFn(ctx.request.body.data)
    // // console.log(ctx.request.body)
    // const rule = {
    //     id: { type: ['number'], allowEmpty: false, message: 'id不能为空！' },
    //     updates: {
    //         type: ['object'], allowEmpty: false,
    //     }
    // };
    // ctx.validate(rule, options)
    this.ctx.body = await ctx.service.nav.updateNavCategory(options)
  }

  async findNavCategoryName() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.nav.findNavCategoryName(ctx.request.body)
  }
  async delNavCategory() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.nav.delNavCategory(ctx.request.body.id)
  }
  async imagesUploads() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.qiniu.imagesUploads()
  }
  async navStarAndBadAdd(){
    this.ctx.service.nav.navStarAndBadAdd()
    this.ctx.body = {code:200,message:'成功!'} 
  }
  async navStarAndBadAddRequest(){
    this.ctx.body = await this.ctx.service.nav.navStarAndBadAddRequest()
  }
  async commonCreateNavRequest() {
    const { ctx } = this;
    let { title, image, imageList, link, h5, app, logo, keywords, description, addIP,uid,uname } = ctx.request.body
    this.ctx.body = await this.ctx.service.nav.commonCreateNavRequest({
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
module.exports = NavController;
