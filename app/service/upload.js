'use strict';
const Service = require('egg').Service;
const fs = require('fs')
const path = require("path");
const pump = require('mz-modules/pump');
// const crypto = require("crypto");
// const id = crypto.randomBytes(16).toString("hex");
const images = require('images');

var moment = require('moment')
moment.locale('zh-CN');

class Upload extends Service {
    async imagesUploads({ cid = 1, tag = [], cname = '' }) {
        // 普通图片上传
        const { ctx } = this
        // const username = getTokenInfo(ctx, 'username')
        // const uid = getTokenInfo(ctx, 'id')
        // const createdAt = formatDateTime()
        // console.log(ctx.request.files);
        const files = ctx.request.files;
        // const yesTime = formatDateTime(Date.now() - 1000 * 3600 * 12)
        if (!files || files.length == 0) return { code: -1, message: 'error' }
        // 验证当天一个用户上传文件的数量不能超过100个------------------------
        // var countSql = `SELECT COUNT(*) FROM upload WHERE uid = ${uid} and createdAt >= "${yesTime}"`
        // let countNum = await db.Query(countSql);
        // if (countNum[0]['COUNT(*)'] >= 100) {
        //     return {
        //         code: - 1, message: '上传数量上限'+Math.random().toString().slice(-6)
        //     }
        // }
        const dataNow = Date.now() + '-' + Math.random().toString().slice(-6)
        const filePath = moment().format('YYYY-MM-DD') + '-' + dataNow;
        const rootPath = process.cwd() + '/uploads'
        const uplaodBasePath = "/images/mn/"

        // 每次上传创建新的文件夹进行存放
        if (!fs.existsSync(path.join(rootPath + uplaodBasePath, filePath))) {
            fs.mkdirSync(path.resolve(rootPath + uplaodBasePath, filePath))
        }
        // 上传基础目录
        // const dirName = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);
        let resdata = []
        let index = 0
        try {
            for (const file of files) {
                //验证文件大小 单位M 
                const fileSize = fs.readFileSync(file.filepath).length / Math.pow(1024, 2)
                if (fileSize < 10) {
                    console.log(file)
                    console.log(path.extname(file.filename))
                    // 生成文件名
                    const filename = dataNow + '_' + index + path.extname(file.filename)
                    // 生成文件夹
                    const targetPath = path.join(rootPath + uplaodBasePath + filePath, filename);
                    const readStream = fs.createReadStream(file.filepath);
                    const writeStream = fs.createWriteStream(targetPath);
                    index++
                    await pump(readStream, writeStream);
                    //记录存到upload数据库
                    let saveData = {
                        name: filename,
                        uid: 1,
                        sid: 56,
                        username: 'admin',
                        type: '',
                        typeName: '图片',
                        sitename: 'xf',
                        path: uplaodBasePath + filePath + '/' + filename,
                        size: fileSize,
                    }

                    var sourceImg = images(rootPath + uplaodBasePath + filePath + '/' + filename);

                    // console.log(sourceImg)
                    // // 水印图片
                    // var watermarkImg = images(process.cwd() + "/app/view/assets/images/common/" + 'logo.png');
                    // 等待加水印的图片
                    // 比如放置在右下角，先获取原图的尺寸和水印图片尺寸
                    var sWidth = sourceImg.width();
                    var sHeight = sourceImg.height();
                    // var wmWidth = watermarkImg.width();
                    // var wmHeight = watermarkImg.height();
                    //设置绘制的坐标位置，右下角距离 5px
                    // images(sourceImg).draw(watermarkImg, sWidth - wmWidth, sHeight - wmHeight)
                    //   .save(rootPath + uplaodBasePath + filePath + '/' + filename);
                    resdata.push({
                        index,
                        url: (uplaodBasePath + filePath + '/' + filename),
                        filename,
                        filePath,
                        width: sWidth,
                        height: sHeight,
                        size: fileSize
                    })
                    await this.ctx.model.Upload.create(saveData);
                }
            }
            // 保存到对应的数据库
            let previewImage = resdata[0]
            await this.ctx.model.Image.create({
                view: Math.random().toString().slice(-1) + 1 + Math.random().toString().slice(-3) - 0,
                status: true,
                list: resdata,
                preview: previewImage.url,
                previewWidth: previewImage.width,
                previewHeight: previewImage.height,
                isHot: 0,
                isBad: 0,
                cid,
                cname,
                tag
            });
            // console.log(resdata)
            return {
                code: 200,
                data: resdata
            }
        } catch {
            // delete those request tmp files
            await ctx.cleanupRequestFiles();
            return {
                code: -2,
                message: '文件上传错误！',
            }
        }
    }
    async missUploads({ }) {
        return {
            code: 200,
            data: {
                data: rows,
                count,
                limit,
                offset
            }
        }
    }
    async missUploadsVideo({ }) {
        return {
            code: 200,
            data: {
                data: rows,
                count,
                limit,
                offset
            }
        }
    }

