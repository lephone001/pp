'use strict';
const Service = require('egg').Service;
const message = {
  c404: {
    code: 404,
    message: '找不到该内容！'
  }
}
class ArticleComments extends Service {
  //用户列表
  async articleCommentsList ({ offset = 0, limit = 10, name, sTime, eTime }) {
    let criteria = {}
    if (name) criteria.name = { [this.app.Sequelize.Op.like]: name + "%" }
    // if (sTime && eTime) criteria.createdAt = { [this.app.Sequelize.Op.between]: [new Date(sTime), new Date(eTime)] }
    let queryOptions = {
      // attributes: { exclude: ['password'] },
      offset,
      limit,
      order: [['createdAt', 'desc'], ['id', 'desc']],
    }
    if (Object.keys(criteria).length > 0) {
      queryOptions.where = criteria
    }
    let { count, rows } = await this.ctx.model.ArticleComments.findAndCountAll(queryOptions);
    return {
      code: 200,
      data: {
        data: rows,
        count,
        limit,
        offset
      }
    }
  }
  //用户添加
  async createArticleComments (o) {
    // console.log(o)
    const [articleComments, created] = await this.ctx.model.ArticleComments.findOrCreate({
      where: { name: o.name },
      // defaults: {
      //     description: '这个人很懒没有留下任何内容！',
      //     password: o.password
      // }
    });
    if (created) {
      return {
        message: '创建成功！',
        code: 200
      }
    } else {
      //用户已经存在
      return {
        message: '导航名称已存在',
        code: 400
      }
    }
  }

  async findArticleComments (id) {
    const articleComments = await this.ctx.model.ArticleComments.findById(id);
    if (!articleComments) {
      return { code: -1, message: '导航找不到！' };
    }
    return articleComments;
  }

  async updateArticleComments (id, updates) {
    const articleComments = await this.ctx.model.ArticleComments.findById(id);
    if (!articleComments) {
      return { code: -1, message: '导航找不到！' };
    }
    return articleComments.update(updates);
  }

  async delArticleComments (id) {
    const articleComments = await this.ctx.model.ArticleComments.findById(id);
    if (!articleComments) {
      return { code: -1, message: '用户找不到！' };
    }
    return { code: 200, message: articleComments.name + '删除成功！' };
  }
}

module.exports = ArticleComments;