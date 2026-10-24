
'use strict';

const Controller = require('egg').Controller;
const verifyUser = function (value) {
    var uPattern = /^[a-zA-Z0-9_-]{5,20}$/;
    return uPattern.test(value)
}
const verifyEmail = function (value) {
    var ePattern = /^([A-Za-z0-9_\-\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;
    return ePattern.test(value)
}
class UploadController extends Controller {
    async upload() {
        const { ctx } = this;
        if (ctx.query.password !== 'aaa123456') return { code: -1, message: '密码不正确！' }
        if (ctx.query.type == '1') {
            // 普通图片
            let { cid, tag, cname } = ctx.query;
            if (!cid || !tag) return { code: -1, message: '分类标签' }
            if (!ctx.request.files || ctx.request.files.length === 0 || ctx.request.files.length > 50) {
                return ctx.response.body = { code: -1, message: '上传文件数量不正确！' }
            }
            let data = await ctx.service.upload.imagesUploads({
                tag: tag.split(','),
                cid,
                cname
            })
            return ctx.response.body = data
        }
        if (ctx.query.type == '2') {
            // xf图片
            if (!ctx.request.files || ctx.request.files.length === 0 || ctx.request.files.length > 20)
                return ctx.response.body = { code: -1, message: '上传文件数量不正确！' }
            let data = await ctx.service.upload.missUploads(ctx)
            return ctx.response.body = data
        }
        if (ctx.query.type == '3') {
            // 选妃视频
            if (!ctx.request.files || ctx.request.files.length === 0 || ctx.request.files.length > 5)
                return ctx.response.body = { code: -1, message: '上传文件数量不正确！' }
            return ctx.response.body = await ctx.service.upload.missUploadsVideo(ctx)
        }
    }
    async uploadbaiduverify() {
        const { ctx } = this;
        let files = ctx.request.files;
        if (!files || files.length === 0 || files.length > 50) {
            return ctx.response.body = { code: -1, message: '上传文件数量不正确！' }
        }
        let allsize = ctx.request.headers['content-length']
        let fileSizeMax = false;
        const fileSize = allsize / Math.pow(1024, 2)
        if (fileSize > 50) {
            fileSizeMax = true;
        }
        if (fileSizeMax||!allsize) {
            return ctx.response.body = {
                message: '文件大小限制！',
                code: 400
            }
        }
        return ctx.response.body = await ctx.service.upload.uploadbaiduverify(ctx)
    }
}
module.exports = UploadController; 