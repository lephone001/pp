
'use strict';

const Controller = require('egg').Controller;
class ArticleController extends Controller {
    
    async articlejtList() {
        const { ctx } = this;
        if (!ctx.request.body.sid) return this.ctx.body = {}
        this.ctx.body = await ctx.service.articlejt.articleList(ctx.request.body)
    }

    
    
    async createArticlejt() {
        const { ctx } = this;
        let requestBody = ctx.service.utils.jiemiFn(ctx.request.body.data)

        const createRule = {
            title: { type: 'string', allowEmpty: false, message: '文章名称不能为空！' },
            // cid: { type: 'number', allowEmpty: false, message: '文章名称不能为空！' },
            content: { type: 'string', allowEmpty: false, message: '文章内容不能为空！' },
        };
        try{
            ctx.validate(createRule,requestBody)
        }catch{
            return this.ctx.body = {
                code:-1,
                message:'文章参数错误！'
            }
        }
        this.ctx.body = await ctx.service.articlejt.createArticlejt(requestBody)
    }
    
    async postArticlejt() {
        const { ctx } = this;
        let requestBody = ctx.service.utils.jiemiFn(ctx.request.body.data)
        
        let options = {
            id: requestBody.id
        }
        if (!options.id) {
            return { massage: '', code: -1 }
        }
        this.ctx.body = await ctx.service.articlejt.postArticlejt(options.id)
    }
    async findArticlejt() {
        const { ctx } = this;
        let requestBody = ctx.service.utils.jiemiFn(ctx.request.body.data)

        let options = {
            id: requestBody.id
        }
        if (!options.id) {
            return { massage: '', code: -1 }
        }
        // const rule = {
        //     id: { allowEmpty: false, message: 'id不能为空！' }
        // };
        // ctx.validate(rule, options)
        this.ctx.body = await ctx.service.articlejt.findArticlejt(options.id)
    }
   
    async updateArticlejt() {
        const { ctx } = this;
        let requestBody = ctx.service.utils.jiemiFn(ctx.request.body.data)

        let options = {
            id: requestBody.id,
            updates: requestBody.updates
        }
        // console.log(ctx.request.body)
        // const rule = {
        //     id: { type: ['string'], allowEmpty: false, message: 'id不能为空！' },
        //     updates: {
        //         type: ['object'], allowEmpty: false,
        //     }
        // };
        // ctx.validate(rule, options)
        this.ctx.body = await ctx.service.articlejt.updateArticlejt(options.id, options.updates)
    }
    async delArticlejt() {
        const { ctx } = this;
        let requestBody = ctx.service.utils.jiemiFn(ctx.request.body.data)
        let options = {
            id: requestBody.id
        }
        const rule = {
            id: { type: 'string', allowEmpty: false, message: 'id不能为空！' }
        };
        try{
            ctx.validate(rule, options)
        }catch{
            return {code:-1,message:'参数错！'}
        }
        this.ctx.body = await ctx.service.articlejt.delArticlejt(options.id)
    }
    
    async getArticlejtList() {
        const { ctx } = this;
        this.ctx.body = await ctx.service.articlejt.getArticlejtList(ctx.request.body);
    }
    //静态获取
    async getJingTaiTodayNum(){
        const { ctx } = this;
        //验证密码
        // console.log(ctx.request.body.password)
        if(!ctx.request.body.password||ctx.request.body.password!=='123123') {
            return this.ctx.body = '.';
        }
        this.ctx.body = await ctx.service.articlejt.getJingTaiTodayNum(ctx.request.body)
   }
   async getArticlejthtml(){
        const { ctx } = this;
        this.ctx.body = await ctx.service.autoArticle.getArticlejthtml();
   }
}
module.exports = ArticleController;