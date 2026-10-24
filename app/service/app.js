"use strict";
const Service = require("egg").Service;
const axios = require('axios')
const cheerio = require("cheerio");
var iconv = require("iconv-lite"); //解码用的
iconv.skipDecodeWarning = true;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function replaceAppCacheFile(tempPath, filename) {
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.promises.rename(tempPath, filename);
      return;
    } catch (error) {
      // Windows 并发读取时可能短暂占用目标文件，有限重试且保留旧文件。
      if (attempt >= 3 || ![ 'EPERM', 'EBUSY', 'EACCES' ].includes(error.code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
}

class App extends Service {
  async appList({ password,offset = 0, spage,sort={'_id':-1}, status,pageType,pageTypeId, epage, limit = 50, title, ncids, sTime, eTime }) {
    let criteria = {};
    let criteriaSort = {}
    // let uid = this.ctx.service.utils.getTokenInfo('id')
    // let uname = this.ctx.service.utils.getTokenInfo('username')
    // criteria.uid = uid;
    if (title && title.length < 50) criteria.title = eval('/' + title + '/i');
    const pageNum = epage - spage
    if(sort){
      criteriaSort = sort
    }

    let skipId = -1
    if (pageType && pageTypeId) {
      if (pageType == 'next') {
        criteria['_id'] = { "$lt": pageTypeId }
      } else if (pageType == 'prve') {
        criteria['_id'] = { "$gt": pageTypeId }
        skipId = 1
      } else if (pageType == 'firstPage') {
        skipId = -1
      } else if (pageType == 'lastPage') {
        skipId = 1
      }
    }

    if (ncids && ncids.length > 0) {
      criteria['ncids'] = { $in: ncids }
    }
    // if (status) criteria.status = status
    if (sTime && eTime) {
      criteria.createdAt = {
        $gte: new Date(sTime),
        $lt: new Date(eTime),
      }
    }

    let count = await this.ctx.model.App.countDocuments(criteria, (err, c) => c)
    let rows = null;
    if(password&&password=='123123'){
      rows = await this.ctx.model.App.find(criteria).sort(criteriaSort).skip(offset).limit(limit).lean()
    }else{
      rows = await this.ctx.model.App.find(criteria).sort(criteriaSort).skip(offset).limit(limit).select('title time status isOpenUrl themeColor sort image isProxy isH isN isT logo h5logo app h5 description keywords view todayView link createdAt').lean()
    }
    let rowsc = this.ctx.service.utils.jiamiFn(rows);
    const ResponseData = {
      code: 200,
      data: {
        data: rowsc,
        count,
        limit,
        offset,
      },
    };
    return ResponseData;
  }

  
  async commonCreateAppRequest({
    title, image, imageList, link, h5, app, logo, keywords, description, addIP, uname, uid, isProxy
  }) {
    await this.ctx.model.App.create({
      title,
      status: 2,
      reltitle: title,
      ncids: ['611d04d9fd5f4f70ec8750bb'],
      image,
      imageList,
      link,
      slink: link,
      h5,
      app,
      logo,
      isProxy,
      h5logo: logo,
      themeColor: '#000000',
      keywords,
      description,
      uname,
      uid,
      addIP
    })
    return { message: 'success' }
  }
  async commonCreateApp() {
    let { code, title, keywords, imageList, link, h5, logo, description } = this.ctx.request.body
    if (!title || !link || link.indexOf('http') == -1) {
      return { code: -2, message: '标题、链接错误！' }
    }
    if (typeof keywords !== 'string' || typeof h5 !== 'string' || typeof imageList !== 'object' || typeof description !== 'string' || typeof logo !== 'string') {
      return { code: -2, message: '分类错误！' }
    }
    if (title.length > 200 || imageList.length > 10 || logo.length > 100 || description.length > 180 || h5.length > 100 || link.length > 100) {
      return { code: -2, message: '格式错误！' }
    }
    if (this.ctx.session.appCode !== code) {
      return { code: -2, message: '验证码错误！' }
    }
    let app = await this.ctx.model.App.findOne({ link })
    if (app) return { code: -2, message: '导航已经被添加！' }
    let addIP = this.ctx.request.ip;
    // let count = await this.ctx.model.App.countDocuments({
    //   addIP, createdAt: {
    //     $gte: new Date(Date.now() - 3600000 * 12),
    //     $lt: new Date(Date.now() + 3600000 * 12),
    //   }
    // }, (err, c) => c);
    // if (count > 100) return { code: -2, message: '今日导航数量已经添加上限！' }
    let image = ''
    if (imageList.length > 0) image = imageList[0]
    let h = this.ctx.request.header.host
    if (!h || h.length > 100) return {}
    let host = h.toLowerCase();
    if (!host) return ''
    let domain = await this.ctx.model.Domain.findOne({ link: host }).select('uid uname');
    if (!domain) return ''
    // 调用主数据库api commonCreateAppRequest
    await axios.post(this.ctx.app.config.dbAdminHttpUrlIP + '/api/commonCreateAppRequest', {
      title,
      reltitle: title,
      image,
      imageList,
      link,
      isProxy: false,
      slink: link,
      h5,
      app,
      uname: domain.uname,
      uid: domain.uid,
      logo,
      h5logo: logo,
      keywords,
      description,
      addIP
    });
    return {
      code: 200,
      message: '添加成功！'
    }
  }
  //添加
  async createApp({ apps }) {
    let uid = this.ctx.service.utils.getTokenInfo('id')
    let uname = this.ctx.service.utils.getTokenInfo('username')
    if (!uid) return { message: '不允许添加！', code: -2 }
    let resault = {
      code: 200,
      data: {
        success: [],
        filed: []
      }
    }
    // console.log(apps)
    for (let item of apps) {
      let appitem = {
        title: item.title,
        reltitle: '',
        status: 1,
        view: Number(Date.now().toString().slice(7)),
        tags:'最新',
        category:'站长推荐APP',
        uname:'xxx_av',
        ncids:[],
        isProxy:false,
        isT:false,
        isOpenUrl:item.isOpenUrl,
        isH:false,
        isN:false,
        sort:0,
        image: '',
        addIP:'',
        imageList:[],
        link: '',
        slink: '',
        h5: '',
        app: '',
        logo: '',
        h5logo: '',
        themeColor:'',
        applogo:'',
        keywords:item.keywords,
        bad:0,
        star:0,
        time:moment(new Date()).format('LL'),
        description: item.description,
        id: parseInt((Date.now()+'').slice(5) + Math.random().toString().slice(-6)),
        copyid:Number(Date.now().toString().slice(7))+Math.random(),
        content:imagecont+content,
        content2:''
      }
      // console.log(app)
      if (!app) {
        await this.ctx.model.App.create(appitem).then(() => {
          resault.data.success.push({ copyid, title, message: '添加成功' })
        }).catch((res) => {
          resault.data.filed.push({ copyid, title, message: '链接重复！' })
        })
      } else {
        resault.data.filed.push({ copyid, title, message: '链接重复！' })
      }
    }
    this.ctx.service.app.upadteCateNum()
    this.ctx.service.app.upadteCateApps12()
    return {
      code: 200,
      data: resault
    }
  }
//添加222
  async createAppDong({ apps }) {
    for (let item of apps) {
      let app = await this.ctx.model.App.findOne({copyid:item.copyid})
      delete item.id;
      delete item.createdAt;
      delete item.updatedAt;
      let dacrs = {}
      for(let key in item){
        if(key!=='_id'&&key!=='updatedAt'&&key!=='createdAt'){
          dacrs[key] = item[key]
        }
      }
      dacrs.id = parseInt((Date.now()+'').slice(5) + Math.random().toString().slice(-6));
      dacrs.link = parseInt((Date.now()+'').slice(5) + Math.random().toString().slice(-6));

      if (!app) {
        await this.ctx.model.App.create(dacrs).then(() => {
          console.log('添加成功！')
        }).catch((res) => {
          console.log(res)
        })
      } else {
        console.log('APP重复1111111111')
      }
    }
    this.ctx.service.app.updateAppCacheList();
    return {
      code: 200,
      data: {message:'添加完成'}
    }
  }
  async getappjsondata(){
      let appList = []
      let cachePageFilePath = this.ctx.app.config.cacheFile + 'app_list'
      let appRdmNum = ['/index.json', '/index1.json', '/index2.json', '/index3.json', '/index4.json', '/index5.json', '/index6.json', '/index7.json', '/index8.json', '/index9.json']
      let appRdmName = appRdmNum[new Date().getSeconds()%appRdmNum.length]
      let appRdmName2 = appRdmNum[new Date().getMinutes()%appRdmNum.length]
      try {
        let rowstext = fs.readFileSync(cachePageFilePath + appRdmName, 'utf-8');
        let rowstext2 = fs.readFileSync(cachePageFilePath + appRdmName2, 'utf-8');
        if (rowstext&&rowstext2) {
          try {
            appList = [...JSON.parse(rowstext),...JSON.parse(rowstext2)]
          } catch {

          }
        }
      } catch (e) {
      }
      if (!appList || appList.length == 0) {
        this.ctx.service.app.updateAppCacheList();
        return []
      }
      return appList
  }
  async updateAppCacheList(){
    let appList = await this.ctx.model.App.find().sort({_id:-1}).limit(120).select('title time status themeColor sort image isProxy isH isN isT logo h5logo app h5 description keywords view createdAt');
    if(appList.length==0){
      return ''
    }
    const cacheDir = path.join(this.ctx.app.config.cacheFile, 'app_list');
    await fs.promises.mkdir(cacheDir, { recursive: true });
    const suffix = '.tmp-' + process.pid + '-' + crypto.randomBytes(6).toString('hex');
    const appRdmNum = ['index.json','index1.json','index2.json','index3.json','index4.json','index5.json','index6.json','index7.json','index8.json','index9.json'];
    for (let indexa = 0; indexa < appRdmNum.length; indexa++) {
      let rows = [];
      for(let i = indexa*12;i<indexa*12+12;i++){
        if(appList[i]&&typeof appList[i] == 'object'){
          rows.push(appList[i])
        }
      }
      const filename = path.join(cacheDir, appRdmNum[indexa]);
      const tempPath = filename + suffix;
      try {
        // 同目录原子替换，读取方始终看到完整 JSON，不先清空缓存目录。
        await fs.promises.writeFile(tempPath, JSON.stringify(rows), 'utf8');
        await replaceAppCacheFile(tempPath, filename);
      } finally {
        try {
          await fs.promises.unlink(tempPath);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
    }
  }
  async upadteCateApps12() {
    // 每个导航分类上挂12个导航
    // let uid = this.ctx.service.utils.getTokenInfo('id')
      // let apps = await this.ctx.model.App.find({ ncids: { '$in': item._id }, status: 1 }).limit(12).sort({ "isT": -1, "isH": -1, "sort": -1 }).select('_id')
      // if (apps && apps.length > 0) {
      //   let details = apps.map(item => item._id)
      //   await this.ctx.model.AppCategory.findOneAndUpdate({
      //     _id: item._id,
      //   }, { $set: { details } });
      //   // console.log('更新12个-'+item._id)
      // }
  }
  async upadteCateNum() {
    // 更新导航分类数量
    let categorys = await this.ctx.model.AppCategory.find({ siteType: { $in: [8,6] }, status: true });
    for (let item of categorys) {
      let num = await this.ctx.model.App.countDocuments({ ncids: { $in: item._id }, status: 1 }, async (err, c) => c)
      await this.ctx.model.AppCategory.findOneAndUpdate({
        _id: item._id,
      }, { $set: { num } });
    }
  }
  async findApp({ id }) {
    let app = await this.ctx.model.App.findById(id);
    // 查出10个相关
    let otherAppList = []
    let moreAppList = []
    if (app) {
      otherAppList = await this.ctx.model.App.find({ ncids: { $in: app.ncids } }).limit(22);//_id:{ "$lt": app._id },
      moreAppList = await this.ctx.model.App.find({ _id: { "$gt": app._id } }).limit(2);
    }
    // axios.post(this.ctx.app.config.dbAdminHttpUrlIP + '/api/viewAppAddOne', {
    //   id: app._id
    // });
    return {
      code: 200,
      data: app,
      otherAppList,
      moreAppList
    }
  }
  async viewAppAddOne({ id }) {
    await this.ctx.model.App.updateOne({ _id: id }, {
      $inc: {
        view: 1
      }
    })
    // 如果今天没有就存
    let dateNowS = new Date()
    let dataNowE = new Date(Date.now() - (24 * 3600000))
    let todayapp = await this.ctx.model.AppView.findOne({
      createdAt: { $gte: dataNowE, $lt: dateNowS }
    })
    if (!todayapp) {
      this.ctx.model.AppView.create({
        nid: id
      })
    }
    return { code: 200, message: '成功！' }
  }

  async updateApp(id, updates) {
    let message = { code: -2, message: '修改失败!' }
    // let uname = this.ctx.service.utils.getTokenInfo('username')
    // let uid = this.ctx.service.utils.getTokenInfo('id')
    let app = await this.ctx.model.App.findOneAndUpdate({
      _id: id
    }, { $set: updates }, { new: true });
    if (!app) return message
    this.ctx.service.app.upadteCateNum()
    this.ctx.service.app.upadteCateApps12()
    return { code: 200, data: app, message: "修改成功！" };
  }
  async apptitleget({ links }) {
    let result = []
    for (let item of links) {
      let resItem = {
        keywords: '',
        description: '',
        title: '',
        logos: [],
        link: item
      }
      if (item && item.indexOf('http') >= 0) {
        // 检测重复
        let res = await axios.get(item).catch(() => '')
        if (res) {
          let bodyc = res.data
          if (res.data.indexOf('gb2312') > 0) {
            bodyc = iconv.decode(res.data, "gb2312").toString();
          }
          var $detail = cheerio.load(bodyc, {
            decodeEntities: false
          });
          resItem.keywords = $detail("[name='keywords']").attr("content") || ''
          resItem.description = $detail("[name='description']").attr("content") || ''
          resItem.title = $detail('title').text() || ''
          resItem.logos = []
          $detail('link').each((index, itemc) => {
            let url = $detail(itemc).attr('href')
            if (url && !resItem.logos.includes(url)) {
              if (url.indexOf('.ico') >= 0 || url.indexOf('.png') >= 0 || url.indexOf('.jpg') >= 0) {
                if (url && url.indexOf('//') == -1) {
                  let afc = url.indexOf('/') == 0 ? '' : '/';
                  resItem.logos.push(item + afc + url)
                } else {
                  resItem.logos.push(url)
                }
              }
            }
          })
          if (resItem.logos.length == 0) {
            $detail('img').each((index, itemc) => {
              let url = $detail(itemc).attr('src')
              if (url && !resItem.logos.includes(url) && index < 10) {
                if (url.indexOf('//') >= 0 && (url.indexOf('.png') >= 0 || url.indexOf('.jpg') >= 0)) {
                  resItem.logos.push(url)
                }
              }
            })
          }
        }
        result.push(resItem)
      }
    }
    return {
      code: 200,
      data: result
    }
  }
  async delApp(apps) {
    let result = {
      success: [],
      filed: []
    }
    let uname = this.ctx.service.utils.getTokenInfo('username');
    let uid = this.ctx.service.utils.getTokenInfo('id');
    let app = {}
    for (let item of apps) {
      app = await this.ctx.model.App.findOneAndDelete({
        _id: item._id,
        uid,
        uname
      }).then((res) => {
        if (res) {
          result.success.push(item)
          delete app._id
          this.ctx.model.Appdel.create(app)
        } else {
          result.filed.push({
            link: item,
            message: '导航不存在！'
          })
        }
      }).catch(() => {
        result.filed.push({
          link: item,
          message: '无删除权限！'
        })
      });
    }
    return { code: 200, data: result };
  }
  //用户列表
  // async appCategoryList({ offset = 0, limit = 10, name, sTime, eTime }) {
  //   let criteria = {}
  //   let count = await this.ctx.model.AppCategory.countDocuments(criteria, (err, c) => c);
  //   let rows = await this.ctx.model.AppCategory.find(criteria).sort({ "_id": -1 }).skip(offset).lean()
  //   const ResponseData = {
  //     code: 200,
  //     data: {
  //       data: rows,
  //       count,
  //       limit,
  //       offset,
  //     },
  //   };
  //   return ResponseData;
  // }
  // 统计导航到分类数量
  async appCategoryNum() {

  }
  //用户添加
  async createAppCategory({ categorys }) {
    let uid = this.ctx.service.utils.getTokenInfo('id')
    let resault = {
      code: 200,
      data: {
        success: [],
        filed: []
      }
    }
    for (let item of categorys) {
      let { name, icon, oname, siteType, status, isHot, sort, image, themeColor, keywords, description } = item
      if (!name) {
        resault.data.filed.push({ name, message: '标题错误！' })
      }
      let max_id = await this.ctx.model.AppCategory.aggregate([{ $group: { _id: null, max_value: { $max: "$id" } } }]);
      if (!max_id || max_id.length == 0) max_id = [{ _id: null, max_value: 0 }];
      let app = await this.ctx.model.AppCategory.findOne({
        name,
        siteType
      })
      if (!app) {
        await this.ctx.model.AppCategory.create({
          name,
          oname,
          status,
          isHot,
          sort,
          icon,
          view: 0,
          num: 0,
          siteType,
          image,
          themeColor,
          keywords,
          description,
          uid,
          id: max_id[0].max_value + 1
        }).then(() => {
          resault.data.success.push({ name, message: '添加成功' })
        }).catch((res) => {
          resault.data.filed.push({ name, message: '名称重复1！' })
        })
        let articleCategoryList = await this.ctx.model.AppCategory.find({ siteType: 4, status: 1 }).skip(0).limit(60).select('name num id image')
        this.ctx.service.cache.set('articleCategoryList', articleCategoryList);
      } else {
        resault.data.filed.push({ name, message: '名称重复2！' })
      }
    }
    return {
      code: 200,
      data: resault
    }
  }

  async findAppCategory(id) {

  }
  async findAppCategoryName({ name, siteType }) {
    let app = await this.ctx.model.AppCategory.find({
      name,
      siteType
    })
    let haveCate = false
    if (app) {
      haveCate = true
    }
    return {
      code: 200,
      data: haveCate
    }
  }
  async updateAppCategory(id, updates) {
    let message = { code: -2, message: '修改失败!' }
    let uid = this.ctx.service.utils.getTokenInfo('id')
    let app = await this.ctx.model.AppCategory.findOneAndUpdate({
      _id: id,
      uid
    }, { $set: updates }, { new: true });
    if (!app) return message
    return { code: 200, data: app, message: "修改成功！" };
  }
  async appStarAndBadAdd() {
    const { ctx } = this;
    let type = ctx.query.type
    let id = ctx.query.id
    if (type == 'star') {
      await this.ctx.model.App.updateOne({
        _id: id
      }, {
        $inc: {
          star: 1
        }
      });
    } else {
      await this.ctx.model.App.updateOne({
        _id: id
      }, {
        $inc: {
          bad: 1
        }
      });
    }
    // 删除缓存
    let cachePageFilePath = this.ctx.app.config.cacheFile + 'app/';
    let filePath = cachePageFilePath + '/' + id + '.json';
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
    }
    return { code: 200, message: "成功！" };
  }
  async appStarAndBadAddRequest() {
    const { ctx } = this;
    let type = ctx.query.type
    let id = ctx.query.id
    if (!id && !id.match(/^[0-9a-fA-F]{24}$/)) {
      return {code:-1,message:'错误！'}
    }
    if (type == 'star') {
      await this.ctx.model.App.updateOne({
        _id: id
      }, {
        $inc: {
          star: 1
        }
      });
    } else {
      await this.ctx.model.App.updateOne({
        _id: id
      }, {
        $inc: {
          bad: 1
        }
      });
    }
    return {
      code: 200,
      message: '成功!'
    }
  }

 async getDataCenter(){
      let appdatalist = [];
      let articledatalist = [];
      await axios({
          method: 'post',
          url: `http://107.151.212.4:7001/api/getAppDataList`,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'curl/7.12.1'
          },
          data: {password:'123123'}
        }).then(res => {
          if (res && res.data&&res.data.data&&res.data.data.data) {
              appdatalist = this.ctx.service.utils.jiemiFn(res.data.data.data)
          }
          if(appdatalist&&appdatalist.length>0){
              //存app数据库
              this.ctx.service.app.createAppDong({apps:appdatalist})
          }
      }).catch(error => {})
      await axios({
              method: 'post',
              url: `http://107.151.212.4:7001/api/getArticleDataList`,
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'curl/7.12.1'
              },
              data: {password:'123123'}
            }).then(res => {
              if (res && res.data&&res.data.data&&res.data.data.data) {
                  articledatalist = this.ctx.service.utils.jiemiFn(res.data.data.data)
              }
              // console.log(articledatalist)
              if(articledatalist&&articledatalist.length>0){
                  //存app数据库
                  this.ctx.service.article.createArticleDong({apps:articledatalist})
              }
        }).catch(error => {})
        return {
          code:200,
          message: '获去数据成功！'
        }
  }
  async delAppCategory(apps) {
    let result = {
      success: [],
      filed: []
    }
    let uname = this.ctx.service.utils.getTokenInfo('username');
    let uid = this.ctx.service.utils.getTokenInfo('id');
    let app = {}
    for (let item of apps) {
      app = await this.ctx.model.App.findOneAndDelete({
        _id: item._id,
        uid,
        uname
      }).then((res) => {
        if (res) {
          result.success.push(item)
          delete app._id
          this.ctx.model.Appdel.create(app)
        } else {
          result.filed.push({
            link: item,
            message: '分类不存在！'
          })
        }
      }).catch(() => {
        result.filed.push({
          link: item,
          message: '无删除权限！'
        })
      });
    }
    return { code: 200, data: result };
  }
}

module.exports = App;