    async missUploadsVideo() {
        const username = getTokenInfo(ctx, 'username')
        const uid = getTokenInfo(ctx, 'id')
        const createdAt = formatDateTime()
        const files = ctx.request.files;
        const yesTime = formatDateTime(Date.now() - 1000 * 3600 * 12)
        // 验证当天一个用户上传文件的数量不能超过100个------------------------
        var countSql = `SELECT COUNT(*) FROM upload WHERE uid = ${uid} and createdAt >= "${yesTime}"`
        let countNum = await db.Query(countSql);
        if (countNum[0]['COUNT(*)'] >= 100) {
            return {
                code: -1, message: '上传数量上限'
            }
        }
        const dataNow = Date.now()
        const filePath = new Date().getFullYear() + '-' + (new Date().getMonth() + 1) + '-' + dataNow;
        const rootPath = process.cwd() + '/static'
        const uplaodBasePath = "/images/miss-video/"//'app/public/uploads/images/' + fileType + '/' + dirName + '/';
        const uplaodBasePathImage = "/images/miss-video/"
        // 生成文件夹
        if (!fs.existsSync(path.join(rootPath + uplaodBasePath, filePath))) {
            fs.mkdirSync(path.resolve(rootPath + uplaodBasePath, filePath))//视频
        }
        // 上传基础目录
        // const dirName = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);
        let resdata = []
        let index = 0
        try {
            for (const file of Object.values(files)) {
                //验证文件大小
                const fileSize = file.size / Math.pow(1024, 2)
                if (fileSize > 2048) {
                    return {
                        message: '文件不能超过2G',
                        code: 400
                    }
                }
                // console.log(file.name)
                // 生成文件名  + 
                const beforeFileName = file.name.slice(0, file.name.lastIndexOf('.'));

                const filename = dataNow + '_' + index + path.extname(file.name).replace('.MP4', '.mp4')

                const targetPath = path.join(rootPath + uplaodBasePath + filePath, filename);
                const readStream = fs.createReadStream(file.path);
                const writeStream = fs.createWriteStream(targetPath);
                index++
                resdata.push({
                    index: index,
                    url: (uplaodBasePath + filePath + '/' + filename),
                    filename,
                    filePath
                })
                await pump(readStream, writeStream);
                //生成略缩图和预览图
                MissVideoTransfrom(
                    {
                        url: rootPath + uplaodBasePath + filePath + '/' + filename,
                        uplaodBasePathImage: rootPath + uplaodBasePathImage + filePath + '/',
                        filePath,
                        dataNow,
                        beforeFileName,
                        filename,
                        rootPath,
                        uplaodBasePath,
                    }
                )
                //记录存到数据库
                let saveSql = `
        insert into
            upload (name,path,username,sitename,createdAt,updatedAt,uid,size,sid)
        values
        ('${filename}',
        '${uplaodBasePath + filePath + '/' + filename}',
        '${username}',
        'xf-video',
        '${createdAt}',
        '${createdAt}',
        '${uid}',
        '${fileSize}',
        '${56}');
        `;
                await db.Query(saveSql);
            }
            return {
                code: 200,
                data: resdata
            }
        } catch {
            // delete those request tmp files
            //await ctx.cleanupRequestFiles();
            return {
                code: -2,
                message: '文件上传错误！',
            }
        }
    }

