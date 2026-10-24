"use strict";
const Service = require("egg").Service;
const message = {
  c404: {
    code: 404,
    message: "找不到该内容！",
  },
};
class VideoImage extends Service {
  //用户列表
  async videoImageList ({
    offset = 0,
    videoImagename,
    sTime,
    eTime,
    cid,
    pid
  }) {
    let limit = 30;
    let criteria = {};
    const countCategoryId = cid ? cid : 'all';
    const countPid = pid ? pid + '-' : 'all-';
    const countName = 'images-list-' + countPid + countCategoryId;
    if (pid) criteria.pid = pid;
    if (cid) criteria.cid = cid;
    let count = await this.ctx.model.Counters.findById(countName).select('seq').lean();
    let rows = await this.ctx.model.VideoImage.find(criteria,{list:0}).sort({"_id":-1}).skip(offset).limit(limit).lean(); //.sort({"createdAt":-1})
    // 异步存入文章条件的总数
    this.ctx.model.VideoImage.countDocuments(criteria, (err, c) => {
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
        count: count?count.seq:1,
        limit,
        offset,
      },
    };
    // 把count 修改一下
    return ResponseData;
  }
  //添加
  async createVideoImage (o) {
    //验证
    const user = await this.ctx.model.User.findById(this.ctx.session.uid);

    if (user.alreadyVideoImageNum >= user.allowVideoImageNum) {
      return {
        message: "已达上限！",
        code: -1,
      };
    }
    //验证重复
    const [videoImage, created] = await this.ctx.model.VideoImage.findOrCreate({
      where: {
        [this.app.Sequelize.Op.or]: [
          {
            videoImagename: o.videoImagename,
          },
          {
            rulename: o.rulename,
          },
        ],
      },
      defaults: {
        uid: this.ctx.session.uid,
        uname: this.ctx.session.username,
        videoImagename: o.videoImagename,
        rulename: o.rulename,
        tid: o.tid,
        tname: o.tname,
        status: o.status,
        videoImageType: o.videoImageType,
        description: o.description,
        keyWords: o.keyWords,
        isHot: o.isHot,
        favicon: o.favicon,
        logo: o.logo,
        isNavNotice: o.isNavNotice,
        isNavBanner: o.isNavBanner,
        isNavArticle: o.isNavArticle,
        isFriendLink: o.isFriendLink,
        shareaholicImage: o.shareaholicImage,
        ogImage: o.ogImage,
        themeColor: o.themeColor,
      },
    });
    if (created) {
      //设置alreadyVideoImageNum
      // console.log(user)
      // user.update({inventory: Sequelize.literal('inventory - 1')}, where: {XXX})
      // await user.increment('alreadyVideoImageNum', { by: 1 });
      await user.increment("alreadyVideoImageNum");
      return {
        message: "创建成功！",
        code: 200,
      };
    } else {
      //已经存在
      return {
        message: "名称已存在",
        code: 400,
      };
    }
  }

  async findVideoImage (id) {
    const videoImage = await this.ctx.model.VideoImage.findById(id);
    if (!videoImage) {
      return { code: -1, message: "找不到！" };
    }
    return {
      data: videoImage,
      code: 200,
    };
  }

  async updateVideoImage (id, updates) {
    const videoImage = await this.ctx.model.VideoImage.findById(id);
    if (!videoImage) {
      return { code: -1, message: "找不到！" };
    }
    // return videoImage.update(updates);
  }
  async disableVideoImage (id) {
    const videoImage = await this.ctx.model.VideoImage.findById(id);
    if (!videoImage) {
      return { code: -1, message: "找不到！" };
    }
    await videoImage.update({ status: !videoImage.status });
    // .destroy();
    return { code: 200, message: videoImage.videoImagename + "操作成功！" };
  }
  async delVideoImage (id) {
    const videoImage = await this.ctx.model.VideoImage.findById(id);
    await videoImage.destroy();
    return { code: 200, message: videoImage.videoImagename + "删除成功！" };
  }
}

module.exports = VideoImage;
