
'use strict';

const Controller = require('egg').Controller;
class SebobaoAppController extends Controller {
    async sebobaoAppList() {
        const { ctx } = this;
        let criteria = {
            limit:100,
            offset:0,
        }
        let options = {}
        let {limit,offset,cid} = ctx.request.body
        if(cid>=0) options.cid = cid
        if(limit>=0) criteria.limit = limit
        if(offset>=0) criteria.offset = offset
        let rows = await this.ctx.model.SebobaoApp.find(options).sort({"sort":-1,'createdAt':1}).skip(criteria.offset).limit(criteria.limit).lean(); //.sort({"createdAt":-1})
        this.ctx.body = {
            code:200,
            data:rows
        }
    }
    async createSebobaoApp() {
        const { ctx } = this;
        const createRule = {
            articlename: { type: 'string', allowEmpty: false, message: '站点名称不能为空！' },
        };
        ctx.validate(createRule, ctx.request.body)
        this.ctx.model.SebobaoApp.create(ctx.request.body).then(()=>{
            console.log(item.name + '添加成功')
        })
        this.ctx.body = await ctx.service.sebobaoApp.createSebobaoApp(ctx.request.body)
    }
    async findSebobaoApp() {
        const { ctx } = this;
        let options = {
            id: ctx.request.body.id - 0
        }
        const rule = {
            id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
        };
        ctx.validate(rule, options)
        this.ctx.body = await ctx.service.sebobaoApp.findSebobaoApp(options.id)
    }
    async updateSebobaoApp() {
        const { ctx } = this;
        //验证一下密码 aaa123456
        if(!ctx.request.body.password&&ctx.request.body.password!=='aaa123456') return  this.ctx.body =  {code:-2,message:'无权限'} 
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
        this.ctx.body = await ctx.service.sebobaoApp.updateSebobaoApp(options.id, options.updates)
    }
    async delSebobaoApp() {
        const { ctx } = this;
        let options = {
            id: ctx.request.body.id - 0
        }
        const rule = {
            id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
        };
        ctx.validate(rule, options)
        this.ctx.body = await ctx.service.sebobaoApp.delSebobaoApp(options.id)
    }
    async articleGetData(){
        const { ctx } = this;
        // articleGetDataTXTY  articleGetDataYXX  articleGetDataZXS   articleGetDataJSCJ
        let {startPage,endPage,name = 'articleGetDataTXTY'} = ctx.request.body
        console.log(startPage,endPage)
        ctx.service[name].getData({startPage,endPage})
        this.ctx.body = {
            code:200,
            message:'抓取开始！'
        }
    }
    async createSebobaoAppCopy(){
        const { ctx } = this;
        let queryData = ctx.request.body
        // console.log(ctx.request.query)
        //验证一个密码aaa123456
        if (!ctx.request.query.password || ctx.request.query.password !== 'aaa123456') {
            return ctx.response.body = { code: -1, message: '无权限添加' }
        }
        let data = await ctx.service.sebobaoApp.createSebobaoAppCopy(queryData)
        return ctx.response.body = data
    }
}
module.exports = SebobaoAppController;