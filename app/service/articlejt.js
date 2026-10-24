'use strict';
const Service = require('egg').Service;
var fs = require('fs');
var moment = require('moment')
moment.locale('zh-CN');
class Article extends Service {
  async getArticlejtList({
    limit = 50,
    pageType,
    pageTypeId,
    sTime,
    eTime,
    offset=0,
    password,
    isOpenUrl
  }){ 
    const criteria = {};
    if(isOpenUrl>=0){
      criteria.isOpenUrl = isOpenUrl
    }
    if (sTime && eTime) {
      criteria.createdAt = {
        $gte: new Date(sTime),
        $lt: new Date(eTime),
      }
    }
    let count = await this.ctx.model.Articlejt.countDocuments(criteria, (err, c) => c);
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

    let rows = null 
    if(password&&password=='123123'){
      rows = await this.ctx.model.Articlejt.find(criteria)
      .sort({ "_id": skipId })
      .skip(offset)
      .limit(limit).lean()
    }else{
      rows = await this.ctx.model.Articlejt.find(criteria)
      .sort({ "_id": skipId })
      .skip(offset)
      .limit(limit)
      .select(`title description numIndex keywords fromNum isOpenUrl createdAt updatedAt`).lean()
    }
    
  if (pageType == 'prve' || pageType == 'lastPage') {
    rows = rows.reverse()
  }
  let rowsc = this.ctx.service.utils.jiamiFn(rows);
  const ResponseData = {
    code: 200,
    data: {
      data: rowsc,
      count,
      limit,
      offset,
      notDomainCount:count
    },
  };
  return ResponseData;
  }
  // async getArticlejthtml(){  -------在autoarticle
  //  let numc = await this.ctx.service.articlejt.getJingTaiTodayNum()
  //  if(numc&&numc>0){
  //   //循环获取存入文件
  //   await axios({
  //               method: 'post',
  //               url: `http://107.151.212.4:7001/api/getAppDataList`,
  //               headers: {
  //                 'Content-Type': 'application/json',
  //                 'User-Agent': 'curl/7.12.1'
  //               },
  //               data: {password:'123123'}
  //             }).then(res => {
  //               if (res && res.data&&res.data.data&&res.data.data.data) {
  //                   appdatalist = this.ctx.service.utils.jiemiFn(res.data.data.data)
  //               }
  //               if(appdatalist&&appdatalist.length>0){
  //                   //存app数据库
  //                   this.ctx.service.app.createAppDong({apps:appdatalist})
  //               }
  //             }).catch(error => {})
  //  }
  // }
  async createArticlejtDong({ apps }) {
    for (let item of apps) {
      let article = await this.ctx.model.Articlejt.findOne({copyid:item.copyid,title:item.title})
      delete item._id;
      let dacrs = {}
      for(let key in item){
        if(key!=='_id'&&key!=='updatedAt'&&key!=='createdAt'&&key!=='uid'){
          dacrs[key] = item[key]
        }
      }
      dacrs.id = parseInt((Date.now() + '').slice(5) + Math.random().toString().slice(-6));
      if (!article) {
        await this.ctx.model.Articlejt.create(dacrs).then(() => {
          console.log('添加成功！')
        }).catch((res) => {
          console.log(res)
        })
      } else {
        console.log('文章重复2222222222')
      }
    }
    this.ctx.service.article.updateArticleCacheList();
    return {
      code: 200,
      data: {message:'添加完成'}
    }
  }
  
  async getJingTaiTodayNum(){
    //查询今日静态文件夹文件总数
    let numIndex = 0;
    const momentFile = moment().format('YYYYMMDD')
    let articleFilePath = process.cwd() + '/jingtai/'+momentFile
    try{
      let files = fs.readdirSync(articleFilePath);
      if (files.length > 0) {
        numIndex = files.length
      }   
    }catch{

    }
    return {
      code: 200,
      data: {numIndex}
    }
  }
  //文章列表
  async articlejtList() {
    let rows = await this.ctx.model.Articlejt.find({}).sort({ "_id": 1 }).skip(0).limit(50).select('tag articleCategory title image description createdAt view time').lean();
    const ResponseData = {
      code: 200,
      data: {
        data: rows,
        count: 1,
        limit: 2,
        offset: 0,
      },
    };
    return ResponseData;
  }
  async postArticlejt(id) {
    if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
      let article = await this.ctx.model.Articlejt.findById(id)
      if (!article) {
        return {};
      }
      if (article) {
        let rowsc = this.ctx.service.utils.jiamiFn({
          detail: article,
        });

       return {
          code: 200,
          data: rowsc
        };
      }
    } else {
      return {
        code: -2,
          message:'' 
      };
    }
  }
  async findArticlejt(id) {
    if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
      // let isSplider = false
      // let userAgent = this.ctx.request.header['user-agent'] || ''
      // userAgent = userAgent.toLocaleLowerCase()
      // if (userAgent && userAgent.indexOf('spider') > 0 || userAgent.indexOf('bot') > 0) {
      //   isSplider = true
      // }
      let article = await this.ctx.model.Articlejt.findById(id)
      if (!article) {
        return {};
      }
      if (article) {
        article.update({
          $inc: {
            view: 1
          }
        })
        this.ctx.model.Articlejt.updateOne({ _id: id }, {
          $inc: {
            view: 1
          }
        })
        // 查找下面的5篇文章
        let detail_list = await this.ctx.model.Articlejt.find({
          // cid: article.cid,
          _id: { "$lt": article._id }
        }).sort({ "_id": -1 }).skip(0).limit(5).select('tag articleCategory title image isTop tag description createdAt view time keywords id')
        return {
          code: 200,
          data: {
            detail: article,
            articleList: detail_list
          }
        };
      }
    } else {
      return {};
    }
  }
 
  //用户添加
  async createArticlejt(o) {
    // 验证是否重复
    // const max_id = await this.ctx.model.Articlejt.aggregate([{ "$group": { "_id": {}, "id_max": { "$max": "$id" } } }])
    // 先获取最大的 id isOpenUrl fromNum
    await this.ctx.model.Articlejt.create({ ...o,fromNum:0, id: parseInt((Date.now() + '').slice(5) + Math.random().toString().slice(-6)) })
    return {
      message: '创建成功！',
      code: 200
    }
  }
  
  async updateArticlejt(id, updates) {
    const article = await this.ctx.model.Articlejt.findById(id);
    if (!article) {
      return { code: -1, message: '找不到！' };
    }
    await article.update(updates);
    let cachePageFilePath = this.ctx.app.config.cacheFile + 'article/'
    try {
      fs.unlinkSync(cachePageFilePath + id + '.json')
    } catch (e) {
    }
    return { code: 200, message: '修改成功！' }
  }
  async delArticlejt(id){
      // 检测删除权限
      let uid = this.ctx.service.utils.getTokenInfo('id')
      let detailjt = await this.ctx.model.Articlejt.findByIdAndDelete({
        _id: id,
        uid,
      });
      return { code: 200, message: detailjt.numIndex + '-' + detailjt.title + "删除成功！" };
  }
}

module.exports = Article;


































