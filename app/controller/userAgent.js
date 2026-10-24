
'use strict';
const Controller = require('egg').Controller;
class UserAgentController extends Controller {
    async userAgentList() {
        const { ctx } = this;
        this.ctx.body = await ctx.service.userAgent.userAgentList(ctx.request.body)
    }
    async userAgentCreate() {
        const { ctx } = this;
        let requestBody  = ctx.request.body.data
        let jmdata = ctx.service.utils.jiemiFn(requestBody)
        this.ctx.body = await ctx.service.userAgent.userAgentCreate(jmdata)
    }
    async userAgentDelete() {
        const { ctx } = this;
        this.ctx.body = await ctx.service.userAgent.userAgentDelete(ctx.request.body)
    }
    async userAgentUpdate() {
        const { ctx } = this;
        let requestBody  = ctx.request.body.data
        let jmdata = ctx.service.utils.jiemiFn(requestBody)
        this.ctx.body = await ctx.service.userAgent.userAgentUpdate(jmdata)
    }
    async userAgentGetOne(){
        const { ctx } = this;
        this.ctx.body = await ctx.service.userAgent.userAgentGetOne(ctx.request.body)
    }
}
module.exports = UserAgentController;