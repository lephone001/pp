
'use strict';
const Controller = require('egg').Controller;
class ImageController extends Controller {
    async imageList() {
        const { ctx } = this;
        this.ctx.body = await ctx.service.image.imageList(ctx.request.body)
    }
    async findImage() {
        const { ctx } = this;
        this.ctx.body = await ctx.service.image.findImage(ctx.request.body)
    }
}
module.exports = ImageController;


