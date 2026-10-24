
'use strict';

const Controller = require('egg').Controller;
class ArticleController extends Controller {
    async clearCatch() {
        const { ctx } = this;
        await ctx.service.cache.clearRedisKeyList('article-list')
        this.ctx.body = {
            code: 200,
            message: '缓存清楚成功'
        }
    }
    async getArticleData(){
        const { ctx } = this;
        let name = 'getArticleDatabaike'
        let cvb = '发送成功！'
        if(ctx.params.id){
            name = ctx.params.id
        }
        if(name=='fubiaoti'){
            cvb = '<h1>修改成功！</h1>'
            // ctx.service.domain.updateFuBiaoTi()
            ctx.service.domain.updateBeiAnName()
        }else{
            ctx.service[name].getData()
        }
        this.ctx.body = cvb
    }
    async articleList() {
        const { ctx } = this;
        if (!ctx.request.body.sid) return this.ctx.body = {}
        this.ctx.body = await ctx.service.article.articleList(ctx.request.body)
    }

    
    async getArticleDataList(){
        const { ctx } = this;
        //验证密码
        // console.log(ctx.request.body.password)
        if(!ctx.request.body.password||ctx.request.body.password!=='123123') {
          return this.ctx.body = '.';
        }
        this.ctx.body = await ctx.service.article.getArticleList(ctx.request.body)
      }

    async articlehyList() {
        const { ctx } = this;
        if (!ctx.request.body.sid && !ctx.request.body.categoryId) return this.ctx.body = {}
        this.ctx.body = await ctx.service.article.articlehyList(ctx.request.body)
    }
    async createArticle() {
        const { ctx } = this;
        const createRule = {
            title: { type: 'string', allowEmpty: false, message: '文章名称不能为空！' },
            // cid: { type: 'number', allowEmpty: false, message: '文章名称不能为空！' },
            content: { type: 'string', allowEmpty: false, message: '文章内容不能为空！' },
        };
        try{
            ctx.validate(createRule, ctx.request.body)
        }catch{
            return this.ctx.body = {
                code:-1,
                message:'文章参数错误！'
            }
        }
        this.ctx.body = await ctx.service.article.createArticle(ctx.request.body)
    }
    async findArticle() {
        const { ctx } = this;
        let options = {
            id: ctx.request.body.id
        }
        if (!options.id) {
            return { massage: '', code: -1 }
        }
        // const rule = {
        //     id: { allowEmpty: false, message: 'id不能为空！' }
        // };
        // ctx.validate(rule, options)
        this.ctx.body = await ctx.service.article.findArticle(options.id)
    }
    async findhyArticle() {
        const { ctx } = this;
        let options = {
            id: ctx.request.body.id
        }
        if (!options.id) {
            return { massage: '', code: -1 }
        }
        this.ctx.body = await ctx.service.article.findhyArticle(options.id)
    }
    async updateArticle() {
        const { ctx } = this;
        let options = {
            id: ctx.request.body.id,
            updates: ctx.request.body.updates
        }
        // console.log(ctx.request.body)
        // const rule = {
        //     id: { type: ['string'], allowEmpty: false, message: 'id不能为空！' },
        //     updates: {
        //         type: ['object'], allowEmpty: false,
        //     }
        // };
        // ctx.validate(rule, options)
        this.ctx.body = await ctx.service.article.updateArticle(options.id, options.updates)
    }
    async updateArticleCacheList() {
        const { ctx } = this;
        await ctx.service.article.updateArticleCacheList();
        ctx.body = {
            code: 200,
            message: '文章列表缓存生成成功'
        };
    }
    async delArticle() {
        const { ctx } = this;
        let options = {
            id: ctx.request.body.id - 0
        }
        const rule = {
            id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
        };
        ctx.validate(rule, options)
        this.ctx.body = await ctx.service.article.delArticle(options.id)
    }
    async addArticleMany(){
        const { ctx } = this;
        // articleGetDataTXTY  articleGetDataYXX  articleGetDataZXS   articleGetDataJSCJ
        let { startPage, endPage, name = 'articleGetDataTXTY' } = ctx.request.body
        ctx.service[name].getData({ startPage, endPage })
        this.ctx.body = {
            code: 200,
            message: '抓取开始！'
        }
    }
    async getArticleList() {
        const { ctx } = this;
        this.ctx.body = await ctx.service.article.getArticleList(ctx.request.body);
    }
    async createArticleCopy() {
        const { ctx } = this;
        let queryData = ctx.request.body
        // console.log(ctx.request.query)
        //验证一个密码aaa123456
        if (!ctx.request.query.password || ctx.request.query.password !== 'aaa123456') {
            return ctx.response.body = { code: -1, message: '无权限添加' }
        }
        let data = await ctx.service.article.createArticleCopy(queryData)
        return ctx.response.body = data
    }

    //文章分类
    async articleCategoryList() {
        const { ctx } = this;
        this.ctx.body = await ctx.service.article.articleCategoryList(ctx.request.body)
    }

    async createArticleCategory() {
        const { ctx } = this;
        let categorys = ctx.service.utils.jiemiFn(ctx.request.body.categorys)
        this.ctx.body = await ctx.service.article.createArticleCategory(categorys)
    }
    async findArticleCategory() {
        const { ctx } = this;
        let options = {
            id: ctx.request.body.id - 0
        }
        const rule = {
            id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
        };
        ctx.validate(rule, options)
        this.ctx.body = await ctx.service.article.findArticleCategory(options.id)
    }
    async updateArticleCategory() {
        const { ctx } = this;
        let options = ctx.service.utils.jiemiFn(ctx.request.body.data)
        // console.log(ctx.request.body)
        this.ctx.body = await ctx.service.article.updateArticleCategory(options)
    }
    async delArticleCategory() {
        const { ctx } = this;
        this.ctx.body = await ctx.service.article.delArticleCategory(ctx.request.body.id)
    }
}
module.exports = ArticleController;
