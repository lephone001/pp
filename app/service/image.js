"use strict";
const path = require('path');
const fs = require('fs');
const Service = require("egg").Service;
// let TextToSVG = require('text-to-svg');
let fontPath = process.cwd() + '/app/public/fonts/ybzt.ttf';
// const svg2img = require('svg2img');
const Jimp = require('jimp');

class Image extends Service {
  //用户列表
  async imageList({ offset = 0, pid, cid, sTime, eTime }) {
    let limit = 30;
    let criteria = {};
    const countCategoryId = cid ? cid : 'all';
    const countPid = pid ? pid + '-' : 'all-';
    const countName = 'image-list-' + countPid + countCategoryId;
    if (pid) criteria.pid = pid;
    if (cid) criteria.cid = cid;
    // let redisResponseData = null
    // redisResponseData = await this.ctx.service.cache.get(countName);
    let count = await this.ctx.model.Counters.findById(countName).select('seq').lean();
    // 异步存入文章条件的总数
    this.ctx.model.Image.countDocuments(criteria, (err, c) => {
      if (!count) {
        this.ctx.model.Counters.create({
          _id: countName,
          seq: c
        })
      } else if (count.seq !== c) {
        this.ctx.model.Counters.updateOne({ _id: countName }, { $set: { seq: c } }).exec()
        this.ctx.service.cache.clearRedisKeyList('image-list-');
      }
    });
    // console.log(redisResponseData)
    // if (redisResponseData) return redisResponseData
    let rows = await this.ctx.model.Image.find(criteria, { 'list': 0, 'status': 0, 'isBad': 0, 'updatedAt': 0, 'previewWidth': 0, 'previewHeight': 0 }).sort({ "_id": -1 }).skip(offset).limit(limit).lean(); //.sort({"createdAt":-1})
    const ResponseData = {
      code: 200,
      data: {
        data: rows,
        count: count ? count.seq : 1,
        limit,
        offset,
      },
    };
    // if (rows && rows.length > 0 && count && count.seq > 1) {
    //   this.ctx.service.cache.set(countName, ResponseData);
    // }
    // 把count 修改一下
    return ResponseData;
  }
  async findImage({ id, type = "view" }) {
    const image = await this.ctx.model.Image.findById(id);
    if (!image) {
      return { code: -1, message: "视频播放站点找不到！" + id };
    }
    let types = ["view", "star", "bad"];
    if (!types.includes(type)) return { code: -1, message: "错误！" + id };
    this.ctx.model.Image.updateOne(
      { _id: id },
      {
        view: image.view++
      }
    )
    return { code: 200, data: image, message: "成功！" };
  }
  async createLogoImage(name='名称',link = "LOGO.COM", color = "#000000") {
    let fontPath = process.cwd() + '/app/public/fonts/ybzt.ttf';
    // let textToSVG = TextToSVG.loadSync(fontPath); // 加载字体文件
    let options = {
      x: 0,         //文本开头的水平位置（默认值：0）
      y: 0,         // 文本的基线的垂直位置（默认值：0）
      fontSize: 72, // 字体大小
      anchor: 'top', // 坐标中的对象锚点
      // letterSpacing: "",  // 设置字母的间距
      attributes: {
        fill: color // 文字颜色
      }
    }
    const fname = link.replace(/\:/g, '')
    let pathnameLogo = process.cwd() + '/app/public/logo.png'
    let pathnamePNG = process.cwd() + '/app/public/logos/' + fname + '.png'
    // let textSVG = await textToSVG.getSVG(link, options);
    // svg2img(textSVG, function(error, buffer) {
    //     fs.writeFileSync(pathnamePNG, buffer);
    // });
    if (!fs.existsSync(pathnamePNG)) {
      let sourceImage = null;
      Jimp.read(pathnameLogo).then(image => {
        sourceImage = image;
        //加载水印字体
        return Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
      }).then(font => {
        //生成水印并保存
        sourceImage.print(font, 78, 50, link)
          .write(pathnamePNG);//10表示水印开始的坐标，原点为左上角
      })
    }

    // if (!fs.existsSync(pathnamePNG)) {
    //   let sourceImage = null;
    //   Jimp.read(pathnameLogo).then(image => {
    //     sourceImage = image;
    //     //加载水印字体
    //     return Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
    //   }).then(font => {
    //     //生成水印并保存
    //     sourceImage.print(font, 78, 10, "我的")
    //     return Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
 
    //   }).then(font => {
    //     sourceImage.print(font, 78, 50, link).write(pathnamePNG)
    //   })
    // }


    // await fs.writeFile(pathnameSVG, textSVG, null, function (err) { });
    // const svg = fs.readFileSync(pathnameSVG, 'utf8');
    // svg2img(svg, (error, buffer) => {
    //   if (error) {
    //     console.error(error);
    //   } else {
    //     fs.writeFileSync(pathnamePNG, buffer);
    //     console.log('SVG 转换为 PNG 成功');
    //   }
    // });

  }
}

module.exports = Image;



