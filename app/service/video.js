"use strict";
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Service = require("egg").Service;
var moment = require('moment')
moment.locale('zh-CN');
const message = {
  c404: {
    code: 404,
    message: "找不到该内容！",
  },
};

const emptyStringCondition = field => ({
  $or: [
    { [field]: { $exists: false } },
    { [field]: null },
    { [field]: '' },
    { [field]: /^\s*$/ },
  ],
});

const emptyArrayCondition = field => ({
  $or: [
    { [field]: { $exists: false } },
    { [field]: null },
    { [field]: { $size: 0 } },
  ],
});

class Video extends Service {
  async videoPiCreate(videoList) {
    let indexcc = 0
    for (let item of videoList) {
      if (item.title && item.cid) {
        let isHave = await this.ctx.model.Video.findOne({
          title: item.title,
          cid: item.cid,
        }).select('_id')
        if (!isHave) {
          await this.ctx.model.Video.create({
            copyid: 'COPYID',
            title: item.title, //标题,
            keywords: item.keywords,
            description: item.description,
            content: moment().format('YYYY-MM-DD HH:mm:ss')+item.title+item.description,
            image: '/images/article/mn2/1.jpg',
            video: '/images/article/mn2/2.jpg',
            tag: item.cname,
            view: Number(Date.now().toString().slice(8)),
            time: moment().format('YYYY-MM-DD HH:mm:ss'),
            star: 100,
            bad: 0,
            viewUrl: "",
            videoTime: '',
            pid:'',
            cid: item.cid,
            status: 1,
            isHot: 0
          })
          indexcc++
        }
      }
    }
    this.ctx.service.video.videoUpdateAll().catch(error => {
      this.ctx.logger.error('[video] refresh after import failed: %s', error && error.stack || error);
    });
  }
  async refushVideoCategory(){
        await this.ctx.service.cache.del('video-category-all')
        let categorys = await this.ctx.model.VideoCategory.find({ status: 1,num:{$gt:0} }).sort({ updatedAt: -1 }).limit(40);
        await this.ctx.service.cache.set('video-category-all', categorys);
  }
  // async updateVideoCategoryNum(){
  //   let categorys = await this.ctx.model.VideoCategory.find();
  //   for(let item of categorys){

