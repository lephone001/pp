/*
 * @Author: Ant
 * @Date: 2020-06-19 18:51:19
 * @LastEditors: Ant
 * @LastEditTime: 2020-06-22 12:15:49
 * @Description: file content
 */
const axios = require('axios')
'use strict';
const fs = require('fs');

const Controller = require('egg').Controller;
class VideoController extends Controller {
  async playstatus() {
    const { ctx } = this;
    const video_id = ctx.query.id;
    const isobjectId = typeof video_id === 'string' && video_id.length === 24 && /^[a-fA-F0-9]{24}$/.test(video_id);
    if (!isobjectId) {
      ctx.status = 444;
      ctx.body = '';
      return;
    }
    // let code = ctx.query.code // 1 2 3  status 【2为确认视频不能播放 3为用户提交错误但是检测正常】
    // let monthm = '/' + (new Date().getMonth() + 1) + '/'
    // let videoCachePath = this.ctx.app.config.cacheFile + 'video'+monthm + video_id + '.html'
    // let isHaveFile = fs.existsSync(videoCachePath)
    // if(isHaveFile){
    //   fs.unlinkSync(videoCachePath);
    // }
    // if (code == 2 && isobjectId) {
    //   //查找视频
    //   let videoItem = await ctx.model.Video.findById(video_id);
    //   let status = 1;
    //   if (videoItem && videoItem._id) {
    //     // await axios.get(videoItem.video).catch(() => { status = 2 })
    //     if (status == 2) {
    //       await ctx.model.Video.findByIdAndUpdate(video_id, { status, bad: videoItem.bad + 1 })
    //     }
    //     // 删除视频 和 缓存
    //     if (videoItem.status == 2) {
    //       // await ctx.model.Video.deleteOne({ _id: video_id })
    //     }
    //   }
    // }
    ctx.body = '';
  }
  async getTodayCountVideo() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.video.getTodayCountVideo()
  }
  async videoList() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.video.videoList(ctx.request.body)
  }
  async videoListJM () {
    const { ctx } = this;
    let jmdata = await ctx.service.video.videoListJM(ctx.request.body)
    jmdata.videoList =  ctx.service.utils.jiamiFn(jmdata.videoList)
    this.ctx.body = jmdata
  }
  async createVideoJson() {
    // 验证名称是否存在
    // let list_name = Date.now()+'-'+(Math.random()+'').slice(2,10);
    // let cachePageFilePath = this.ctx.app.config.cacheFile + 'video_json/';
    // let filePath = cachePageFilePath + list_name + '.json'
    let o = this.ctx.request.body
    if (o.title && o.image && o.title) {
      // fs.writeFile(filePath, JSON.stringify(o), null, function (err) { });
      await axios.post('http://168.206.9.65/api/createVideo', o)
        .then(function (response) {
          // console.log(response);
          console.log(response.data);
        })
        .catch(function (error) {
          // console.log(error);
          console.log('添加失败' + error.code);
        });
    } else {
      return this.ctx.body = { code: -1, message: o.title + '失败！' };
    }
    this.ctx.body = { message: '添加成功！', code: 200 }
  }
  async videoPiCreate() {
    const { ctx } = this;
    let requestBody = ctx.request.body.videoList
    let  videoList = ctx.service.utils.jiemiFn(requestBody)
    if(videoList&&videoList.length>0){
      ctx.service.video.videoPiCreate(videoList);
    }
    this.ctx.body = { message: '添加成功！', code: 200 } 
  }
  async createVideo() {
    // 验证名称是否存在
    let o = this.ctx.request.body
    if (!o.title || !o.image || !o.video) {
      return this.ctx.body = { message: '添加失败！', code: -3 }
    }
    let video = await this.ctx.model.Video.findOne({
      title: o.title,
      video: o.video,
    })
    if (video) {
      return this.ctx.body = { code: -1, message: o.title + '已存在！' };
    }
    if (o.title && o.image && o.title) {
      await this.ctx.model.Video.create(o).catch(() => {
        this.ctx.body = { message: '添加失败db！', code: 200 }
      })
    } else {
      return this.ctx.body = { code: -1, message: o.title + '失败！' };
    }
    this.ctx.body = { message: '添加成功！', code: 200 }
  }
  async findVideo() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id
    }
    this.ctx.body = await ctx.service.video.findVideo(options.id, ctx.request.body.type)
  }
  async updateVideo() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id,
      updates: ctx.request.body.updates
    }
   
    this.ctx.body = await ctx.service.video.updateVideo(options.id, options.updates)
  }
  async batchReplaceVideoLinks() {
    this.ctx.body = await this.ctx.service.video.batchReplaceVideoLinks(this.ctx.request.body || {});
  }
  async videoBatchDeleteSources() {
    this.ctx.body = await this.ctx.service.video.videoBatchDeleteSources();
  }
  async videoBatchDelete() {
    this.ctx.body = await this.ctx.service.video.videoBatchDelete(this.ctx.request.body || {});
  }
  async disableVideo() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id,
    }
    const rule = {
      id: { type: ['number'], allowEmpty: false, message: 'id不能为空！' },
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.video.disableVideo(options.id, options.updates)
  }
  async delVideo() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.video.delVideo(options.id)
  }
  playVideo() {
    const { ctx } = this;
    //ctx.params.date
    //ctx.params.id
    if (!ctx.params.date || ctx.params.date == 'aa' || !ctx.params.id) {
      this.ctx.body = '<h1>sb</h1>'
      return Promise.reject('meiyou')
    }
    ctx.service.video.playVideo(ctx.params.id)
  }
  async guoChanVideoList() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.video.guoChanVideoList(ctx.request.body)
  }
  async videoBookList() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.video.contentList('book', ctx.request.body)
  }
  async findVideoBook() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id
    }
    const rule = {
      id: { type: 'string', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.video.findBookContent(options.id)
  }
  async updateVideoBook() {
    const { ctx } = this;
    const id = ctx.request.body.id;
    if (!/^[a-fA-F0-9]{24}$/.test(String(id || ''))) return this.ctx.body = { code: -1, message: '小说 ID 无效' };
    this.ctx.body = await ctx.service.video.updateBookContent(id, ctx.request.body.updates || {});
  }
  async delVideoBook() {
    const { ctx } = this;
    const id = ctx.request.body.id;
    if (!/^[a-fA-F0-9]{24}$/.test(String(id || ''))) return this.ctx.body = { code: -1, message: '小说 ID 无效' };
    this.ctx.body = await ctx.service.video.deleteBookContent(id);
  }
  async findGuoChanVideo() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.video.findGuoChanVideo(options.id)
  }
  async huahuaList() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.video.huahuaList(ctx.request.body)
  }
  async updateHuaHua() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0,
      updates: ctx.request.body.updates
    }
    const rule = {
      id: { type: ['number'], allowEmpty: false, message: 'id不能为空！' },
      updates: {
        type: ['object'], allowEmpty: false,
      }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.video.updateHuaHua(options.id, options.updates)
  }
  async findHuaHua() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.video.findHuaHua(options.id, ctx.request.body.type)
  }

  //滑图、
  async huaTuList() {
    const { ctx } = this;
    this.ctx.body = await ctx.service.video.huaTuList(ctx.request.body)
  }
  async updateHuaTu() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0,
      updates: ctx.request.body.updates
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' },
      updates: {
        type: 'object', allowEmpty: false,
      }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.video.updateHuaTu(options.id, options.updates)
  }
  async findHuaTu() {
    const { ctx } = this;
    let options = {
      id: ctx.request.body.id - 0
    }
    const rule = {
      id: { type: 'number', allowEmpty: false, message: 'id不能为空！' }
    };
    ctx.validate(rule, options)
    this.ctx.body = await ctx.service.video.findHuaTu(options.id, ctx.request.body.type)
  }
  async videoUpdateAll() {
    this.ctx.service.video.videoUpdateAll().catch(error => {
      this.ctx.logger.error('[video] background refresh failed: %s', error && error.stack || error);
    });
    this.ctx.body = { code: 200, message: '刷新成功！' }
  }
 async refushVideoCategory() {
    this.ctx.service.video.refushVideoCategory();
    this.ctx.body = { code: 200, message: '刷新成功！' }
  }

  

  async videoDetailMore() {
    const { ctx } = this;
    let id = ctx.params.id
    let cidf = ctx.query.cid
    let cid = ''
    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return []
    }
    if (cidf && /^[a-fA-F0-9]{24}$/.test(cidf)) {
      cid = cidf
    }
    let result = {
      data: [],
      code: 200
    }
    let rows = []
    let queryOptions = {
      _id: { "$lt": id }
    }
    if (cid) queryOptions.cid = cid;
    try {
      rows = await this.ctx.model.Video.find(queryOptions).sort({ "_id": -1 }).populate({ path: 'cid', select: 'name _id' }).select('title image time cid videoTime view video createdAt viewUrl').limit(12);;
    } catch { }
    if (rows) {
      result.data = rows
    }
    this.ctx.body = result
  }
}
module.exports = VideoController; 
