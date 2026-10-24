
'use strict';

const Controller = require('egg').Controller;
class ArticleCommentsController extends Controller {

    async articleCommentsList() {
        const { ctx } = this;
        this.ctx.body = await ctx.service.articleComments.articleCommentsList(ctx.request.body)
    }
    async createArticleComments() {
        const { ctx } = this;
        const createRule = {
            articleCommentsname: { type: 'string', allowEmpty: false, message: '站点名称不能为空！' },
        };
        ctx.validate(createRule, ctx.request.body)
        this.ctx.body = await ctx.service.articleComments.createArticleComments(ctx.request.body)
    }
    async findArticleComments() {
        const { ctx } = this;
        let options = {
            id: ctx.request.body.id - 0
        }
        const rule = {
            id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
        };
        ctx.validate(rule, options)
        this.ctx.body = await ctx.service.articleComments.findArticleComments(options.id)
    }
    async updateArticleComments() {
        const { ctx } = this;
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
        this.ctx.body = await ctx.service.articleComments.updateArticleComments(options.id, options.updates)
    }
    async delArticleComments() {
        const { ctx } = this;
        let options = {
            id: ctx.request.body.id - 0
        }
        const rule = {
            id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
        };
        ctx.validate(rule, options)
        this.ctx.body = await ctx.service.articleComments.delArticleComments(options.id)
    }
}
module.exports = ArticleCommentsController;