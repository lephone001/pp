
'use strict';
const http = require('http')
const axios = require("axios").default;
const Controller = require('egg').Controller;
const fs = require('fs-extra');

class Utils extends Controller {
  async allPost() {
    this.ctx.status = 444;
    this.ctx.body = '';
  }
  async adminConfigInfo(){
    //获取本地存的
    let urlT = '/app/confi/admin_fetch.js';
    let isHaveAdminFile = fs.existsSync(process.cwd()+urlT)
    let textAdminJSON = {}
    let adminText = ``

    if (isHaveAdminFile) {
      adminText = fs.readFileSync(process.cwd()+urlT, 'utf-8');
    }
    if(adminText){
      textAdminJSON = JSON.parse(adminText)
    }
    this.ctx.body = {
      code:200,
      data:ctx.service.utils.jiamiFn(textAdminJSON)
   }
  }
  async adminConfigInfoSave(){
    let urlT = process.cwd()+'/app/confi/admin_fetch.js';
    const { ctx } = this;
    let obf = ctx.request.body;
    let adminconf = ctx.service.utils.jiemiFn(obf)
    console.log(adminconf)
    fs.writeFile(urlT, JSON.stringify(textJSON), null, function (err) { });
    this.ctx.body = {
      code:200,
      data:'保存成功！'
   }
  }
  async biyingRandomImage() {
    const { ctx } = this;
    // ctx.service.utils.biyingRandomImage(ctx.request.body)
    this.ctx.body = {
      code: 200,
      message: '发送成功！'
    }
  }
  async testapi() {
    const { ctx } = this;
    ctx.service.utils.testapi(ctx.request.body)
    this.ctx.body = {
      code: 200,
      message: '发送成功！'
    }
  }
  async commonController() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.utils.commonController(ctx.request.body)
  }
  async globalConfigUpdate() {
    const { ctx } = this;
    ctx.body = await ctx.service.cache.globalConfigUpdate(ctx.request.body)
  }
  async clearRedisKeyList() {
    const { ctx } = this;
    let key = ctx.request.body.key
    let options = {
      key
    }
    const rule = {
      key: { type: 'string', allowEmpty: false, message: 'key不能为空！' },
    };
    ctx.validate(rule, options)
    ctx.body = await ctx.service.cache.clearRedisKeyList(key)
  }
  async clearAllCache() {
    const { ctx } = this;
    // 调用用户服务器的清除缓存api
    let uid = ctx.service.utils.getTokenInfo('id')
    let link = ctx.params.link
    let domain = await ctx.model.Domain.findOne({ link }).select('link uid uname')
    if (domain.uid !== uid) {
      return this.ctx.body = {
        code: -1,
        message: '刷新失败！'
      }
    }
    await axios.get(`http://${link}/api/cleatAllCacheFlushall/${link}`).then((res) => {
      this.ctx.body = {
        code: 200,
        message: '刷新成功！'
      }
    }).catch(() => {
      this.ctx.body = {
        code: -1,
        message: '刷新失败！'
      }
    })

  }

  async cleatAllCacheFlushall() {
    const { ctx } = this;
    let link = ctx.params.link;
    //&&ctx.params.link.indexOf('.')>=0
    if (link && 3<link.length < 150&&link!==0) {
      //刷新一个缓存
      await this.ctx.service.cache.del('AA-' + link);
      // 删除缓存的域名文件夹
      let domainFileName = link.replace(':', '##')
      let homePageFilePath = this.ctx.app.config.cacheFile + 'home/' + domainFileName
      ctx.service.utils.delDir(homePageFilePath)
      // console.log(domainFileName)
    } 
    if (ctx.params.link == 0) {
      await ctx.service.cache.flushall();
      let cacheFile = process.cwd() + '/cache/home'
      if(fs.existsSync(cacheFile)){
        fs.remove(cacheFile, err => {
          if (err) return console.error(err);
          fs.mkdirSync(cacheFile);
        });
      }
      
      
      // fs.statSync(cacheFile).isDirectory()
      // fs.mkdirSync(cacheFile + '/nav');
      // fs.mkdirSync(cacheFile + '/article');
    }
    ctx.body = {
      code: 200,
      massage: '刷新成功！'
    }
  }
  async proxyip() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.utils.proxyip();
  }
  async uploadImage() {
    const { ctx } = this;
    if (ctx.request.body.password !== 'aaa123456') {
      return ctx.body = {
        message: "上传失败密码无效！",
        code: 400
      }
    }
    let fileType = ctx.request.body.password
    await ctx.service.utils.uploadImage({ fileType: fileType });
  }
  async uploadFiles() {
    const { ctx } = this;
    let fileType = ctx.request.body.fileType
    // let files = ctx.request.files// file包含了文件名，文件类型，大小，路径等信息，可以自己打印下看看
    // 读取文件
    // for (let file of files) {
    //     console.log(fs.readFileSync(file.filepath).length)
    // }
    let data = {}
    if (fileType == 'adv') {
      data = await ctx.service.utils.uploadFiles({ fileType: 'adv' });
    } else if (fileType == 'navlogo') {
      data = await ctx.service.utils.uploadFiles({ fileType: 'navlogo' });
    }
    if (data) {
      ctx.body = data;
    } else {
      ctx.body = {
        message: "上传失败"
      }
    }
  }
  async randomPicturs() {
    const { ctx } = this;
    let typeList = [
      'mn',
      'mn2',
      'mn3',
    ]
    // 默认图片是运动类型的
    let randomImageType = typeList[(Math.round(Math.random() * (typeList.length - 1)))]
    ctx.response.type = "image/jpg"
    let resimg = '';
    try {
      resimg = fs.createReadStream(`app/public/images/article/${randomImageType}/` + (Math.round(Math.random() * (20 - 1)) + 1) + '.jpg');
    } catch {
      resimg = fs.createReadStream('app/public/images/article/mn/1.jpg');
    }
    ctx.body = resimg
  }
  async pushSubmit() {
    const { ctx } = this;
    let { link, type, tijiaoNum } = ctx.request.body
    ctx.body = await ctx.service.utils.pushSubmit({ link, type, tijiaoNum });
  }
  async getCommonImage() {
    // type id num
    const { ctx } = this;
    let typeRule = ['site', 'article', 'mulu']
    let numList = [0, 1, 2, 3, 4, 5]
    // 颜色值列表数组
    let bgColor = [
      ['#000000', '#000000', '#FFFFFF'],
      [],
      []
    ]
    console.log()
    ctx.body = '';
  }
  // router.get("/image_site/:id/:num.jpg", controller.utils.randomPicturs);
  // router.get("/image_article/:id/:num.jpg", controller.utils.randomPicturs);
  // router.get("/mulu/:id/:num.jpg", controller.utils.randomPicturs);


}
module.exports = Utils;