  //   }
  // }
  async videoUpdateAll() {
     // 删除视频下的分类缓存
    const videoListDir = path.join(this.ctx.app.config.cacheFile, 'video_list');
    await fs.promises.mkdir(videoListDir, { recursive: true });
    this.ctx.service.utils.delDir(videoListDir, 0);

    await this.ctx.service.video.updateVideoCacheList();
    await this.ctx.service.video.setTodayCountVideo();
    await this.ctx.service.cache.del('video-category-all')
    //更新视频分类到redis
    let categorys = await this.ctx.model.VideoCategory.find({ status: 1 }).sort();
    for (let item of categorys) {
      const [videoNum, bookNum, imageNum] = await Promise.all([
        this.ctx.model.Video.countDocuments({ cid: item._id, status: { $ne: 0 } }),
        this.ctx.model.VideoBook.countDocuments({ categoryId: item._id, status: { $ne: 0 } }),
        this.ctx.model.VideoImage.countDocuments({ categoryId: item._id, status: { $ne: 0 } }),
      ]);
      let num = videoNum + bookNum + imageNum;
      await this.ctx.model.VideoCategory.findOneAndUpdate({
        _id: item._id,
      }, { $set: { num } });
      item.num = num;
    }
    categorys = categorys.filter(item => item.num > 0)
    await this.ctx.service.cache.set('video-category-all', categorys);
    await this.ctx.service.counters.set('Video');
    setTimeout(async ()=>{
      try {
        //查询所有的视频站点更新首页
        let allDomainList = await this.ctx.model.Domain.find({
          siteType:6
        });
        if(allDomainList&&allDomainList.length>0){
          for(let item of allDomainList){
            let linkc = item.link;
            let domainFileNamec = linkc.replace(':', '##')
            let homePageFilePathc = this.ctx.app.config.cacheFile + 'home/' + domainFileNamec
            let isHaveHomeFilec = fs.existsSync(homePageFilePathc)
            if (isHaveHomeFilec) {
              this.ctx.service.utils.delDir(homePageFilePathc,1)
            }
          }
        }
      } catch (error) {
        this.ctx.logger.error('[video] homepage cache cleanup failed: %s', error && error.stack || error);
      }
    },2000)
    return ''
  }
  // 统计今日视频小说图片
  async setTodayCountVideo() {
    const dateNow = Date.now();
    let start = new Date(Date.now()-1000*60*60*24);
    let end = new Date(dateNow);
    let options = { createdAt: { $gte: start, $lt: end } }
    let counts = {
      videoCount: 0,
      huahuaCount: 0,
      imageCount: 0,
      booksCount: 0,
    }
    let values = await Promise.all([
      this.ctx.model.Video.countDocuments(options, (err, c) => c),
      this.ctx.model.VideoImage.countDocuments(options),
      this.ctx.model.VideoBook.countDocuments(options),
    ])
    counts.videoCount = values[0]
    counts.imageCount = values[1]
    counts.booksCount = values[2]
    await this.ctx.service.cache.set('VideoCounts', counts);
  }
  async getTodayCountVideo() {
    let counts = {
      videoCount: 0,
      huahuaCount: 0,
      imageCount: 0,
      booksCount: 0,
    }
    let arrays = await this.ctx.service.cache.get('VideoCounts');
    if (arrays) {
      counts = arrays
    } else {
      this.ctx.service.video.setTodayCountVideo()
    }
    return counts;
  }
  //视频列表
  async videoList({ pid, cid, nowPage, spage, epage, offset, title, limit = 40 }) {
    // 分页代码部分开始
    let criteria = {
      status: 1,
    }
    if (pid) criteria.pid = pid;
    if (title && title.length < 180) criteria.title = eval('/' + title + '/i');

    let pageType = epage - spage || 0
    let skipId = -1
    if (spage && epage && offset) {
      // 不符合分页条件
      let isObjectId = /^[a-fA-F0-9]{24}$/.test(offset)
      if (pageType < -20 || pageType > 20 || !isObjectId) {
        return this.ctx.render('error.html');
      }
      if (pageType >= 0 || isNaN(pageType)) {
        criteria['_id'] = { "$lt": offset }
      } else {
        criteria['_id'] = { "$gt": offset }
        skipId = 1
      }
    }
    let skip = 0;
    if (pageType > 0) {
      // next
      skip = Math.abs(pageType - 1) * limit
    } else if (pageType < 0) {
      //prve
      skip = (Math.abs(pageType) - 1) * limit
    }
    let rows = await this.ctx.model.Video.find(criteria).populate({ path: 'cid', select: 'name _id' }).sort({ "_id": skipId }).skip(skip).limit(limit).lean();
    if (pageType < 0) {
      rows = rows.reverse()
    }
    let result = {}
    // 获取最后一个id
    if (rows.length > 0) {
      result.offset = rows[rows.length - 1]['_id']
      result.offsetStart = rows[0]['_id']
    }
    let category = null;
    if (cid && /^[a-fA-F0-9]{24}$/.test(cid)) {
      category = await this.ctx.model.VideoCategory.findById(cid);
    }
    result.pageSize = limit;
    result.snowPage = nowPage - 5 < 1 ? 1 : nowPage - 5
    result.nowPage = nowPage;
    // 分页代码部分结束
    let count = 0
    if (category && category.num) {
      count = category.num
    } else if (criteria.title) {
      //搜索条件下的列表
      count = await this.ctx.model.Video.countDocuments(criteria, (err, c) => c);
    } else {
      count = await this.ctx.service.counters.get('Video');
    }
    result.pageNum = Math.ceil(count / limit) || 1
    result.count = count
    result.videoList = rows
    result.code = 200
    return result;
  }

