'use strict';
const Service = require('egg').Service;
var fs = require('fs');

class Article extends Service {
  async getArticleList({
    limit = 50,
    pageType,
    pageTypeId,
    sTime,
    eTime,
    offset=0,
    password,
    cid,
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
    if(cid){
      criteria.cid = cid
    }
    let count = await this.ctx.model.Article.countDocuments(criteria, (err, c) => c);
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
      rows = await this.ctx.model.Article.find(criteria)
      // .populate({ path: 'cid', select: 'name _id' })
      .sort({ "_id": skipId })
      .skip(offset)
      .limit(limit)
      .select(`title description articleCategory image keywords fromNum isOpenUrl time view createdAt updatedAt`).lean()
      .lean()
    }else{
      rows = await this.ctx.model.Article.find(criteria)
      // .populate({ path: 'cid', select: 'name _id' })
      .sort({ "_id": skipId })
      .skip(offset)
      .limit(limit)
      .select(`title description articleCategory image keywords fromNum isOpenUrl time view createdAt updatedAt`).lean()
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
  
  async createArticleDong({ apps }) {
    for (let item of apps) {
      let article = await this.ctx.model.Article.findOne({copyid:item.copyid,title:item.title})
      delete item._id;
      let dacrs = {}
      for(let key in item){
        if(key!=='_id'&&key!=='updatedAt'&&key!=='createdAt'&&key!=='uid'){
          dacrs[key] = item[key]
        }
      }
      dacrs.id = parseInt((Date.now() + '').slice(5) + Math.random().toString().slice(-6));
      if (!article) {
        await this.ctx.model.Article.create(dacrs).then(() => {
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
  async updateArticleCacheList() {
    let articleList = await this.ctx.model.Article.find().sort({_id:-1}).limit(120).select('title image cid description createdAt articleCategory time view');
    let siteMapArticleList = articleList||[]
    if(articleList.length==0){
      return ''
    }
    let cacheArticleList = []
    for(let ci=0;ci<12;ci++){
      cacheArticleList.push(articleList[ci])
    }
    await this.ctx.service.cache.set('articleList', cacheArticleList);
    await this.ctx.service.cache.set('siteMapArticleList', siteMapArticleList);
    // await this.ctx.service.article.updateArticleCategoryNum();
    let fileAricleListPath = this.ctx.app.config.cacheFile + 'article_list'
    let isFile = fs.existsSync(fileAricleListPath);
    if(!isFile){
      fs.mkdirSync(fileAricleListPath);
    }else{
      // 清空文件夹
      this.ctx.service.utils.delDir(fileAricleListPath,0);
    }
    let arcicle_list = this.ctx.app.config.cacheFile + 'article_list';
    let articleRdmNum = ['/index.json','/index1.json','/index2.json','/index3.json','/index4.json','/index5.json','/index6.json','/index7.json','/index8.json','/index9.json']
    articleRdmNum.forEach((itema,indexa)=>{
      let rows = [];
      for(let i = indexa*12;i<indexa*12+12;i++){
        if(articleList[i]&&typeof articleList[i] == 'object'){
          rows.push(articleList[i])
        }
      }
      fs.writeFile(arcicle_list+itema, JSON.stringify(rows), null, function (err) { });
    })
  }
  async updateArticleCategoryNum() {
    // 更新文章分类的数量
    let categorys = await this.ctx.model.ArticleCategory.find({ siteType: 4, status: true });
    for (let item of categorys) {
      let num = await this.ctx.model.Article.countDocuments({ cid: item._id , status: 1 }, async (err, c) => c)
      await this.ctx.model.ArticleCategory.findOneAndUpdate({
        _id: item._id,
      }, { $set: { num } });
    }
    let articleCategoryList = await this.ctx.model.ArticleCategory.find({ siteType: 4, status: 1 }).skip(0).limit(60).select('name num id image')
    this.ctx.service.cache.set('articleCategoryList', articleCategoryList);
  }
  //文章列表
  async articleList() {
    let rows = await this.ctx.model.Article.find({}).sort({ "_id": 1 }).skip(0).limit(50).select('tag articleCategory title image description createdAt view time').lean();
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
  //列表
  async articlehyList({
    offset = '',
    articleCategory = ''
  }) {
    const { ctx } = this.ctx
    const limit = 20;
    const criteria = {
      // status:1
    };
    if (offset && offset.match(/^[0-9a-fA-F]{24}$/)) {
      criteria['_id'] = { "$lt": offset }
    }
    if (articleCategory) {
      criteria['articleCategory'] = { $elemMatch: { $eq: articleCategory } }
    }
    // 小于
    let rows = await this.ctx.model.Articlehy.find(criteria).sort({ "_id": -1 }).limit(limit).select('tag articleCategory title image isTop tag description createdAt view time keywords id').lean()
    const ResponseData = {
      code: 200,
      data: {
        data: rows,
        limit,
        offset,
      },
    };
    return ResponseData;
  }
  async findArticle(id) {
    if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
      // let isSplider = false
      // let userAgent = this.ctx.request.header['user-agent'] || ''
      // userAgent = userAgent.toLocaleLowerCase()
      // if (userAgent && userAgent.indexOf('spider') > 0 || userAgent.indexOf('bot') > 0) {
      //   isSplider = true
      // }
      let article = await this.ctx.model.Article.findById(id)
      if (!article) {
        return {};
      }
      if (article) {
        article.update({
          $inc: {
            view: 1
          }
        })
        this.ctx.model.Article.updateOne({ _id: id }, {
          $inc: {
            view: 1
          }
        })
        // 查找下面的5篇文章
        let detail_list = await this.ctx.model.Article.find({
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
  async findhyArticle(id) {
    const article = await this.ctx.model.Articlehy.findById(id);
    if (article) {
      return { code: 200, data: article };
    } else {
      return ctx.render('/so.html');
    }
  }

  async articleIsRepeat({ title, copyid }) {
    const isExsitUserTitle = await this.ctx.model.Article.findOne({
      where: {
        title
      }
    });
    if (isExsitUserTitle) return { message: '标题已存在！', code: -2 };
    const isExsitUserCopyId = await this.ctx.model.Article.findOne({
      where: {
        copyid
      }
    });
    if (isExsitUserCopyId) return { message: 'copyid已存在！', code: -2 };
    return {
      code: 200
    }
  }
  //用户添加
  async createArticle(o) {
    // 验证是否重复
    // const max_id = await this.ctx.model.Article.aggregate([{ "$group": { "_id": {}, "id_max": { "$max": "$id" } } }])
    // 先获取最大的 id isOpenUrl fromNum
    await this.ctx.model.Article.create({ ...o,fromNum:0, id: parseInt((Date.now() + '').slice(5) + Math.random().toString().slice(-6)) })
    await this.ctx.service.article.updateArticleCacheList();
    return {
      message: '创建成功！',
      code: 200
    }
  }
  async createArticleCopy(o) {
    let isRepeat = await this.ctx.service.article.articleIsRepeat({
      title: o.title,
      copyid: o.copyid
    })
    if (isRepeat.code == 200) {
      await this.ctx.model.Article.create(o)
      return { code: 200, message: '添加成功！' }
    } else {
      return { code: -1, message: '文章重复！' }
    }
  }
  async updateArticle(id, updates) {
    const article = await this.ctx.model.Article.findById(id);
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
  // 文章分类
  async articleCategoryList({ offset = 0, limit = 30, siteType, sid, sids, status, _id, name, num, sTime, eTime, pageType, pageTypeId }) {
    let criteria = {}
    let countCriteria = {}
    if (siteType) {
      criteria.siteType = siteType
      countCriteria.siteType = siteType
    }
    if (name) {
      criteria.name = eval('/' + name + '/i');
      countCriteria.name = eval('/' + name + '/i');
    }
    // if(sid) criteria.sid = sid
    // if(sids && sids.length > 0) criteria.sid = { $in: sids }
    if (num) criteria.num = num
    if (_id) criteria._id = _id
    if (status !== null && status !== undefined) {
      criteria.status = status
      countCriteria.status = status
    }

    // let uid = this.ctx.service.utils.getTokenInfo('id')
    let skip = 0
    let skipId = -1
    if (pageType && pageTypeId) {
      if (pageType == 'next') {
        criteria['_id'] = { "$lt": pageTypeId }
      } else {
        criteria['_id'] = { "$gt": pageTypeId }
        // skip = limit
        skipId = 1
      }
    }
    // criteria.uid = uid
    let count = await this.ctx.model.ArticleCategory.countDocuments(countCriteria, (err, c) => c);
    let rows = await this.ctx.model.ArticleCategory.find(criteria).populate({ path: 'details', select: 'name' }).populate({ path: 'childrens', select: 'name' })
      .limit(limit).sort({ "_id": skipId }).skip(skip).lean()
    if (pageType == 'prve') {
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
      },
    };
    return ResponseData;
  }
  async delArticleCategory(id) {
    await this.ctx.model.ArticleCategory.findByIdAndDelete({
      _id: id
    });
    return {
      code: 200,
      message: '删除成功！'
    }
  }
  async updateArticleCategory(options) {
    const article = await this.ctx.model.ArticleCategory.findById(options.id);
    if (!article) {
      return { code: -1, message: '找不到！' };
    }
    await article.update(options.updates);
    // let cachePageFilePath = this.ctx.app.config.cacheFile + 'article/'
    // let isHaveArticleCache = fs.existsSync(cachePageFilePath + '/' + id + '.json')
    // if (isHaveArticleCache) {
    //   fs.unlinkSync(cachePageFilePath + id + '.json')
    // }
    return { code: 200, message: '修改成功！' }
   }
  async createArticleCategory(categorys) {
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
      let max_id = await this.ctx.model.ArticleCategory.aggregate([{ $group: { _id: null, max_value: { $max: "$id" } } }]);
      if (!max_id || max_id.length == 0) max_id = [{ _id: null, max_value: 0 }];
      let nav = await this.ctx.model.ArticleCategory.findOne({
        name
      })
      if (!nav) {
        await this.ctx.model.ArticleCategory.create({
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
        let articleCategoryList = await this.ctx.model.ArticleCategory.find({ siteType: 4, status: 1 }).skip(0).limit(60).select('name num id image')
        this.ctx.service.cache.set('articleCategoryList', articleCategoryList);
      } else {
        resault.data.filed.push({ name, message: '名称重复2！' })
      }
    }
    resault.data = this.ctx.service.utils.jiamiFn(resault.data);
    return {
      code: 200,
      data: resault
    }
  }
}

module.exports = Article;


































