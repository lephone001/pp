"use strict";

const Controller = require("egg").Controller;
class SiteController extends Controller {

  async timertServerOpen(){
    const { ctx } = this;
    // 调用一下缓存文件 或者数据库
    // this.ctx.status = 200;
    this.ctx.body = {
        code:200,
    }
  }
  async multipleArticleCreate(){
    const { ctx } = this;
    let requestBody = ctx.service.utils.jiemiFn(ctx.request.body.data)
    let articleList = requestBody.articleList;
    let isOpenUrl = requestBody.isOpenUrl||0;
    let contentTp = requestBody.contentTp
    let isPianCi = requestBody.isPianCi
    this.ctx.body = await ctx.service.autoArticle.piArticleCreate(articleList,isOpenUrl,contentTp,isPianCi)
  }
  async multipleArticlejtCreate(){
    const { ctx } = this;
    let requestBody = ctx.service.utils.jiemiFn(ctx.request.body.data)
    let articleList = requestBody.articleList;
    let isOpenUrl = requestBody.isOpenUrl||0;
    let contentTp = requestBody.contentTp
    let isPianCi = requestBody.isPianCi
    this.ctx.body = await ctx.service.autoArticle.piArticlejtCreate(articleList,isOpenUrl,contentTp,isPianCi)
  }
  
  async multipleAppCreate(){
    const { ctx } = this;
    let requestBody = ctx.service.utils.jiemiFn(ctx.request.body.data)
    let appList = requestBody.appList;
    let isOpenUrl = requestBody.isOpenUrl||0;
    let contentTp = requestBody.contentTp
    let isPianCi = requestBody.isPianCi
    this.ctx.body = await ctx.service.autoArticle.piAppCreate(appList,isOpenUrl,contentTp,isPianCi)
  }
  async uploadArticleCreate(){
    const { ctx } = this;
    this.ctx.body = await ctx.service.autoArticle.uploadArticleCreate(ctx.request.body)
  }
  async multipleSiteCreate(){
    const { ctx } = this;
    ctx.service.site.multipleSiteCreate()
    this.ctx.body = {
      code:200,
      message:'发送成功'
    }
  }
  async multipleDomainCreate() {
    const { ctx } = this;
    let jmopt = ctx.service.utils.jiemiFn(ctx.request.body.domainList)
    let domainList = jmopt
    this.ctx.body = await ctx.service.site.multipleDomainCreate(domainList)
  }
  async ga () { }
  async gettitle(){
    const { ctx } = this;
    let requestBody = ctx.service.utils.jiemiFn(ctx.request.body.data)
    let url = requestBody.url;
    if(!url||url.indexOf('http')==-1){
      return this.ctx.body = {code:200,bcode:0,message:'url错误'}
    } 
    this.ctx.body = await ctx.service.site.gettitle(url);
  }
  async siteList () {
    const { ctx } = this;
    this.ctx.body = await ctx.service.site.siteList(ctx.request.body);
  }
  async createSeoJingtai(){
    const { ctx } = this;
    let domainList = ctx.service.utils.jiemiFn(ctx.request.body.domainList)
    this.ctx.body = await ctx.service.site.createSeoJingtai(domainList);
  }
  async createSite () {
    const { ctx } = this;
    const createRule = {
      sitename: {
        type: "string",
        allowEmpty: false,
        message: "站点名称不能为空！",
      },
      rulename: {
        type: "string",
        allowEmpty: false,
        message: "站点拼音不能为空！",
      },
    };
    ctx.validate(createRule, ctx.request.body);
    this.ctx.body = await ctx.service.site.createSite(ctx.request.body);
  }
  async findSite () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0,
      type: ctx.request.body.type
    };
    const rule = {
      id: { type: "number", allowEmpty: false, message: "id不能为空！" },
      type: { type: "string", allowEmpty: false, message: "type不能为空！" }
    };
    ctx.validate(rule, options);
    this.ctx.body = await ctx.service.site.findSite(options);
  }
  async updateSite () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0,
      updates: ctx.request.body.updates,
    };
    const rule = {
      id: { type: ["number"], allowEmpty: false, message: "id不能为空！" },
      updates: {
        type: ["object"],
        allowEmpty: false,
      },
    };
    ctx.validate(rule, options);
    this.ctx.body = await ctx.service.site.updateSite(
      options.id,
      options.updates
    );
  }
  async disableSite () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0,
    };
    const rule = {
      id: { type: ["number"], allowEmpty: false, message: "id不能为空！" },
    };
    ctx.validate(rule, options);
    this.ctx.body = await ctx.service.site.disableSite(
      options.id,
      options.updates
    );
  }
  async copyNewSite(){
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id,
      link:ctx.request.body.link.toLowerCase()
    };
    const rule = {
      id: { type: ["string"], allowEmpty: false, message: "id不能为空！" },
      link: { type: ["string"], allowEmpty: false, message: "link不能为空！" },
    };
    try{
      ctx.validate(rule, options);
    }catch{
      return this.ctx.body = {
        message:'id或者link错误！',
        code:-1
      }
    }
    this.ctx.body = await ctx.service.site.copyNewSite(options);
  }
  async delSite () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0,
    };
    const rule = {
      id: { type: "number", allowEmpty: false, message: "id不能为空！" },
    };
    ctx.validate(rule, options);
    this.ctx.body = await ctx.service.site.delSite(options.id);
  }
  async saveGa () {
    const { ctx } = this;
    const rule = {
      uaTime: { type: "string", allowEmpty: false, message: "id不能为空！" },
      session: { type: "string", allowEmpty: false, message: "id不能为空！" },
      url: { type: "string", allowEmpty: false, message: "id不能为空！" },
      sid: { type: "number", allowEmpty: false, message: "id不能为空！" },
      fromUrl: { type: "string", allowEmpty: false, message: "id不能为空！" },
    };
   
    ctx.validate(rule, ctx.request.body);
    this.ctx.body = await ctx.service.site.saveGa({
      ...ctx.request.body,
      ip: ctx.request.headers.ip,
    });
  }
  async getSevenGaDayDate () {
    const { ctx } = this;
    this.ctx.body = await ctx.service.site.getSevenGaDayDate(ctx.request.body)
  }
  async getTodayGaDate () {
    const { ctx } = this;
    // let id = ctx.service.utils.getTokenInfo('id')
    // let options = {
    //   id,
    // };
    // const rule = {
    //   id: { type: "number", allowEmpty: false, message: "id不能为空！" },
    // };
    // ctx.validate(rule,options);
    this.ctx.body = await ctx.service.site.getTodayGaDate(ctx.request.body)
  }

  async createArticleJs() {
    const { ctx } = this;
    // let id = ctx.service.utils.getTokenInfo('id')
    // let options = {
    //   id,
    // };
    // const rule = {
    //   id: { type: "number", allowEmpty: false, message: "id不能为空！" },
    // };
    // ctx.validate(rule,options);
    this.ctx.body = await ctx.service.autoArticle.createArticleJs(ctx.request.body)
  }
}
module.exports = SiteController;
