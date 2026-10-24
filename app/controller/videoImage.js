
'use strict';

const Controller = require('egg').Controller;
class VideoImageController extends Controller {

    async videoImageList() {
        const { ctx } = this;
        this.ctx.body = await ctx.service.video.contentList('image', ctx.request.body)
    }
    async createVideoImage() {
        const { ctx } = this;
        const createRule = {
            videoImagename: { type: 'string', allowEmpty: false, message: '站点名称不能为空！' },
            rulename: { type: 'string', allowEmpty: false, message: '站点拼音不能为空！' },
        };
        ctx.validate(createRule, ctx.request.body)
        this.ctx.body = await ctx.service.videoImage.createVideoImage(ctx.request.body)
    }
    async findVideoImage() {
        const { ctx } = this;
        let options = {
            id: ctx.request.body.id
        }
        const rule = {
            id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
        };
        if (!/^[a-fA-F0-9]{24}$/.test(String(options.id || ''))) return this.ctx.body = { code: -1, message: 'id 无效' }
        this.ctx.body = await ctx.service.video.findImageContent(options.id)
    }
    async updateVideoImage() {
        const { ctx } = this;
        let options = {
            id: ctx.request.body.id,
            updates: ctx.request.body.updates
        }
        const rule = {
            id: { type: ['number'], allowEmpty: false, message: 'id不能为空！' },
            updates: {
                type: ['object'], allowEmpty: false,
            }
        };
        if (!/^[a-fA-F0-9]{24}$/.test(String(options.id || ''))) return this.ctx.body = { code: -1, message: 'id 无效' }
        this.ctx.body = await ctx.service.video.updateImageContent(options.id, options.updates)
    }
    async disableVideoImage() {
        const { ctx } = this;
        let options = {
            id: ctx.request.body.id,
        }
        const rule = {
            id: { type: ['number'], allowEmpty: false, message: 'id不能为空！' },
        };
        if (!/^[a-fA-F0-9]{24}$/.test(String(options.id || ''))) return this.ctx.body = { code: -1, message: 'id 无效' }
        this.ctx.body = await ctx.service.video.updateImageContent(options.id, { status: 0 })
    }
    async delVideoImage() {
        const { ctx } = this;
        let options = {
            id: ctx.request.body.id
        }
        const rule = {
            id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
        };
        if (!/^[a-fA-F0-9]{24}$/.test(String(options.id || ''))) return this.ctx.body = { code: -1, message: 'id 无效' }
        this.ctx.body = await ctx.service.video.deleteImageContent(options.id)
    }
}
module.exports = VideoImageController;
