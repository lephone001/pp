"use strict";
const Service = require("egg").Service;
const message = {
  c404: {
    code: 404,
    message: "找不到该内容！",
  },
};
class VideoPlatform extends Service {
  //用户列表
  async videoPlatformList () {
    let rows = await this.ctx.model.VideoPlatform.find();
    return {
      code: 200,
      data: {
        data: rows
      },
    };
  }
  //添加
  async createVideoPlatform (o) {
    // let uid = this.ctx.service.utils.getTokenInfo('id')
    // let username = this.ctx.service.utils.getTokenInfo('username')
    let resault = {
      code: 200,
      data: {
        success: [],
        filed: []
      }
    }
    await this.ctx.model.VideoPlatform.create({
      name:o.name,
      shortName:o.name,
      siteType: 8,
      updateType: 1,
      typeName: '视频',
      status: 1,
      link: o.link,
      num: 0
    }).then(() => {
      resault.data.success.push({ name:o.name, message: '添加成功' })
    }).catch((res) => {
      resault.data.filed.push({ name:o.name, message: '链接重复！' })
    })
    return {
      code: 200, 
      data: resault
    }
    // //验证
    // const user = await this.ctx.model.User.findById(uid);

    // if (user.alreadyVideoPlatformNum >= user.allowVideoPlatformNum) {
    //   return {
    //     message: "站点已达上限！",
    //     code: -1,
    //   };
    // }
    // //验证重复
    // const [
    //   videoPlatform,
    //   created,
    // ] = await this.ctx.model.VideoPlatform.findOrCreate({
    //   where: {
    //     [this.app.Sequelize.Op.or]: [
    //       {
    //         videoPlatformname: o.videoPlatformname,
    //       },
    //       {
    //         rulename: o.rulename,
    //       },
    //     ],
    //   },
    //   defaults: {
    //     uid,
    //     uname: username,
    //     videoPlatformname: o.videoPlatformname,
    //     rulename: o.rulename,
    //     tid: o.tid,
    //     tname: o.tname,
    //     status: o.status,
    //     videoPlatformType: o.videoPlatformType,
    //     description: o.description,
    //     keyWords: o.keyWords,
    //     isHot: o.isHot,
    //     favicon: o.favicon,
    //     logo: o.logo,
    //     isNavNotice: o.isNavNotice,
    //     isNavBanner: o.isNavBanner,
    //     isNavArticle: o.isNavArticle,
    //     isFriendLink: o.isFriendLink,
    //     shareaholicImage: o.shareaholicImage,
    //     ogImage: o.ogImage,
    //     themeColor: o.themeColor,
    //   },
    // });
    // if (created) {
    //   //设置alreadyVideoPlatformNum
    //   // console.log(user)
    //   // user.update({inventory: Sequelize.literal('inventory - 1')}, where: {XXX})
    //   // await user.increment('alreadyVideoPlatformNum', { by: 1 });
    //   await user.increment("alreadyVideoPlatformNum");
    //   return {
    //     message: "创建成功！",
    //     code: 200,
    //   };
    // } else {
    //   //已经存在
    //   return {
    //     message: "站点名称已存在",
    //     code: 400,
    //   };
    // }
  }

  async findVideoPlatform (id) {
    const videoPlatform = await this.ctx.model.VideoPlatform.findById(id);
    if (!videoPlatform) {
      return { code: -1, message: "站点找不到！" };
    }
    return videoPlatform;
  }

  async updateVideoPlatform (id, updates) {
    const videoPlatform = await this.ctx.model.VideoPlatform.findById(id);
    if (!videoPlatform) {
      return { code: -1, message: "站点找不到！" };
    }
    await videoPlatform.update(updates);
    await this.ctx.model.Video.updateMany(
      { pid:id }, // 查询条件
      { $set: { status: updates.status?1:0 } } // 修改内容
    )
    await this.ctx.model.VideoCategory.updateMany(
      { pid:id }, // 查询条件
      { $set: { status: updates.status?1:0 } } // 修改内容
    )

    return { code: 200, message: "修改成功！" };
  }
  async disableVideoPlatform (id) {
    const videoPlatform = await this.ctx.model.VideoPlatform.findById(id);
    if (!videoPlatform) {
      return { code: -1, message: "站点找不到！" };
    }
    await videoPlatform.update({ status: !videoPlatform.status });
    await this.ctx.model.Video.updateMany(
      { pid:id }, // 查询条件
      { $set: { status: 0 } } // 修改内容
    )
    // .destroy();
    return {
      code: 200,
      message: videoPlatform.videoPlatformname + "操作成功！",
    };
  }
  async delVideoPlatform (id) {
    // await this.ctx.model.VideoPlatform.findByIdAndDelete(id);
    // await this.ctx.model.Video.deleteMany({pid:id});
    return {
      code: 200,
      message: "删除成功！",
    };
  }
}

module.exports = VideoPlatform;