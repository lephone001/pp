"use strict";
const Service = require("egg").Service;
const message = {
  c404: {
    code: 404,
    message: "找不到该内容！",
  },
};
class Adv extends Service {
  //用户列表
  async advList ({ offset = 0, limit = 10, sid,name, sTime, eTime }) {
    let uid = this.ctx.service.utils.getTokenInfo('id')
    let isAdmin = this.ctx.service.utils.getTokenInfo('isAdmin')
    if (limit - 0 > 50) limit = 50;
    let criteria = {}
    if (sid) criteria["sid"] = sid
    if (!uid && !sid) return { code: -2, message: '没有权限访问！' }
    //未登录用户访问 只访问开启的
    if (!uid) {
      criteria["status"] = true;
    }
    if (!sid) { criteria["uid"] = uid; }
    if (name) criteria["name"] = { [this.app.Sequelize.Op.like]: name + "%" };
    // if (sTime && eTime) criteria.createdAt = { [this.app.Sequelize.Op.between]: [new Date(sTime), new Date(eTime)] }

    let queryOptions = {
      // attributes: { exclude: ['password'] },
      offset,
      limit,
      where: criteria,
      order: [
        ["isTop", "desc"],
        ["isHot", "desc"],
        ["createdAt", "desc"],
        ["id", "desc"],
      ],
      distinct: true,
      include: [
        {
          model: this.ctx.model.Site,
          // where: { state: this.app.Sequelize.col('project.state') },
          attributes: ["sitename", "uname","themeColor"],
        }, // 加载所有站点
      ],
    };
    let { count, rows } = await this.ctx.model.Adv.findAndCountAll(
      queryOptions
    );
    return {
      code: 200,
      data: {
        data: rows,
        count,
        limit,
        offset,
      },
    };
  }
  //用户添加
  async createAdv (o) {
    // console.log(o)
    // const [adv, created] = await this.ctx.model.Adv.findOrCreate({
    //   where: { name: o.name },
    //   // defaults: {
    //   //     description: '这个人很懒没有留下任何内容！',
    //   //     password: o.password
    //   // }
    // });
    // if (created) {
    //   return {
    //     message: '创建成功！',
    //     code: 200
    //   }
    // } else {
    //   //用户已经存在
    //   return {
    //     message: '导航名称已存在',
    //     code: 400
    //   }
    // }
    let saveArr = [];

    await this.ctx.model.Adv.create({
      uid: this.ctx.session.uid,
      name: o.name,
      status: o.status,
      sort: o.sort,
      advType: o.advType,
      advPosition: o.advPosition,
      sid: 0,
      isHot: o.isHot,
      isTop: o.isTop,
      isIframeHideAdv: o.isIframeHideAdv,
      content: o.content,
      image: o.image,
      link: o.link,
      description: o.description,
    }).then((employee) => {
      o.sid.forEach((item) => {
        if (item) {
          saveArr.push({
            aid: employee.get("id"),
            sid: item - 0,
          });
        }
      });
    });
    await this.ctx.model.Advsite.bulkCreate(saveArr);
    return {
      message: "创建成功！",
      code: 200,
    };
  }

  async findAdv (id) {
    const adv = await this.ctx.model.Adv.findById(id);
    if (!adv) {
      return { code: -1, message: "导航找不到！" };
    }
    return adv;
  }
  async viewAdv ({ id, sid,link }) {
    const adv = await this.ctx.model.Adv.findById(id);
    await adv.increment("view");
    await adv.reload()
    await this.ctx.model.AdvView.create({
      aid: id,
      sid: sid,
      link
    })
    return { code: 200, data: nav };
  }
  async updateAdv (id, updates) {
    const adv = await this.ctx.model.Adv.findById(id);
    if (!adv) {
      return { code: -1, message: "导航找不到！" };
    }
    if (updates.type == "view") {
      adv.increment("view");
    }
    return { code: 200, message: "更新成功！" };
  }

  async delAdv (id) {
    const adv = await this.ctx.model.Adv.findById(id);
    if (!adv) {
      return { code: -1, message: "用户找不到！" };
    }
    return { code: 200, message: adv.name + "删除成功！" };
  }
}

module.exports = Adv;
