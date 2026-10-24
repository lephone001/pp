"use strict";

const Controller = require("egg").Controller;
class DomainController extends Controller {
  async domainCounterSet(){
    const { ctx } = this;
    ctx.service.domain.domainCounterSet();
    this.ctx.body = {code:200,message:'发送成功！'}
  }
  async testAllDomain () {
    const { ctx } = this;
    this.ctx.body = await ctx.service.domain.testAllDomain(ctx.request.body);
  }
  async domainCheckStatus () {
    const { ctx } = this;
    this.ctx.body = await ctx.service.domain.domainCheckStatus(ctx.request.body || {});
  }
  async updateAllDomainList() {
    const { ctx } = this;
    ctx.body = await ctx.service.domain.updateAllDomainList();
  }
  async domainList () {
    const { ctx } = this;
    this.ctx.body = await ctx.service.domain.domainList(ctx.request.body);
  }
  async delDomainList(){
    const { ctx } = this;
    this.ctx.body = await ctx.service.domain.delDomainList(ctx.request.body);
  }
  async domainListAll() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.domain.domainListAll(ctx.request.body);
  }
  async tongbuDomainList() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.domain.tongbuDomainList(ctx.request.body);
  }
  async tongbuDomainSync() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.domain.tongbuDomainSync(ctx.request.body);
  }
  async tongbuDomainPush() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.domain.tongbuDomainPush(ctx.request.body);
  }
  async tongbuDomainReceive() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.domain.tongbuDomainReceive(ctx.request.body);
  }
  async tongbuFanList() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.domain.tongbuWordLibraryList('fan', ctx.request.body);
  }
  async tongbuFanSync() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.domain.tongbuWordLibrarySync('fan', ctx.request.body);
  }
  async tongbuMuluList() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.domain.tongbuWordLibraryList('mulu', ctx.request.body);
  }
  async tongbuMuluSync() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.domain.tongbuWordLibrarySync('mulu', ctx.request.body);
  }
  async tongbuContentList() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.domain.tongbuContentList(ctx.request.body);
  }
  async tongbuContentSync() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.domain.tongbuContentSync(ctx.request.body);
  }
  async tongbuContentPush() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.domain.tongbuContentPush(ctx.request.body);
  }
  async tongbuContentReceive() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.domain.tongbuContentReceive(ctx.request.body);
  }
  async contentSyncScheduleSettings() {
    const { ctx } = this;
    try {
      ctx.body = { code: 200, data: await ctx.service.wenzhangSync.publicSettings(ctx.request.body.type) };
    } catch (error) {
      ctx.body = { code: -1, message: error.message };
    }
  }
  async saveContentSyncScheduleSettings() {
    const { ctx } = this;
    try {
      ctx.body = { code: 200, data: await ctx.service.wenzhangSync.save(ctx.request.body.type, {
        ...ctx.request.body,
        receiveUrl: `${ctx.protocol}://${ctx.host}`,
        all: false,
      }) };
    } catch (error) {
      ctx.body = { code: -1, message: error.message };
    }
  }
  async refreshDomain () {
    const { ctx } = this;
    let options = {
      link: ctx.request.body.link,
    };
    const createRule = {
      link: { type: "string", allowEmpty: false, message: "域名不能为空！" },
    };
    ctx.validate(createRule, options);
    this.ctx.body = await ctx.service.domain.refreshDomain(
      ctx.request.body.link
    );
  }
  async mutUpdateDomain(){
    const { ctx } = this;
    let {links,updates,isAll} = ctx.request.body
    if(!links||!updates) return ctx.body = {code:-1,message:'参数不正确!'}
    ctx.body = await ctx.service.domain.mutUpdateDomain({links,updates,isAll});
  }
  async updateDomainIP(){
    const { ctx } = this;
    ctx.body = await ctx.service.domain.updateDomainIP(ctx.request.body)
  }
  async createDomain () {
    const { ctx } = this;
    let options = {
      link: ctx.request.body.link.toLowerCase(),
    };
    const createRule = {
      link: { type: "string", allowEmpty: false, message: "域名不能为空！" },
    };
    try {
      ctx.validate(createRule, options);
    } catch {
      return this.ctx.body = {code:-1,message:'参数错误'}
    }
    this.ctx.body = await ctx.service.domain.createDomain(ctx.request.body);
  }
  async findDomain () {
    const { ctx } = this;
    let host = ctx.request.header.host.toLowerCase();
    // 泛域名 截取方式 news.fasd.com  fasd.com  
    let linkarr = host.split('')
    let isFanArr = linkarr.filter(item1=>item1 === '.')
    if(isFanArr.length>=2){
        // 从第一个截取
        host = host.slice(host.indexOf('.')+1) 
    }
    const rule = {
      host: { type: "string", allowEmpty: false, message: "link不能为空！" },
    };
    ctx.validate(rule, {host});
    this.ctx.body = await ctx.service.domain.findDomain(host);
  }
  async updateDomain () {
    const { ctx } = this;
    let requestBody = ctx.service.utils.jiemiFn(ctx.request.body.data)
    let options = {
      id: requestBody.id,
      updates: requestBody.updates,
    };
    const rule = {
      id: { type: ["string"], allowEmpty: false, message: "id不能为空！" },
      updates: {
        type: ["object"],
        allowEmpty: false,
      },
    };
    try{
      ctx.validate(rule, options);
    }catch{
      return {
        code:-1,
        message:'参数有误!'
      }
    }
    this.ctx.body = await ctx.service.domain.updateDomain(
      options.id,
      options.updates
    );
  }
  async delDomain () {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id,
    };
    const rule = {
      id: { type: "string", allowEmpty: false, message: "id不能为空！" },
    };
    try{
      ctx.validate(rule, options);
    }catch{
      return this.ctx.body = {code:-1,message:'参数错误！'}
    }
    this.ctx.body = await ctx.service.domain.delDomain(options.id);
  }
  async mutDelDomain () {
    const { ctx } = this;
    let options = {
      domainList: ctx.request.body.domainList,
    };
    const rule = {
      domainList: { type: "array", allowEmpty: false, message: "id不能为空！" },
    };
    try{
      ctx.validate(rule, options);
    }catch{
      return this.ctx.body = {code:-1,message:'参数错误！'}
    }
    this.ctx.body = await ctx.service.domain.mutDelDomain(options.domainList);
  }
  async mutUpdateReplaceDomain(){
    const { ctx } = this;
    let {links,updates,type,isAll} = ctx.request.body
    if(!links||!updates) return ctx.body = {code:-1,message:'参数不正确!'}
    ctx.service.domain.mutUpdateReplaceDomain({links,updates,type,isAll});
    ctx.body = {
      code: 200,
      message: '修改成功!'
    }
  }
  async domainCategoryList(){
    const { ctx } = this;
    const {domainId,nclink,categoryId,type,typeId} = ctx.request.body
    if(!domainId&&!nclink) return ctx.body = {code:-1,message:'参数不正确!'}
    this.ctx.body = await ctx.service.domain.domainCategoryList({domainId,nclink,categoryId,type,typeId});
  }
  async deleteDomainCategory(){
    const { ctx } = this;
    let id = ctx.request.body.id;
    this.ctx.body = await ctx.service.domain.deleteDomainCategory(id);
  }
  async addDomainCategory(){
    const { ctx } = this;
    let itemList = ctx.request.body.itemList;
    this.ctx.body = await ctx.service.domain.addDomainCategory(itemList);
  }
}
module.exports = DomainController;

