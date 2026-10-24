'use strict';
const Service = require('egg').Service;
const message = {
  c404: {
    code: 404,
    message: '找不到该内容！'
  }
}
class Advice extends Service {
  //用户列表
  async adviceList ({ offset = 0, limit = 10, sid, sTime, eTime,status }) {
    const uid = this.service.utils.getTokenInfo('id');
    let criteria = {
      uid
    }
    if (status) criteria["status"] = true;
    if (sid) criteria["sid"] = true;
    // if (sTime && eTime) criteria.createdAt = { [this.app.Sequelize.Op.between]: [new Date(sTime), new Date(eTime)] }
    let queryOptions = {
      offset,
      limit,
      order: [['createdAt', 'desc'], ['id', 'desc']],
      include: [
        {
          model: this.ctx.model.Site,
          attributes: ["sitename", "uname","themeColor",'favicon'],
        }
      ],
    }
    let {rows,count} = await this.ctx.model.Advice.findAndCountAll(queryOptions);
    return {
      code: 200,
      data: {
        data: rows,
        limit,
        offset,
        count
      }
    }
  }
  //用户添加
  async createAdvice ({ sid, content, title }) {
    //先查询该用户ip 创建的建议箱的数量不能超过15个
    let count = await this.ctx.model.Advice.count({
      where: {
        ip: this.ctx.headers.ip,
      },
    });
    if (count > 5) {
      return {
        message: '创建失败！',
        code: -2
      }
    }
    // 根据站点查询创建人 
    let site = await this.ctx.model.Site.findById(sid)
    if (!site) return {
      message: '创建失败！',
      code: -2
    }
    const advice = await this.ctx.model.Advice.create({
      sid: sid,
      content: content,
      title: title,
      ip: this.ctx.headers.ip,
      uid: site.uid
      // defaults: {
      //     description: '这个人很懒没有留下任何内容！',
      //     password: o.password
      // }
    });
    if (advice) {
      return {
        message: '创建成功！',
        code: 200
      }
    } else {
      //用户已经存在
      return {
        message: '创建失败！',
        code: 400
      }
    }
  }

  async findAdvice (id) {
    const advice = await this.ctx.model.Advice.findById(id);
    if (!advice) {
      return { code: -1, message: '导航找不到！' };
    }
    return advice;
  }

  async updateAdvice (id, updates) {
    const advice = await this.ctx.model.Advice.findById(id);
    if (!advice) {
      return { code: -1, message: '导航找不到！' };
    }
    return advice.update(updates);
  }

  async delAdvice (id) {
    const advice = await this.ctx.model.Advice.findById(id);
    if (!advice) {
      return { code: -1, message: '用户找不到！' };
    }
    return { code: 200, message: advice.name + '删除成功！' };
  }
}

module.exports = Advice;