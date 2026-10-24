"use strict";
const Service = require("egg").Service;
const message = {
  c404: {
    code: 404,
    message: "找不到该内容！",
  },
};
class FriendLink extends Service {
  //用户列表
  async friendLinkList({ sid, name, sTime, eTime }) {
    let criteria = {};
    if (name) criteria["name"] = name
    if (sid) criteria["sid"] = sid
    let rows = await this.ctx.model.FriendLink.find(criteria).sort({"isHot":1,"isTop":1,"_id":-1}).skip(0).limit(300).lean();
    return {
      code: 200,
      data: rows,
    };
  }

  //添加
  async createFriendLink(o) {
    //验证重复
    let isHave = await this.ctx.model.FriendLink.findOne({
      link: o.link,
      sid: o.sid
    })
    if (isHave) {
      return {
        code: -1,
        message: '链接已存在！'
      }
    }
    await this.ctx.model.FriendLink.create(
      {
        name: o.name,
        sid: o.sid,
        link: o.link,
        view: 0,
        logo: o.logo,
        host: o.host,
        image: o.image,
        isOpenNewPage: o.isOpenNewPage,
        status: o.status,
        category: o.category,
        isHot: o.isHot,
        isTop: o.isTop,
        sort: o.sort,
        description: o.description,
      }
    );
    return {
      message: "创建成功！",
      code: 200,
    };
    // const [friendLink, created] = await this.ctx.model.FriendLink.findOrCreate({
    //   where: {
    //     [this.app.Sequelize.Op.and]: [
    //       {
    //         link: o.link,
    //         sid: o.sid
    //       }
    //     ]
    //   },
    //   defaults: {
    //     uid: this.ctx.session.uid,
    //     name: o.name,
    //     sid: o.sid,
    //     link: o.link,
    //     logo: o.logo,
    //     image: o.image,
    //     isOpenNewPage: o.isOpenNewPage,
    //     status: o.status,
    //     isHot: o.isHot,
    //     isTop: o.isTop,
    //     sort: o.sort,
    //     description: o.description,
    //   }
    // });
    // if (created) {
    //   return {
    //     message: '创建成功！',
    //     code: 200
    //   }
    // } else {
    //   //已经存在
    //   return {
    //     message: '导航链接已存在',
    //     code: 400
    //   }
    // }
  }

  async findFriendLink(id) {
    const friendLink = await this.ctx.model.FriendLink.findById(id);
    if (!friendLink) {
      return { code: -1, message: "找不到！" };
    }
    return friendLink;
  }

  async updateFriendLink(item) {
    const friendLink = await this.ctx.model.FriendLink.findById(item._id);
    if (!friendLink){
      return { code: -1, message: "找不到！" };
    }
    if (item.type == "view") {
      await this.ctx.model.FriendLink.updateOne({_id:item._id},{view:friendLink.view+1});
    } else if (item.type == "fromNum") {
      await this.ctx.model.FriendLink.updateOne({_id:item._id},{from:friendLink.from+1});
    }
    return {code: 200};
  }
  async disableFriendLink(id) {
    const friendLink = await this.ctx.model.FriendLink.findById(id);
    if (!friendLink) {
      return { code: -1, message: "站点找不到！" };
    }
    await friendLink.update({ status: !friendLink.status });
    return { code: 200, message: friendLink.friendLinkname + "操作成功！" };
  }
  async delFriendLink(id) {
    await this.ctx.model.FriendLink.deleteOne({_id:id});
    return { code: 200, message:"删除成功！" };
  }
}

module.exports = FriendLink;