   //视频列表
  async videoListJM({
    limit = 50,
    pageType,
    pageTypeId,
    sTime,
    eTime,
    offset=0,
    }) {
    // 分页代码部分开始
    let criteria = {
      status: 1,
    }
    // if (pid) criteria.pid = pid;
    // if (title && title.length < 180) criteria.title = eval('/' + title + '/i');

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
    let rows = await this.ctx.model.Video.find(criteria).populate({ path: 'cid', select: 'name _id' }).sort({ "_id": skipId }).skip(offset).limit(limit).lean();
    if (pageType < 0) {
      rows = rows.reverse()
    }
    let result = {}
    // 获取最后一个id
    if (rows.length > 0) {
      result.offset = rows[rows.length - 1]['_id']
      result.offsetStart = rows[0]['_id']
    }
    let category = null;
    // if (cid && /^[a-fA-F0-9]{24}$/.test(cid)) {
    //   category = await this.ctx.model.VideoCategory.findById(cid);
    // }
    // result.pageSize = limit;
    // result.snowPage = nowPage - 5 < 1 ? 1 : nowPage - 5
    // result.nowPage = nowPage;
    // 分页代码部分结束
    let count = 0
    if (category && category.num) {
      count = category.num
    } else if (criteria.title) {
      //搜索条件下的列表
      count = await this.ctx.model.Video.countDocuments(criteria, (err, c) => c);
    } else {
      count = await this.ctx.service.counters.get('Video');
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
  //添加
  async createVideo(o) {

  }

  async findVideo(id, type = "view") {
    const video = await this.ctx.model.Video.findById(id).lean();
    if (!video) {
      return { code: -1, message: "视频播放站点找不到！" + id };
    }
    // let types = ["view", "star", "bad"];
    // if (!types.includes(type)) return { code: -1, message: "错误！" + id };
    // await video.update(
    //   { $inc: { type: 1} } //-2表示每次减2，1表示每次加1
    // )
    return { code: 200, data: video, message: "成功！" };
  }

  async updateVideo(id, updates) {
    const video = await this.ctx.model.Video.findById(id);
    if (!video) {
      return { code: -1, message: "找不到！" };
    }
    await video.update(updates);
    return { code: 200, message: "修改成功！" };
  }

  async batchReplaceVideoLinks({ originalContent, replacementContent = '' } = {}) {
    const original = String(originalContent || '');
    const replacement = String(replacementContent === undefined || replacementContent === null ? '' : replacementContent);
    if (!original.trim()) return { code: -1, message: '请输入要替换的原链接' };

    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp(escaped);
    const replaceText = value => typeof value === 'string' ? value.split(original).join(replacement) : value;
    const replaceNested = value => {
      if (typeof value === 'string') return replaceText(value);
      if (Array.isArray(value)) return value.map(item => replaceNested(item));
      if (value && typeof value === 'object') {
        const result = {};
        Object.keys(value).forEach(key => { result[key] = replaceNested(value[key]); });
        return result;
      }
      return value;
    };
    const writeBatch = async (Model, criteria, projection, transform) => {
      const cursor = Model.find(criteria).select(projection).lean().cursor();
      const operations = [];
      let matched = 0;
      let updated = 0;
      let row;
      while ((row = await cursor.next())) {
        matched += 1;
        const updates = transform(row);
        if (!Object.keys(updates).length) continue;
        updated += 1;
        operations.push({ updateOne: { filter: { _id: row._id }, update: { $set: updates } } });
        if (operations.length >= 100) {
          await Model.bulkWrite(operations, { ordered: false });
          operations.length = 0;
        }
      }
      if (operations.length) await Model.bulkWrite(operations, { ordered: false });
      return { matched, updated };
    };

    const videoResult = await writeBatch(
      this.ctx.model.Video,
      { $or: [
        { video: matcher },
        { playUrl: matcher },
        { 'playSources.url': matcher },
        { 'playSources.value': matcher },
        { 'playSources.episodes.url': matcher },
      ] },
      'video playUrl playSources',
      row => {
        const updates = {};
        if (typeof row.video === 'string' && row.video.includes(original)) updates.video = replaceText(row.video);
        if (typeof row.playUrl === 'string' && row.playUrl.includes(original)) updates.playUrl = replaceText(row.playUrl);
        if (row.playSources) updates.playSources = replaceNested(row.playSources);
        return updates;
      }
    );
    const imageResult = await writeBatch(
      this.ctx.model.VideoImage,
      { $or: [
        { image: matcher },
        { image_list: matcher },
        { content: matcher },
      ] },
      'image image_list content',
      row => {
        const updates = {};
        if (typeof row.image === 'string' && row.image.includes(original)) updates.image = replaceText(row.image);
        if (typeof row.image_list === 'string' && row.image_list.includes(original)) updates.image_list = replaceText(row.image_list);
        if (typeof row.content === 'string' && row.content.includes(original)) updates.content = replaceText(row.content);
        return updates;
      }
    );
    const totalMatched = videoResult.matched + imageResult.matched;
    const totalUpdated = videoResult.updated + imageResult.updated;
    return {
      code: 200,
      data: { videoMatched: videoResult.matched, videoUpdated: videoResult.updated, imageMatched: imageResult.matched, imageUpdated: imageResult.updated, totalMatched, totalUpdated },
      message: `批量替换完成，共更新 ${totalUpdated} 条资源`,
    };
  }

  async videoBatchDeleteSources() {
    const [configuredSources, groupedVideos] = await Promise.all([
      this.ctx.model.CollectSource.find({ siteType: 8 })
        .select('_id name code status')
        .sort({ name: 1 })
        .lean(),
      this.ctx.model.Video.aggregate([
        {
          $match: {
            $or: [
              { collectSourceId: { $nin: [null, ''] } },
              { 'fromObj.collectSourceId': { $nin: [null, ''] } },
            ],
          },
        },
        {
          $project: {
            sourceId: {
              $cond: [
                { $and: [ { $ne: ['$collectSourceId', null] }, { $ne: ['$collectSourceId', ''] } ] },
                '$collectSourceId',
                '$fromObj.collectSourceId',
              ],
            },
            sourceName: {
              $cond: [
                { $and: [ { $ne: ['$sourceName', null] }, { $ne: ['$sourceName', ''] } ] },
                '$sourceName',
                '$fromObj.sourceName',
              ],
            },
          },
        },
        {
          $group: {
            _id: '$sourceId',
            sourceName: { $first: '$sourceName' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const sourceMap = new Map();
    configuredSources.forEach(source => {
      const sourceId = String(source._id);
      sourceMap.set(sourceId, {
        sourceId,
        sourceName: source.name || source.code || sourceId,
        code: source.code || '',
        count: 0,
        configured: true,
        status: source.status,
      });
    });

    groupedVideos.forEach(group => {
      const sourceId = String(group._id || '').trim();
      if (!sourceId) return;
      const current = sourceMap.get(sourceId);
      if (current) {
        current.count = group.count || 0;
        if (!current.sourceName && group.sourceName) current.sourceName = group.sourceName;
        return;
      }
      sourceMap.set(sourceId, {
        sourceId,
        sourceName: group.sourceName || sourceId,
        code: '',
        count: group.count || 0,
        configured: false,
        status: 0,
      });
    });

    const sources = Array.from(sourceMap.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return String(a.sourceName).localeCompare(String(b.sourceName), 'zh-CN');
    });
    return { code: 200, data: { sources } };
  }

  async videoBatchDelete({ conditions = [], sourceId = '', sourceName = '' } = {}) {
    const selectedConditions = Array.isArray(conditions)
      ? conditions.map(item => String(item)).filter(item => ['title', 'cover', 'play'].includes(item))
      : [];
    const clauses = [];

    if (selectedConditions.includes('title')) {
      clauses.push(emptyStringCondition('title'));
    }
    if (selectedConditions.includes('cover')) {
      // 历史数据使用 image，新采集数据同时可能使用 cover，只有两者都为空才算没有封面。
      clauses.push({ $and: [emptyStringCondition('image'), emptyStringCondition('cover')] });
    }
    if (selectedConditions.includes('play')) {
      // 兼容旧 video 字段、新 playUrl 字段及结构化播放线路。
      clauses.push({
        $and: [
          emptyStringCondition('video'),
          emptyStringCondition('playUrl'),
          emptyArrayCondition('playSources'),
        ],
      });
    }

    const normalizedSourceId = String(sourceId || '').trim();
    const normalizedSourceName = String(sourceName || '').trim();
    if (normalizedSourceId) {
      clauses.push({
        $or: [
          { collectSourceId: normalizedSourceId },
          { 'fromObj.collectSourceId': normalizedSourceId },
        ],
      });
    } else if (normalizedSourceName) {
      clauses.push({
        $or: [
          { sourceName: normalizedSourceName },
          { 'fromObj.sourceName': normalizedSourceName },
        ],
      });
    }

    if (!clauses.length) {
      return { code: -1, message: '请选择删除条件或采集源' };
    }

    const criteria = clauses.length === 1 ? clauses[0] : { $and: clauses };
    const result = await this.ctx.model.Video.deleteMany(criteria);
    const deletedCount = result.deletedCount || result.n || 0;
    if (deletedCount > 0) {
      await this.ctx.service.video.videoUpdateAll().catch(error => {
        this.ctx.logger.warn('[videoBatchDelete] refresh cache failed: %s', error.message);
      });
    }
    return {
      code: 200,
      data: { deletedCount, conditions: selectedConditions, sourceId: normalizedSourceId, sourceName: normalizedSourceName },
      message: `批量删除完成，共删除 ${deletedCount} 条视频`,
    };
  }

  async disableVideo(id) {
    const video = await this.ctx.model.Video.findById(id);
    if (!video) {
      return { code: -1, message: "站点找不到！" };
    }
    // await video.update({ status: !video.status });
    // .destroy();
    return { code: 200, message: video.title + "操作成功！" };
  }
  async delVideo(id) {
    const video = await this.ctx.model.Video.findById(id);
    await video.destroy();
    return { code: 200, message: video.title + "删除成功！" };
  }
  async updateVideoCacheList() {
    let videoList = await this.ctx.model.Video.find().sort({_id:-1}).limit(8);
    await this.ctx.service.cache.set('videoLList', videoList);
    const cacheDir = path.join(this.ctx.app.config.cacheFile, 'video_l');
    await fs.promises.mkdir(cacheDir, { recursive: true });
    const filename = path.join(cacheDir, 'index.json');
    const tempPath = filename + '.tmp-' + process.pid + '-' + crypto.randomBytes(6).toString('hex');
    try {
      await fs.promises.writeFile(tempPath, JSON.stringify(videoList), 'utf8');
      for (let attempt = 0; ; attempt++) {
        try {
          await fs.promises.rename(tempPath, filename);
          break;
        } catch (error) {
          if (attempt >= 3 || ![ 'EPERM', 'EBUSY', 'EACCES' ].includes(error.code)) throw error;
          await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1)));
        }
      }
    } finally {
      try {
        await fs.promises.unlink(tempPath);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
  playVideo(id) {
    let { ctx } = this
    const path = process.cwd() + '/app/public/videos/1.mp4'
    const stat = fs.statSync(path)
    const fileSize = stat.size
    const range = ctx.request.headers.range
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-")
      const start = parseInt(parts[0], 10)
      const end = parts[1]
        ? parseInt(parts[1], 10)
        : fileSize - 1
      const chunksize = (end - start) + 1
      const file = fs.createReadStream(path, { start, end })
      const header = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      }
      ctx.set(header);
      ctx.status = 206;
      file.on('error', (err) => { console.log('egg-erro') })
      ctx.body = file;
    } else {
      const header = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      }
      ctx.set(header);
      ctx.status = 206;
      let tream = fs.createReadStream(path)
      ctx.body = tream
    }
  }
  async guoChanVideoList({ offset = 0, title, sTime, eTime }) {
    let redisPage = offset / 50 + 1// 10.8*50
    let redisResponseData = await this.ctx.service.cache.get('video-guochan-' + redisPage);
    if (redisResponseData) {
      return redisResponseData;
    }
    let criteria = {};
    let limit = 50;
    let queryOptions = {
      offset,
      limit,
      where: criteria,
    };
    if (Object.keys(criteria).length > 0) {
      queryOptions.where = criteria;
    }
    let { count, rows } = await this.ctx.model.VideoGuoChan.findAndCountAll(
      queryOptions
    );
    let ResponseData = {
      code: 200,
      data: {
        data: rows,
        count,
        limit,
        offset,
      },
    };
    await this.ctx.service.cache.set('video-guochan-' + redisPage, ResponseData);
    return ResponseData;
  }
  async findGuoChanVideo(id) {
    const guochanV = await this.ctx.model.VideoGuoChan.findById(id);
    if (!guochanV) {
      return { code: -1, message: "国产播放站点找不到！" };
    }
    await guochanV.increment('view', { by: 1 });
    return { code: 200, data: guochanV, message: "成功！" };
  }
  async huahuaList({ offset = '', title, sTime, eTime }) {
    let criteria = {};
    if (offset) criteria['_id'] = { "$gt": offset }
    let limit = 30;
    const count = await this.ctx.model.Huahua.countDocuments(criteria, (err, c) => c)
    let rows = await this.ctx.model.Huahua.find(criteria).sort({ "_id": -1 }).limit(limit).select('name filePath title duration image poster time view video createdAt viewUrl').lean(); //.sort({"createdAt":-1})
    let ResponseData = {
      code: 200,
      data: {
        data: rows,
        count,
        limit,
        offset,
      },
    };
    // await this.ctx.service.cache.set('huahua-' + redisPage, ResponseData);
    return ResponseData;
  }
  async findHuaHua(id) {
    const video = await this.ctx.model.HuaHua.findById(id);
    if (!video) {
      return { code: -1, message: "站点找不到！" };
    }
    let types = ["view", "star", "bad"];
    await video.increment('view', { by: 1 });
    return { code: 200, data: video, message: "成功！" };
  }
  async updateHuaHua(id) {
    const video = await this.ctx.model.HuaHua.findById(id);
    if (!video) {
      return { code: -1, message: "找不到！" };
    }
    if (updates.type === 'view') {
      await video.increment('view', { by: 1 });
    } else if (updates.type === 'star') {
      await video.increment('star', { by: 1 });
    } else if (updates.type === 'bad') {
      await video.increment('bad', { by: 1 });
    }
    return { code: 200, message: "修改成功！" };
  }

  //滑图
  async huaTuList({ offset = 0, title, sTime, eTime }) {
    let redisPage = offset / 30 + 1
    let redisResponseData = await this.ctx.service.cache.get('huatu-' + redisPage);
    if (redisResponseData) {
      return redisResponseData;
    }

    let criteria = {};
    let limit = 30;
    // if (name) criteria['name'] = { [this.app.Sequelize.Op.like]: name + "%" }
    // if (sTime && eTime) criteria.createdAt = { [this.app.Sequelize.Op.between]: [new Date(sTime), new Date(eTime)] }
    if (title) criteria["title"] = { [this.app.Sequelize.Op.like]: "%" + title + "%" };
    if (!this.ctx.session.uid) criteria["status"] = true;
    // if (sTime && eTime) criteria.createdAt = { [this.app.Sequelize.Op.between]: [new Date(sTime), new Date(eTime)] }
    let queryOptions = {
      // attributes: { exclude: ['password'] },
      offset,
      limit,
      order: [
        ["createdAt", "desc"],
        ["isHot", "desc"],
      ],
      where: criteria,
    };
    if (Object.keys(criteria).length > 0) {
      queryOptions.where = criteria;
    }
    let { count, rows } = await this.ctx.model.Huatu.findAndCountAll(
      queryOptions
    );
    let ResponseData = {
      code: 200,
      data: {
        data: rows,
        count,
        limit,
        offset,
      },
    };
    await this.ctx.service.cache.set('huatu-' + redisPage, ResponseData);
    return ResponseData;
  }
  async findHuaTu(id) {
    const huatu = await this.ctx.model.HuaTu.findById(id);
    if (!huatu) {
      return { code: -1, message: "站点找不到！" };
    }
    let types = ["view", "star", "bad"];
    await huatu.increment('view', { by: 1 });
    return { code: 200, data: huatu, message: "成功！" };
  }
  async updateHuaTu(id) {
    const huatu = await this.ctx.model.HuaTu.findById(id);
    if (!huatu) {
      return { code: -1, message: "找不到！" };
    }
    if (updates.type === 'view') {
      await huatu.increment('view', { by: 1 });
    } else if (updates.type === 'star') {
      await huatu.increment('star', { by: 1 });
    } else if (updates.type === 'bad') {
      await huatu.increment('bad', { by: 1 });
    }
    return { code: 200, message: "修改成功！" };
  }

  async contentList(contentType, params = {}) {
    const type = contentType === 'image' ? 'image' : 'book';
    const Model = type === 'image' ? this.ctx.model.VideoImage : this.ctx.model.VideoBook;
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 30));
    const page = Math.max(1, Number(params.page) || (Number(params.offset) >= 0 ? Math.floor(Number(params.offset) / limit) + 1 : 1));
    const offset = Number.isFinite(Number(params.offset)) ? Math.max(0, Number(params.offset)) : (page - 1) * limit;
    const criteria = { status: 1 };
    const categoryId = params.categoryId || params.cid;
    if (categoryId && /^[a-fA-F0-9]{24}$/.test(String(categoryId))) criteria.categoryId = categoryId;
    if (params.title || params.keyword) {
      const keyword = String(params.title || params.keyword).trim().slice(0, 180).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (keyword) criteria.title = { $regex: keyword, $options: 'i' };
    }
    const [ rows, count ] = await Promise.all([
      Model.find(criteria).populate({ path: 'categoryId', select: 'name _id' }).sort({ updatedAt: -1, _id: -1 }).skip(offset).limit(limit).lean(),
      Model.countDocuments(criteria),
    ]);
    const data = rows.map(row => ({ ...row, id: row.id || String(row._id) }));
    return { code: 200, data: { data, rows: data, count, limit, offset, page, pageNum: Math.ceil(count / limit) || 1 } };
  }

  async findBookContent(id) {
    if (!/^[a-fA-F0-9]{24}$/.test(String(id || ''))) return { code: -1, message: '小说 ID 无效' };
    const row = await this.ctx.model.VideoBook.findById(id).populate({ path: 'categoryId', select: 'name _id' }).lean();
    if (!row) return { code: 404, message: '小说不存在' };
    await this.ctx.model.VideoBook.updateOne({ _id: id }, { $inc: { view: 1 } });
    return { code: 200, data: { ...row, id: String(row._id) } };
  }

  async findImageContent(id) {
    if (!/^[a-fA-F0-9]{24}$/.test(String(id || ''))) return { code: -1, message: '图片 ID 无效' };
    const row = await this.ctx.model.VideoImage.findById(id).populate({ path: 'categoryId', select: 'name _id' }).lean();
    if (!row) return { code: 404, message: '图片不存在' };
    await this.ctx.model.VideoImage.updateOne({ _id: id }, { $inc: { view: 1 } });
    return { code: 200, data: { ...row, id: String(row._id) } };
  }

  async updateBookContent(id, updates = {}) {
    if (!/^[a-fA-F0-9]{24}$/.test(String(id || ''))) return { code: -1, message: '小说 ID 无效' };
    const allowed = [ 'title', 'content', 'description', 'keywords', 'image', 'image_list', 'status', 'isHot', 'tag', 'categoryId' ];
    const set = {};
    allowed.forEach(key => { if (updates[key] !== undefined) set[key] = updates[key]; });
    const row = await this.ctx.model.VideoBook.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean();
    return row ? { code: 200, data: row, message: '小说已更新' } : { code: 404, message: '小说不存在' };
  }

  async updateImageContent(id, updates = {}) {
    if (!/^[a-fA-F0-9]{24}$/.test(String(id || ''))) return { code: -1, message: '图片 ID 无效' };
    const allowed = [ 'title', 'content', 'description', 'keywords', 'image', 'image_list', 'status', 'isHot', 'tag', 'categoryId' ];
    const set = {};
    allowed.forEach(key => { if (updates[key] !== undefined) set[key] = updates[key]; });
    const row = await this.ctx.model.VideoImage.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean();
    return row ? { code: 200, data: row, message: '图片已更新' } : { code: 404, message: '图片不存在' };
  }

  async deleteBookContent(id) {
    const row = await this.ctx.model.VideoBook.findByIdAndDelete(id).lean();
    return row ? { code: 200, message: '小说已删除' } : { code: 404, message: '小说不存在' };
  }

  async deleteImageContent(id) {
    const row = await this.ctx.model.VideoImage.findByIdAndDelete(id).lean();
    return row ? { code: 200, message: '图片已删除' } : { code: 404, message: '图片不存在' };
  }

  // 小说
  async videoBookList({ offset = 0, cid, pid, title, sTime, eTime }) {
    let limit = 30;
    let criteria = {};
    const countCategoryId = cid ? cid : 'all';
    const countPid = pid ? pid + '-' : 'all-';
    const countName = 'book-list-' + countPid + countCategoryId;
    if (pid) criteria.pid = pid;
    if (cid) criteria.cid = cid;
    let count = await this.ctx.model.Counters.findById(countName).select('seq').lean();
    let rows = await this.ctx.model.VideoBook.find(criteria).sort({ "_id": -1 }).skip(offset).limit(limit).select('title time view').lean(); //.sort({"createdAt":-1})
    // 异步存入文章条件的总数
    this.ctx.model.VideoBook.countDocuments(criteria, (err, c) => {
      if (!count) {
        this.ctx.model.Counters.create({
          _id: countName,
          seq: c
        })
      } else if (count.seq !== c) {
        this.ctx.model.Counters.updateOne({ _id: countName }, { $set: { seq: c } }).exec()
      }
    });
    const ResponseData = {
      code: 200,
      data: {
        data: rows,
        count: count ? count.seq : 1,
        limit,
        offset,
      },
    };
    // 把count 修改一下
    return ResponseData;
  }
  async findVideoBook(id) {
    const VideoBook = await this.ctx.model.VideoBook.findById(id);
    if (!VideoBook) {
      return { code: -1, message: "站点找不到！" };
    }
    await VideoBook.increment('view', { by: 1 });
    return { code: 200, data: VideoBook, message: "成功！" };
  }
}

module.exports = Video;
