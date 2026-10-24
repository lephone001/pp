"use strict";
const Service = require("egg").Service;
const axios = require('axios')
const cheerio = require("cheerio");
var iconv = require("iconv-lite"); //解码用的
iconv.skipDecodeWarning = true;
const fs = require('fs');
const path = require('path');
class Nav extends Service {
  async navList({ offset = 0, spage,sort={'_id':-1}, status, epage, limit = 50, title, ncids, sTime, eTime }) {
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
    let addabs = 0
    let skip = 0
    if (offset) {
      if (pageNum >= 0) {
        criteria['_id'] = { "$lt": offset } // 小于
        addabs = 1
        skip = pageNum == 0 ? 0 : ((Math.abs(pageNum) - 1) * limit)
      } else {
        criteria['_id'] = { "$gt": offset } // 大于
        addabs = 0
        skip = ((epage - 1) * limit) || 0
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
    let count = await this.ctx.model.Nav.countDocuments(criteria, (err, c) => c)
    let rows = await this.ctx.model.Nav.find(criteria).populate({ path: 'ncids', select: 'name' }).sort(criteriaSort).skip(skip).limit(limit).select('title content status ncids tags themeColor sort image isProxy isH isN isT logo h5logo app h5 description keywords view todayView link createdAt').lean()

    const ResponseData = {
      code: 200,
      data: {
        data: rows,
        count,
        limit,
        offset,
      },
    };
    return ResponseData;
  }

  // 导航首页使用的数据：只返回有有效导航的分类，每个分类最多挂 24 个导航。
  async getNavHomepageData() {
    const activeCategoryCriteria = {
      status: { $in: [1, true] },
    };

    const [categories, categoryCounts] = await Promise.all([
      this.ctx.model.NavCategory.find(activeCategoryCriteria)
        .sort({ isHot: -1, sort: -1, num: -1, _id: -1 })
        .lean(),
      this.ctx.model.Nav.aggregate([
        { $match: { status: 1, ncids: { $exists: true, $ne: [] } } },
        { $unwind: '$ncids' },
        { $group: { _id: '$ncids', count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = new Map(
      categoryCounts.map(item => [String(item._id), Number(item.count) || 0])
    );
    const homepageCategories = [];

    for (const category of categories) {
      const count = countMap.get(String(category._id)) || 0;
      if (!count) continue;

      const navList = await this.ctx.model.Nav.find({
        status: 1,
        ncids: category._id,
      })
        .sort({ isT: -1, isH: -1, sort: -1, _id: -1 })
        .limit(24)
        .select('title reltitle status view tags ncids isProxy isT isH isN sort image imageList link slink h5 app logo h5logo themeColor keywords description createdAt')
        .lean();

      if (!navList.length) continue;

      homepageCategories.push({
        ...category,
        num: count,
        navList,
      });

      if (homepageCategories.length >= 12) break;
    }

    return {
      navHomepageCategories: homepageCategories,
      updatedAt: Date.now(),
    };
  }

  // 后台点击“刷新导航”时，重建 Redis 数据并删除静态 HTML 缓存。
  async refreshNavHomepageCache() {
    const data = await this.getNavHomepageData();
    await this.ctx.service.cache.set('homepage', data);

    const homeCacheDir = path.join(
      this.app.config.cacheFile,
      'home'
    );

    // 导航首页缓存按域名分目录，刷新时清理所有域名的首页 HTML。
    const cacheFilePaths = [path.join(homeCacheDir, 'navhomepage.html')];
    try {
      const entries = await fs.promises.readdir(homeCacheDir, { withFileTypes: true });
      entries
        .filter(entry => entry.isDirectory())
        .forEach(entry => {
          cacheFilePaths.push(path.join(homeCacheDir, entry.name, 'navhomepage.html'));
        });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    await Promise.all(cacheFilePaths.map(async cacheFilePath => {
      try {
        await fs.promises.unlink(cacheFilePath);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }));

    return data;
  }

  async commonCreateNavRequest({
    title, image, imageList, link, h5, app, logo, keywords, description, addIP, uname, uid, isProxy
  }) {
    await this.ctx.model.Nav.create({
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
  async commonCreateNav() {
    let { code, title, keywords, imageList, link, h5, app, logo, description } = this.ctx.request.body
    if (!title || !link || link.indexOf('http') == -1) {
      return { code: -2, message: '标题、链接错误！' }
    }
    if (typeof keywords !== 'string' || typeof h5 !== 'string' || typeof app !== 'string' || typeof imageList !== 'object' || typeof description !== 'string' || typeof logo !== 'string') {
      return { code: -2, message: '分类错误！' }
    }
    if (title.length > 200 || imageList.length > 10 || logo.length > 100 || description.length > 180 || app.length > 100 || h5.length > 100 || link.length > 100) {
      return { code: -2, message: '格式错误！' }
    }
    if (this.ctx.session.navCode !== code) {
      return { code: -2, message: '验证码错误！' }
    }
    let nav = await this.ctx.model.Nav.findOne({ link })
    if (nav) return { code: -2, message: '导航已经被添加！' }
    let addIP = this.ctx.request.ip;
    // let count = await this.ctx.model.Nav.countDocuments({
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
    // 调用主数据库api commonCreateNavRequest
    await axios.post(this.ctx.app.config.dbAdminHttpUrlIP + '/api/commonCreateNavRequest', {
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
  _normalizeNavTags(tags) {
    let values = tags;
    if (!Array.isArray(values)) values = values ? String(values).split(/[,，|]/) : [];
    return [...new Set(values.map(item => {
      if (item && typeof item === 'object') return item.name || item.label || item.value || '';
      return String(item || '');
    }).map(item => item.trim()).filter(Boolean))].slice(0, 50);
  }

  async createNav({ navs }) {
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
    let cncids = []
    // console.log(navs)
    for (let item of navs) {
      let { title,country, status, reltitle, ncids, tags, isProxy, isT, content, isH, isN, sort, image, imageList, link, slink, h5, app, logo, h5logo, themeColor, keywords, description } = item
      if (!title || !link || !link.indexOf('.') == -1 || !link.indexOf(':') == -1) {
        resault.data.filed.push({ link, message: '标题链接错误！' })
      }
      let nav = await this.ctx.model.Nav.findOne({
        link
      })
      // console.log(nav)
      if (!nav) {
        await this.ctx.model.Nav.create({
          country,
          title, status, reltitle, ncids, tags: this._normalizeNavTags(tags), isT, content, isProxy, isH, isN, sort, image, imageList, link, slink, h5, app, logo, h5logo, themeColor, keywords, description, uname, uid,
          addIP: this.ctx.request.body.ip
        }).then(() => {
          resault.data.success.push({ link, title, message: '添加成功' })
          //把导航挂载到分类
        }).catch((res) => {
          resault.data.filed.push({ link, title, message: '链接重复！' })
        })
      } else {
        resault.data.filed.push({ link, title, message: '链接重复！' })
      }
      if(ncids&&ncids.length>0){
        ncids.forEach((itcem,index)=>{
          cncids.push(itcem)
        })
      }
    }
    cncids =  [...new Set(cncids)];
    this.ctx.service.nav.upadteNavCategoryNum(cncids)
    this.ctx.service.nav.upadteNavCategory24(cncids)
    return {
      code: 200,
      data: resault
    }
  }
  async upadteNavCategory24(ncids) {
    // 每个导航分类上挂12个导航
    // let uid = this.ctx.service.utils.getTokenInfo('id')
    if(ncids&&ncids.length>0){
      for(let itemid of  ncids){
        let navs = await this.ctx.model.Nav.find({ ncids: { '$in': itemid }, status: 1 }).limit(24).sort({ "isT": -1, "isH": -1, "sort": -1,"_id":-1 }).select('_id')
        if (navs && navs.length > 0) {
          let details = navs.map(item => item._id)
          await this.ctx.model.NavCategory.findOneAndUpdate({
            _id: itemid,status: true
          }, { $set: { details } });
        }
      }
    }

    // let categorys = await this.ctx.model.NavCategory.find({ status: true }).limit(100).sort({ "isT": -1, "isH": -1, "sort": -1,"_id":-1 }).select('_id');
    // for (let item of categorys) {
    //   let navs = await this.ctx.model.Nav.find({ ncids: { '$in': item._id }, status: 1 }).limit(24).sort({ "isT": -1, "isH": -1, "sort": -1,"_id":-1 }).select('_id')
    //   if (navs && navs.length > 0) {
    //     let details = navs.map(item => item._id)
    //     await this.ctx.model.NavCategory.findOneAndUpdate({
    //       _id: item._id,
    //     }, { $set: { details } });
    //     // console.log('更新12个-'+item._id)
    //   }
    // }
  }
  async upadteNavCategoryNum(ncids) {

    // 更新导航分类数量
    if(ncids&&ncids.length>0){
      for(let itemid of  ncids){
        let num = await this.ctx.model.Nav.countDocuments({ ncids: { $in: itemid }, status: 1 }, async (err, c) => c)
        await this.ctx.model.NavCategory.findOneAndUpdate({
          _id: itemid,
          status: true
        }, { $set: { num } });
      }
    }

    // let categorys = await this.ctx.model.NavCategory.find({ status: true });
    // for (let item of categorys) {
    //   let num = await this.ctx.model.Nav.countDocuments({ ncids: { $in: item._id }, status: 1 }, async (err, c) => c)
    //   await this.ctx.model.NavCategory.findOneAndUpdate({
    //     _id: item._id,
    //   }, { $set: { num } });
    // }
  }
  async upadteNavCategoryAllNum(ncids) {
    let categorys = await this.ctx.model.NavCategory.find({ status: true });
    for (let item of categorys) {
      let num = await this.ctx.model.Nav.countDocuments({ ncids: { $in: item._id }, status: 1 }, async (err, c) => c)
      await this.ctx.model.NavCategory.findOneAndUpdate({
        _id: item._id,
      }, { $set: { num } });
    }
  }

  async upadteCateNavs12() {
    // 每个导航分类上挂12个导航
    // let uid = this.ctx.service.utils.getTokenInfo('id')
    let categorys = await this.ctx.model.ArticleCategory.find({  siteType: { $in: [8,6] },status: true }).select('_id');
    for (let item of categorys) {
      let navs = await this.ctx.model.Nav.find({ ncids: { '$in': item._id }, status: 1 }).limit(12).sort({ "isT": -1, "isH": -1, "sort": -1 }).select('_id')
      if (navs && navs.length > 0) {
        let details = navs.map(item => item._id)
        await this.ctx.model.ArticleCategory.findOneAndUpdate({
          _id: item._id,
        }, { $set: { details } });
        // console.log('更新12个-'+item._id)
      }
    }
  }
  async upadteCateNum() {
    // 更新导航分类数量
    let categorys = await this.ctx.model.ArticleCategory.find({ siteType: { $in: [8,6] }, status: true });
    for (let item of categorys) {
      let num = await this.ctx.model.Nav.countDocuments({ ncids: { $in: item._id }, status: 1 }, async (err, c) => c)
      await this.ctx.model.ArticleCategory.findOneAndUpdate({
        _id: item._id,
      }, { $set: { num } });
    }
  }
  async findNav({ id }) {
    let nav = await this.ctx.model.Nav.findById(id).populate({ path: 'ncids', select: 'name' });
    // 查出10个相关
    let otherNavList = []
    let moreNavList = []
    if (nav) {
      otherNavList = await this.ctx.model.Nav.find({ ncids: { $in: nav.ncids } }).limit(22);//_id:{ "$lt": nav._id },
      moreNavList = await this.ctx.model.Nav.find({ _id: { "$gt": nav._id } }).limit(2);
    }
    // axios.post(this.ctx.app.config.dbAdminHttpUrlIP + '/api/viewNavAddOne', {
    //   id: nav._id
    // });
    return {
      code: 200,
      data: nav,
      otherNavList,
      moreNavList
    }
  }
  async viewNavAddOne({ id }) {
    // await this.ctx.model.Nav.updateOne({ _id: id }, {
    //   $inc: {
    //     view: 1
    //   }
    // })
    // 如果今天没有就存
    let dateNowS = new Date()
    let dataNowE = new Date(Date.now() - (24 * 3600000))
    let todaynav = await this.ctx.model.NavView.findOne({
      createdAt: { $gte: dataNowE, $lt: dateNowS }
    })
    if (!todaynav) {
      this.ctx.model.NavView.create({
        nid: id
      })
    }
    return { code: 200, message: '成功！' }
  }

  async updateNav(id, updates) {
    let message = { code: -2, message: '修改失败!' }
    // let uname = this.ctx.service.utils.getTokenInfo('username')
    // let uid = this.ctx.service.utils.getTokenInfo('id')
    let nav = await this.ctx.model.Nav.findOneAndUpdate({
      _id: id
    }, { $set: updates }, { new: true });
    if (!nav) return message
    this.ctx.service.nav.upadteCateNum()
    this.ctx.service.nav.upadteCateNavs12()
    return { code: 200, data: nav, message: "修改成功！" };
  }
  async navtitleget({ links }) {
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

  // Navigation collection is intentionally separate from video collection.
  // Crawled links are stored as review items first and are only copied to nav_link after confirmation.
  async navCollectPreview({ url, maxItems = 5000 }) {
    const sourceUrl = String(url || '').trim();
    let parsedUrl;
    try {
      parsedUrl = new URL(sourceUrl);
    } catch (e) {
      return { code: -1, message: '请输入正确的网址（必须包含 http:// 或 https://）' };
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { code: -1, message: '只支持 http 和 https 地址' };
    }

    const uid = this.ctx.service.utils.getTokenInfo('id');
    const uname = this.ctx.service.utils.getTokenInfo('username');
    let response;
    try {
      response = await axios.get(sourceUrl, {
        timeout: 30000,
        responseType: 'arraybuffer',
        maxContentLength: 8 * 1024 * 1024,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NavigationCollector/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
    } catch (e) {
      return { code: -1, message: `远程页面获取失败：${e.message || '请求失败'}` };
    }

    const contentType = (response.headers && response.headers['content-type']) || '';
    const rawBody = Buffer.isBuffer(response.data) ? response.data : Buffer.from(String(response.data || ''));
    const charsetMatch = contentType.match(/charset\s*=\s*['"]?([^\s;'"]+)/i);
    const bodySample = rawBody.slice(0, 4096).toString('latin1');
    const charset = charsetMatch && charsetMatch[1]
      ? charsetMatch[1]
      : (bodySample.match(/charset\s*=\s*["']?\s*(gb2312|gbk|gb18030)/i) || [])[1];
    const body = /gb2312|gbk|gb18030/i.test(charset || '')
      ? iconv.decode(rawBody, 'gb18030').toString()
      : rawBody.toString('utf8');
    const $ = cheerio.load(body, { decodeEntities: false });
    const pageTitle = ($('title').first().text() || '').replace(/\s+/g, ' ').trim();
    const itemLimit = Math.max(1, Math.min(Number(maxItems) || 5000, 5000));
    const links = [];
    const linkSet = new Set();

    $('a[href]').each((index, element) => {
      if (links.length >= itemLimit) return false;
      const href = ($(element).attr('href') || '').trim();
      if (!href || /^(javascript:|mailto:|tel:|#)/i.test(href)) return;
      let absoluteLink;
      try {
        const linkUrl = new URL(href, sourceUrl);
        if (!['http:', 'https:'].includes(linkUrl.protocol)) return;
        linkUrl.hash = '';
        absoluteLink = linkUrl.toString();
      } catch (e) {
        return;
      }
      if (linkSet.has(absoluteLink)) return;
      linkSet.add(absoluteLink);
      const anchorText = ($(element).text() || '').replace(/\s+/g, ' ').trim();
      const title = anchorText || ($(element).attr('title') || '').trim()
        || ($(element).find('img').attr('alt') || '').trim() || absoluteLink;
      links.push({
        sourceUrl,
        link: absoluteLink,
        title,
        // The requested default is the visible anchor text as both title and keywords.
        keywords: anchorText || title,
        tags: [],
        selected: true,
        status: 1,
      });
    });

    const task = await this.ctx.model.NavCollectTask.create({
      sourceUrl,
      pageTitle,
      itemCount: links.length,
      uid,
      uname,
    });
    let items = [];
    if (links.length > 0) {
      items = await this.ctx.model.NavCollectItem.insertMany(
        links.map(item => ({ ...item, taskId: task._id })),
        { ordered: false }
      );
    }
    return {
      code: 200,
      data: {
        task: task.toObject(),
        items,
        truncated: links.length >= itemLimit,
      },
    };
  }

  async _navCollectTask(taskId) {
    const uid = this.ctx.service.utils.getTokenInfo('id');
    if (!taskId || !uid) return null;
    return this.ctx.model.NavCollectTask.findOne({ _id: taskId, uid });
  }

  async _refreshNavCollectTask(taskId) {
    const [itemCount, savedCount, failedCount, deletedCount] = await Promise.all([
      this.ctx.model.NavCollectItem.countDocuments({ taskId, status: { $ne: 0 } }),
      this.ctx.model.NavCollectItem.countDocuments({ taskId, status: 2 }),
      this.ctx.model.NavCollectItem.countDocuments({ taskId, status: 3 }),
      this.ctx.model.NavCollectItem.countDocuments({ taskId, status: 0 }),
    ]);
    return this.ctx.model.NavCollectTask.findByIdAndUpdate(taskId, {
      $set: { itemCount, savedCount, failedCount, deletedCount },
    }, { new: true }).lean();
  }

  async navCollectItems({ taskId }) {
    const task = await this._navCollectTask(taskId);
    if (!task) return { code: -1, message: '采集任务不存在或已失效' };
    const items = await this.ctx.model.NavCollectItem.find({ taskId, status: { $ne: 0 } })
      .sort({ createdAt: 1, _id: 1 }).lean();
    return { code: 200, data: { task, items } };
  }

  async navCollectDelete({ taskId, itemIds = [], all = false }) {
    const task = await this._navCollectTask(taskId);
    if (!task) return { code: -1, message: '采集任务不存在或已失效' };
    const criteria = { taskId, status: { $ne: 0 } };
    if (!all) {
      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return { code: -1, message: '请选择要删除的链接' };
      }
      criteria._id = { $in: itemIds };
    }
    const result = await this.ctx.model.NavCollectItem.updateMany(criteria, {
      $set: { status: 0, selected: false },
    });
    const updatedTask = await this._refreshNavCollectTask(taskId);
    return { code: 200, data: { deletedCount: result.modifiedCount || result.nModified || 0, task: updatedTask } };
  }

  async navCollectSave({ taskId, itemIds = [], items = [], categoryId }) {
    const task = await this._navCollectTask(taskId);
    if (!task) return { code: -1, message: '采集任务不存在或已失效' };
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return { code: -1, message: '请选择要入库的链接' };
    }

    const categoryMap = new Map();
    const itemMap = new Map();
    if (Array.isArray(items)) {
      items.forEach(item => {
        if (item && item.id) {
          itemMap.set(String(item.id), item);
          if (item.categoryId) categoryMap.set(String(item.id), item.categoryId);
        }
      });
    }
    const rows = await this.ctx.model.NavCollectItem.find({
      taskId,
      _id: { $in: itemIds },
      status: { $in: [1, 3] },
    }).lean();
    const categoryIds = rows.map(row => categoryMap.get(String(row._id)) || row.categoryId || categoryId)
      .filter(Boolean).map(String);
    const validCategoryIds = [...new Set(categoryIds)].filter(id => this.ctx.app.mongoose.Types.ObjectId.isValid(id));
    const categories = await this.ctx.model.NavCategory.find({
      _id: { $in: validCategoryIds },
      status: { $ne: 0 },
    }).select('_id').lean();
    const validSet = new Set(categories.map(item => String(item._id)));
    const navs = [];
    const invalidItems = [];
    rows.forEach(row => {
      const draft = itemMap.get(String(row._id)) || {};
      const currentCategoryId = categoryMap.get(String(row._id)) || row.categoryId || categoryId;
      if (!currentCategoryId || !validSet.has(String(currentCategoryId))) {
        invalidItems.push({ id: row._id, link: row.link, title: row.title, message: '请先为链接绑定有效分类' });
        return;
      }
      navs.push({
        title: String(draft.title || row.title || '').trim(),
        reltitle: String(draft.title || row.title || '').trim(),
        keywords: String(draft.keywords || row.keywords || draft.title || row.title || '').trim(),
        tags: this._normalizeNavTags(draft.tags || row.tags),
        link: row.link,
        slink: row.link,
        ncids: [currentCategoryId],
        status: 1,
        sort: 0,
        isProxy: false,
        isT: false,
        isH: false,
        isN: false,
        image: '',
        imageList: [],
        h5: '',
        app: '',
        logo: '',
        h5logo: '',
        themeColor: '',
        description: '',
        content: '',
      });
    });
    if (navs.length === 0) {
      return { code: -1, message: '没有可入库的链接，请检查分类绑定', data: { success: [], failed: invalidItems } };
    }

    const result = await this.createNav({ navs });
    const createResult = result.data || { success: [], filed: [] };
    const successLinks = new Set((createResult.success || []).map(item => String(item.link)));
    const failureByLink = new Map((createResult.filed || []).map(item => [String(item.link), item.message || '入库失败']));
    const bulkOperations = [];
    rows.forEach(row => {
      const currentCategoryId = categoryMap.get(String(row._id)) || row.categoryId || categoryId;
      if (!currentCategoryId || !validSet.has(String(currentCategoryId))) {
        bulkOperations.push({ updateOne: { filter: { _id: row._id }, update: { $set: { status: 3, errorMessage: '请先为链接绑定有效分类' } } } });
        return;
      }
      if (successLinks.has(String(row.link))) {
        bulkOperations.push({ updateOne: { filter: { _id: row._id }, update: { $set: { status: 2, categoryId: currentCategoryId, errorMessage: '' } } } });
      } else {
        bulkOperations.push({ updateOne: { filter: { _id: row._id }, update: { $set: { status: 3, categoryId: currentCategoryId, errorMessage: failureByLink.get(String(row.link)) || '入库失败' } } } });
      }
    });
    if (bulkOperations.length > 0) await this.ctx.model.NavCollectItem.bulkWrite(bulkOperations);
    const updatedTask = await this._refreshNavCollectTask(taskId);
    return {
      code: 200,
      data: {
        success: createResult.success || [],
        failed: [...invalidItems, ...(createResult.filed || [])],
        task: updatedTask,
      },
    };
  }

  async delNav(navs) {
    let result = {
      success: [],
      filed: []
    }
    let uname = this.ctx.service.utils.getTokenInfo('username');
    let uid = this.ctx.service.utils.getTokenInfo('id');
    let nav = {}
    for (let item of navs) {
      nav = await this.ctx.model.Nav.findOneAndDelete({
        _id: item._id,
        uid,
        uname
      }).then((res) => {
        if (res) {
          result.success.push(item)
          delete nav._id
          this.ctx.model.Navdel.create(nav)
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
  // async navCategoryList({ offset = 0, limit = 10, name, sTime, eTime }) {
  //   let criteria = {}
  //   let count = await this.ctx.model.ArticleCategory.countDocuments(criteria, (err, c) => c);
  //   let rows = await this.ctx.model.ArticleCategory.find(criteria).sort({ "_id": -1 }).skip(offset).lean()
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
  async navCategoryNum() {

  }
  //用户添加
  async createNavCategory(categorys) {
    let uid = this.ctx.service.utils.getTokenInfo('id')
    let resault = {
      code: 200,
      data: {
        success: [],
        filed: []
      }
    }
    for (let item of categorys) {
      let { name, icon, oname, siteType, status, isHot, sort, image, themeColor, keywords, description, parentId, level, tags } = item
      if (!name) {
        resault.data.filed.push({ name, message: '标题错误！' })
      }
      let max_id = await this.ctx.model.NavCategory.aggregate([{ $group: { _id: null, max_value: { $max: "$id" } } }]);
      if (!max_id || max_id.length == 0) max_id = [{ _id: null, max_value: 0 }];
      let nav = await this.ctx.model.NavCategory.findOne({
        name
      })
      if (!nav) {
        let parent = null
        if (parentId && this.ctx.app.mongoose.Types.ObjectId.isValid(String(parentId))) {
          parent = await this.ctx.model.NavCategory.findById(parentId).select('_id level')
        }
        await this.ctx.model.NavCategory.create({
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
          tags: this._normalizeNavTags(tags),
          uid,
          parentId: parent ? parent._id : null,
          level: parent ? (Number(parent.level) || 0) + 1 : (Number(level) || 0),
          id: max_id[0].max_value + 1
        }).then(() => {
          resault.data.success.push({ name, message: '添加成功' })
        }).catch((res) => {
          resault.data.filed.push({ name, message: '名称重复1！' })
        })
        let navCategoryList = await this.ctx.model.NavCategory.find({ siteType: 4, status: 1 }).skip(0).limit(60).select('name num id image')
        this.ctx.service.cache.set('navCategoryList', navCategoryList);
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

 //分类
 async navCategoryList({ offset = 0, limit = 30, siteType, sid, sids, status, _id, name, num, sTime, eTime, pageType, pageTypeId }) {
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
  if (num) {
    criteria.num = num
    countCriteria.num = num
  }
  if (_id) criteria._id = _id
  if (status !== null && status !== undefined) {
    criteria.status = status
    countCriteria.status = status
  }

  // let uid = this.ctx.service.utils.getTokenInfo('id')
  // let skip = 0
  // let skipId = -1
  // if (pageType && pageTypeId) {
  //   if (pageType == 'next') {
  //     criteria['_id'] = { "$lt": pageTypeId }
  //   } else {
  //     criteria['_id'] = { "$gt": pageTypeId }
  //     // skip = limit
  //     skipId = 1
  //   }
  // }

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


  // criteria.uid = uid
  let count = await this.ctx.model.NavCategory.countDocuments(countCriteria, (err, c) => c);
  let rows = await this.ctx.model.NavCategory.find(criteria).populate({ path: 'details', select: 'link title logo' }).populate({ path: 'childrens', select: 'name' })
    .limit(limit).sort({ "_id": skipId }).skip(offset).lean()
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
    },
  };
  return ResponseData;
}
//-----------------------------------------------------------------------首页获取左侧导航分类列表
  async getNavCagegoryNavList(navcids){
    const { ctx } = this;
    //先从缓存里面获取
    let ncidsList = []
    let isHomeFile = false;//是否从域名目录获取
    let { domain } = await ctx.service.utils.getSiteInfo();
    let domainFileName = '/';
    let fileTypeName = 'navcate'
    // console.log(navcids)
    let optionss = {  status: 1 , num: { $gt: 0 }}
    if(navcids&&navcids.length>0){
      optionss['_id']={ $in: navcids }
      isHomeFile = true;
      fileTypeName = 'home'
      domainFileName = domain.link.replace(':', '##')+'/'
    }
    let navcateFilePath = this.ctx.app.config.cacheFile + fileTypeName + domainFileName+'navcategory.json'
    let isHaveNavcateFile = fs.existsSync(navcateFilePath)
    if(isHaveNavcateFile){
      let sdf = fs.readFileSync(navcateFilePath, 'utf-8')
      try{
        ncidsList = JSON.parse(sdf)
      }catch{

      }
    }
    if(!ncidsList||ncidsList.length==0){
      ncidsList = await this.ctx.model.NavCategory.find(optionss).sort({ 'isHot': -1, 'sort': -1, 'num': -1 }).limit(64)
      .populate({ path: 'details',options: { limit: 24 }, select: 'title themeColor description view link isN logo h5logo h5 app isH isT' })
      .populate({ path: 'childrens', select: 'name',options: { limit: 12 } })
      if(ncidsList&&ncidsList.length>0){
      //存入缓存
        fs.writeFile(navcateFilePath, JSON.stringify(ncidsList), null, function (err) { });
      }
    }


    return ncidsList
  }
  async findNavCategory() {
   
  }
  async updateNavCategory(options) {
    const navCategory = await this.ctx.model.NavCategory.findById(options.id);
    if (!navCategory) {
      return { code: -1, message: '找不到！' };
    }
    const oldParentId = navCategory.parentId ? String(navCategory.parentId) : '';
    const updates = { ...options.updates };
    if (Object.prototype.hasOwnProperty.call(updates, 'parentId')) {
      let parent = null;
      if (updates.parentId && String(updates.parentId) !== String(navCategory._id) && this.ctx.app.mongoose.Types.ObjectId.isValid(String(updates.parentId))) {
        parent = await this.ctx.model.NavCategory.findById(updates.parentId).select('_id level');
      }
      updates.parentId = parent ? parent._id : null;
      updates.level = parent ? (Number(parent.level) || 0) + 1 : 0;
    }
    await navCategory.update(updates);
    const newParentId = updates.parentId !== undefined
      ? (updates.parentId ? String(updates.parentId) : '')
      : oldParentId;
    if (oldParentId && oldParentId !== newParentId) {
      await this.ctx.model.NavCategory.findByIdAndUpdate(oldParentId, { $pull: { childrens: navCategory._id } });
    }
    if (newParentId && oldParentId !== newParentId) {
      await this.ctx.model.NavCategory.findByIdAndUpdate(newParentId, { $addToSet: { childrens: navCategory._id } });
    }
    return { code: 200, message: '修改成功！' }
  }
  async delNavCategory(id) {
    await this.ctx.model.NavCategory.findByIdAndDelete({
      _id: id
    });
    return {
      code: 200,
      message: '删除成功！'
    }
  }


  async findNavCategoryName({ name, siteType }) {
    let nav = await this.ctx.model.NavCategory.find({
      name,
      siteType
    })
    let haveCate = false
    if (nav) {
      haveCate = true
    }
    return {
      code: 200,
      data: haveCate
    }
  }
  // async updateNavCategory(id, updates) {
  //   let message = { code: -2, message: '修改失败!' }
  //   let uid = this.ctx.service.utils.getTokenInfo('id')
  //   let nav = await this.ctx.model.NavCategory.findOneAndUpdate({
  //     _id: id,
  //     uid
  //   }, { $set: updates }, { new: true });
  //   if (!nav) return message
  //   return { code: 200, data: nav, message: "修改成功！" };
  // }
  async navStarAndBadAdd() {
    const { ctx } = this;
    let type = ctx.query.type
    let id = ctx.query.id
    if (type == 'star') {
      await this.ctx.model.Nav.updateOne({
        _id: id
      }, {
        $inc: {
          star: 1
        }
      });
    } else {
      await this.ctx.model.Nav.updateOne({
        _id: id
      }, {
        $inc: {
          bad: 1
        }
      });
    }
    // 删除缓存
    let cachePageFilePath = this.ctx.app.config.cacheFile + 'nav/';
    let filePath = cachePageFilePath + '/' + id + '.json';
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
    }
    return { code: 200, message: "成功！" };
  }
  async navStarAndBadAddRequest() {
    const { ctx } = this;
    let type = ctx.query.type
    let id = ctx.query.id
    if (!id && !id.match(/^[0-9a-fA-F]{24}$/)) {
      return {code:-1,message:'错误！'}
    }
    if (type == 'star') {
      await this.ctx.model.Nav.updateOne({
        _id: id
      }, {
        $inc: {
          star: 1
        }
      });
    } else {
      await this.ctx.model.Nav.updateOne({
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
  // async delNavCategory(navs) {
  //   let result = {
  //     success: [],
  //     filed: []
  //   }
  //   let uname = this.ctx.service.utils.getTokenInfo('username');
  //   let uid = this.ctx.service.utils.getTokenInfo('id');
  //   let nav = {}
  //   for (let item of navs) {
  //     nav = await this.ctx.model.Nav.findOneAndDelete({
  //       _id: item._id,
  //       uid,
  //       uname
  //     }).then((res) => {
  //       if (res) {
  //         result.success.push(item)
  //         delete nav._id
  //         this.ctx.model.Navdel.create(nav)
  //       } else {
  //         result.filed.push({
  //           link: item,
  //           message: '分类不存在！'
  //         })
  //       }
  //     }).catch(() => {
  //       result.filed.push({
  //         link: item,
  //         message: '无删除权限！'
  //       })
  //     });
  //   }
  //   return { code: 200, data: result };
  // }
}

module.exports = Nav;