    async missUploads() {
        const { ctx } = this
        const username = getTokenInfo(ctx, 'username')
        const uid = getTokenInfo(ctx, 'id')
        const createdAt = formatDateTime()
        // console.log(ctx.request.files);
        const files = ctx.request.files;
        const yesTime = formatDateTime(Date.now() - 1000 * 3600 * 12)
        // 验证当天一个用户上传文件的数量不能超过100个------------------------
        var countSql = `SELECT COUNT(*) FROM upload WHERE uid = ${uid} and createdAt >= "${yesTime}"`
        let countNum = await db.Query(countSql);
        if (countNum[0]['COUNT(*)'] >= 100) {
            return {
                code: - 1, message: '上传数量上限'
            }
        }
        const dataNow = Date.now()
        const filePath = new Date().getFullYear() + '-' + (new Date().getMonth() + 1) + '-' + dataNow;
        const rootPath = process.cwd() + '/static'
        const uplaodBasePath = "/images/new-miss/"//'app/public/uploads/images/' + fileType + '/' + dirName + '/';
        if (!fs.existsSync(path.join(rootPath + uplaodBasePath, filePath))) {
            fs.mkdirSync(path.resolve(rootPath + uplaodBasePath, filePath))//视频
        }

        // 上传基础目录
        // const dirName = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);
        let resdata = []
        let index = 0
        try {
            for (const file of Object.values(files)) {
                //验证文件大小 单位M 
                const fileSize = file.size / Math.pow(1024, 2)
                if (fileSize < 10) {
                    // console.log(file)
                    // 生成文件名  + 
                    const beforeFileName = file.name.slice(0, file.name.lastIndexOf('.'));
                    const filename = dataNow + '_' + index + path.extname(file.name)

                    // const uplaodBasePathImage = "/static/uploads/huatu/"
                    // const sqlUplaodBasePathImage = "/images/miss/" //数据库的路径不加/static
                    // 生成文件夹

                    const targetPath = path.join(rootPath + uplaodBasePath + filePath, filename);
                    const readStream = fs.createReadStream(file.path);
                    const writeStream = fs.createWriteStream(targetPath);
                    resdata.push({
                        index,
                        url: (uplaodBasePath + filePath + '/' + filename),
                        filename,
                        filePath
                    })
                    index++
                    //return readStream.pipe(writeStream);
                    await pump(readStream, writeStream);
                    //记录存到数据库
                    let saveSql = `
          insert into
              upload (name,path,username,sitename,createdAt,updatedAt,uid,size,sid)
          values
          ('${filename}',
          '${uplaodBasePath + filePath + '/' + filename}',
          '${username}',
          'xf',
          '${createdAt}',
          '${createdAt}',
          '${uid}',
          '${fileSize}',
          '${56}');
          `;
                    await db.Query(saveSql);
                    // //水印图片
                    // var watermarkImg = images(rootPath + "/static/images/common/" + 'water_logo.png');
                    // //等待加水印的图片
                    // var sourceImg = images(rootPath + uplaodBasePath + filePath + '/' + filename);
                    // // 比如放置在右下角，先获取原图的尺寸和水印图片尺寸
                    // var sWidth = sourceImg.width();
                    // var sHeight = sourceImg.height();
                    // var wmWidth = watermarkImg.width();
                    // var wmHeight = watermarkImg.height();
                    // //设置绘制的坐标位置，右下角距离 5px
                    // images(sourceImg).draw(watermarkImg, sWidth - wmWidth - sWidth / 2, sHeight - wmHeight - sHeight / 2)
                    //   .save(rootPath + uplaodBasePath + filePath + '/' + filename);
                }
            }
            return {
                code: 200,
                data: resdata
            }
        } catch {
            // delete those request tmp files
            //await ctx.cleanupRequestFiles();
            return {
                code: -2,
                message: '文件上传错误！',
            }
        }
    }
    async videoUploads() {
        const { ctx } = this
        // console.log(ctx.request.files);
        const files = ctx.request.files;
        // 上传基础目录
        // const dirName = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);
        let resdata = []
        try {
            for (const file of Object.values(files)) {
                //验证文件大小
                const fileSize = file.size / Math.pow(1024, 2)
                if (fileSize > 2048) {
                    return {
                        message: '文件不能超过2G',
                        code: 400
                    }
                }
                // console.log(file.name)
                // 生成文件名  + 
                const beforeFileName = file.name.slice(0, file.name.lastIndexOf('.'));
                const dataNow = Date.now()
                const filePath = new Date().getFullYear() + '-' + (new Date().getMonth() + 1) + '-' + dataNow;
                const filename = dataNow + path.extname(file.name).replace('.MP4', '.mp4')
                const rootPath = process.cwd()
                const uplaodBasePath = "/static-auth/uploads/videos/huahua/"//'app/public/uploads/images/' + fileType + '/' + dirName + '/';
                const uplaodBasePathImage = "/static/uploads/videos/huahua/"
                const sqlUplaodBasePathImage = "/uploads/videos/huahua/" //数据库的路径不加/static
                // 生成文件夹
                if (!fs.existsSync(path.join(rootPath + uplaodBasePath, filePath))) {
                    fs.mkdirSync(path.resolve(rootPath + uplaodBasePath, filePath))//视频
                    fs.mkdirSync(path.resolve(rootPath + uplaodBasePathImage, filePath))//封面预览图
                }
                const targetPath = path.join(rootPath + uplaodBasePath + filePath, filename);
                const readStream = fs.createReadStream(file.path);
                const writeStream = fs.createWriteStream(targetPath);

                resdata.push({
                    index: file.field - 0,
                    url: (uplaodBasePath + filePath + '/' + filename),
                    filename,
                    filePath
                })
                //return readStream.pipe(writeStream);
                await pump(readStream, writeStream);
                //生成略缩图和预览图
                //转 m3u8 -c:v libx264 -c:a aac -strict -2 -f hls output.m3u8
                //-c:v libx264 -c:a aac -strict -2 -f hls -hls_list_size 0 -hls_time 5 data/output.m3u8
                //ffmpeg(rootPath + uplaodBasePath + filePath + '/' + filename)
                videoTransfrom(
                    {
                        url: rootPath + uplaodBasePath + filePath + '/' + filename,
                        uplaodBasePathImage: rootPath + uplaodBasePathImage + filePath + '/',
                        sqlUplaodBasePathImage: sqlUplaodBasePathImage + filePath + '/',
                        filePath,
                        dataNow,
                        beforeFileName,
                        filename,
                        rootPath,
                        uplaodBasePath,
                    }
                )
                // ffmpeg(rootPath + uplaodBasePath + filePath + '/' + filename).run()
                //   .addOption([
                //   '-vcodec libx264',
                //   '-c:a aac',
                //   '-bufsize 3000k'
                // ]).save(rootPath + uplaodBasePath + filePath + '/' + dataNow + '.flv')
            }
        } finally {
            // delete those request tmp files
            //await ctx.cleanupRequestFiles();
            return {
                code: 200,
                data: 'success',
            }
        }
    }
    async uploadbaiduverify() {
        const { ctx } = this
        const username = this.ctx.service.utils.getTokenInfo(ctx, 'username')
        const uid = this.ctx.service.utils.getTokenInfo(ctx, 'id')
        let files = ctx.request.files;
        const rootPath = process.cwd() + '/baidu_verify/';
        let index = 0
        for (const file of Object.values(files)) {
            const filename = file.filename
            // 生成文件夹
            const fileSize = fs.readFileSync(file.filepath);
            const targetPath = path.join(rootPath, filename);
            const readStream = fs.createReadStream(file.filepath);
            const writeStream = fs.createWriteStream(targetPath);
            await pump(readStream, writeStream);
            await ctx.model.Upload.create({
                name: index+'-'+filename,
                uid: uid,
                sid: 0,
                username: username,
                type:0,
                typeName:0,
                sitename: 0,
                path:rootPath + '/' + filename ,
                size: fileSize.length,
            })
        }
        return {
            code: 200,
            message: '文件上传成功！',
        }
    }
}

module.exports = Upload;