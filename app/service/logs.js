'use strict';
const Service = require('egg').Service;
const message = {
  c404: {
    code: 404,
    message: '找不到该内容！',
  },
};
class Logs extends Service {
  // 用户列表
  async logsList({ offset = 0, limit = 10, name, sTime, eTime }) {
    const criteria = {};
    if (name) criteria.name = { [this.app.Sequelize.Op.like]: name + '%' };
    // if (sTime && eTime) criteria.createdAt = { [this.app.Sequelize.Op.between]: [new Date(sTime), new Date(eTime)] }
    const queryOptions = {
      // attributes: { exclude: ['password'] },
      offset,
      limit,
      order: [[ 'createdAt', 'desc' ], [ 'id', 'desc' ]],
    };
    if (Object.keys(criteria).length > 0) {
      queryOptions.where = criteria;
    }
    const { count, rows } = await this.ctx.model.Logs.findAndCountAll(queryOptions);
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
  // 用户添加
  async createLogs(o) {
    // console.log(o)
    const [ logs, created ] = await this.ctx.model.Logs.findOrCreate({
      where: { name: o.name },
      // defaults: {
      //     description: '这个人很懒没有留下任何内容！',
      //     password: o.password
      // }
    });
    if (created) {
      return {
        message: '创建成功！',
        code: 200,
      };
    }
    // 用户已经存在
    return {
      message: '导航名称已存在',
      code: 400,
    };

  }

  async findLogs(id) {
    const logs = await this.ctx.model.Logs.findById(id);
    if (!logs) {
      return { code: -1, message: '导航找不到！' };
    }
    return logs;
  }

  async updateLogs(id, updates) {
    const logs = await this.ctx.model.Logs.findById(id);
    if (!logs) {
      return { code: -1, message: '导航找不到！' };
    }
    return logs.update(updates);
  }

  async delLogs(id) {
    const logs = await this.ctx.model.Logs.findById(id);
    if (!logs) {
      return { code: -1, message: '用户找不到！' };
    }
    return { code: 200, message: logs.name + '删除成功！' };
  }
}

module.exports = Logs;
