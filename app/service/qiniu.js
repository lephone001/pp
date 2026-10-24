'use strict';
const Service = require('egg').Service;
const fs = require('fs')
const path = require("path");
const pump = require('mz-modules/pump');
// const crypto = require("crypto");
// const id = crypto.randomBytes(16).toString("hex");
const images = require('images');
const qiniu = require("qiniu");

//需要填写你的 Access Key 和 Secret Key , bucket空间
const accessKey = 'lDsurA-RtYMPPbpDbRLcFRhWMv0Amo_QktlXheac';
const secretKey = 'a9XqisfWaaiQZmRKNM1b8kWTDzRBRSiEm6surBfI';
const bucket = 'nav123';
const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
const config = new qiniu.conf.Config();
config.zone = qiniu.zone.Zone_z2;  // 空间对应的机房

//构建上传策略函数
const options = {
    scope: bucket,
    expires: 720000,
    force: true,
    callbackBodyType: 'application/json'
};
const putPolicy = new qiniu.rs.PutPolicy(options);
const uploadToken = putPolicy.uploadToken(mac);

var moment = require('moment')
moment.locale('zh-CN');

class Qiniu extends Service {
    async imagesUploads() {
        // 普通图片上传
        const { ctx } = this
        const files = ctx.request.files;
        let type = ctx.request.query.type
        if (!files || files.length == 0) return { code: -1, message: 'error' }
        const dataNow = Date.now() + '-' + Math.random().toString().slice(-6)
        let resdata = []
        let index = 0
        try {
            for (const file of files) {
                //验证文件大小 单位M 
                const fileSize = fs.readFileSync(file.filepath).length / Math.pow(1024, 2)
                if (fileSize < 10) {
                    const filename = dataNow + '_' + index + path.extname(file.filename)
                    const readStream = fs.createReadStream(file.filepath);
                    const formUploader = new qiniu.form_up.FormUploader(config);
                    const putExtra = new qiniu.form_up.PutExtra();
                    let resBody = await new Promise((resolve, reject) => {
                        formUploader.putStream(uploadToken, filename, readStream, putExtra, function (respErr, respBody, respInfo) {
                            if (respErr) {
                                throw respErr;
                            }
                            if (respInfo.statusCode == 200) {
                                resolve(respBody);
                            } else {
                                reject(respBody);
                            }
                        });
                    });
                    index++
                    var sourceImg = images(file.filepath);
                    // console.log(sourceImg)
                    // 水印图片
                    // var watermarkImg = images(process.cwd() + "/app/public/images/common/" + 'logo.png');
                    // 等待加水印的图片
                    // 比如放置在右下角，先获取原图的尺寸和水印图片尺寸
                    var sWidth = sourceImg.width();
                    var sHeight = sourceImg.height();
                    // var wmWidth = watermarkImg.width();
                    // var wmHeight = watermarkImg.height();
                    // 设置绘制的坐标位置，右下角距离 5px
                    // images(sourceImg).draw(watermarkImg, sWidth - wmWidth, sHeight - wmHeight)
                    // .save(rootPath + uplaodBasePath + filePath + '/' + filename);
                    resdata.push({
                        index,
                        filename,
                        size: fileSize,
                        resBody
                    })
                    await ctx.model.Qiniu.create({
                        name:filename,
                        url:filename,
                        path:file.filepath,
                        type,
                        width:sWidth,
                        height:sHeight,
                        size:fileSize,
                    })
                }
            }
            return {
                code: 200,
                data: resdata
            }
        } catch (err) {
            console.log(err)
            return {
                code: -2,
                message: '文件上传错误！',
            }
        }
    }
}

module.exports = Qiniu;