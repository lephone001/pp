'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('egg').Service;

class ArticleCbdService extends Service {
  get articleCbdModel() {
    const { ctx } = this;
    return ctx.model.ArticleCbd || ctx.model.ArticleCBD || ctx.model.articleCbd;
  }

  success(data = {}, message = 'success') {
    return {
      code: 200,
      message,
      data,
    };
  }

  fail(message = 'params error', code = -1) {
    return {
      code,
      message,
    };
  }

  parseBlock(block) {
    if (!block) return {};
    if (typeof block === 'string') {
      const text = block.trim();
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch (e) {
        return {};
      }
    }
    if (typeof block === 'object' && !Array.isArray(block)) return block;
    return {};
  }

  formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  normalizeCacheArticle(item = {}) {
    const id = String(item._id || item.id || '');
    return {
      _id: id,
      title: item.title || '',
      description: item.description || '',
      image: item.image || '',
      createdText: this.formatDate(item.createdAt || item.updatedAt),
      createdAt:item.createdAt,
    };
  }

  pickUpdates(body = {}) {
    const updates = body.updates || body;
    const allowKeys = [ 'title', 'keywords', 'description', 'content', 'image', 'block', 'articleCompany' ];
    const data = {};

    for (const key of allowKeys) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        data[key] = updates[key];
      }
    }

    if (Object.prototype.hasOwnProperty.call(data, 'block')) {
      data.block = this.parseBlock(data.block);
    }

    if (data.articleCompany === '') {
      data.articleCompany = null;
    }

    return data;
  }

  async articleCbdList({
    limit = 20,
    offset = 0,
    page = 1,
    title,
    keywords,
    articleCompany,
  } = {}) {
    const { ctx } = this;
    const criteria = {};

    if (title) criteria.title = new RegExp(title, 'i');
    if (keywords) criteria.keywords = new RegExp(keywords, 'i');
    if (articleCompany) criteria.articleCompany = articleCompany;

    const pageLimit = Math.max(Number(limit) || 20, 1);
    const pageOffset = offset ? Number(offset) || 0 : (Math.max(Number(page) || 1, 1) - 1) * pageLimit;
    const count = await this.articleCbdModel.countDocuments(criteria);
    const rows = await this.articleCbdModel
      .find(criteria)
      .populate({ path: 'articleCompany', select: 'name fileName' })
      .sort({ updatedAt: -1, _id: -1 })
      .skip(pageOffset)
      .limit(pageLimit)
      .lean();

    return this.success({
      data: ctx.service.utils.jiamiFn(rows),
      count,
      limit: pageLimit,
      offset: pageOffset,
    });
  }

  async articleCbdCreate(body = {}) {
    const { ctx } = this;
    if (!body.title) {
      return this.fail('title is required');
    }

    const row = await this.articleCbdModel.create(this.pickUpdates(body));
    return this.success(ctx.service.utils.jiamiFn(row), 'created');
  }

  async articleCbdGetOne(body = {}) {
    const { ctx } = this;
    const id = body.id || body._id;

    if (!id) {
      return this.fail('id is required');
    }

    const row = await this.articleCbdModel
      .findById(id)
      .populate({ path: 'articleCompany', select: 'name fileName' })
      .lean();

    if (!row) {
      return this.fail('not found', -2);
    }

    return this.success(ctx.service.utils.jiamiFn(row));
  }

  async articleCbdUpdate(body = {}) {
    const { ctx } = this;
    const id = body.id || body._id;

    if (!id) {
      return this.fail('id is required');
    }

    const updates = this.pickUpdates(body);
    if (!Object.keys(updates).length) {
      return this.fail('no update data');
    }

    const row = await this.articleCbdModel
      .findByIdAndUpdate(id, { $set: updates }, { new: true })
      .populate({ path: 'articleCompany', select: 'name fileName' })
      .lean();

    if (!row) {
      return this.fail('not found', -2);
    }

    return this.success(ctx.service.utils.jiamiFn(row), 'updated');
  }

  async articleCbdDelete(body = {}) {
    const id = body.id || body._id;

    if (!id) {
      return this.fail('id is required');
    }

    const row = await this.articleCbdModel.findByIdAndDelete(id).lean();
    if (!row) {
      return this.fail('not found', -2);
    }

    return this.success({}, 'deleted');
  }

  async articleCbdRefreshCache(body = {}) {
    const homeLimit = Math.max(Number(body.homeLimit) || 12, 1);
    const redisKey = 'articleCbdList';
    const redisBatchSize = 12;
    const redisLimit = 120;
    const rows = await this.articleCbdModel
      .find({})
      .sort({ _id: -1 })
      .limit(redisLimit)
      .select('title description image createdAt updatedAt')
      .lean();

    const list = rows.map(item => this.normalizeCacheArticle(item));
    const homeList = list.slice(0, homeLimit);
    const lastItem = homeList.length ? homeList[homeList.length - 1] : null;
    const firstItem = homeList.length ? homeList[0] : null;
    const homeData = {
      list: homeList,
      hasMore: rows.length > homeLimit,
      hasPrev: false,
      nextLastId: lastItem ? lastItem._id : '',
      nextLastTitle: lastItem ? lastItem.title : '',
      nextLastDescription: lastItem ? lastItem.description : '',
      prevFirstId: firstItem ? firstItem._id : '',
      cacheTime: Date.now(),
      cacheDate: new Date().toISOString(),
    };

    const cacheDir = path.join(process.cwd(), 'cache', 'article_cbd');
    const cachePath = path.join(cacheDir, 'list_home.json');
    await fs.promises.mkdir(cacheDir, { recursive: true });
    await fs.promises.writeFile(cachePath, JSON.stringify(homeData, null, 2), 'utf8');

    await this.ctx.service.cache.del(redisKey);
    const redisBatchCount = Math.ceil(list.length / redisBatchSize);
    const redisKeys = [];
    for (let index = 1; index <= redisBatchCount; index++) {
      const key = `${redisKey}:${index}`;
      const batch = list.slice((index - 1) * redisBatchSize, index * redisBatchSize);
      await this.ctx.service.cache.set(key, batch);
      redisKeys.push({ key, realKey: `nav-${key}`, count: batch.length });
    }
    await this.ctx.service.cache.set(`${redisKey}:count`, {
      count: redisBatchCount,
      size: redisBatchSize,
      total: list.length,
      cacheTime: Date.now(),
    });

    for (let index = 1; index <= 10; index++) {
      await this.ctx.service.cache.del(`articleCbdArticle-${index}`);
    }

    const redisSavedList = await this.ctx.service.cache.get(`${redisKey}:1`);
    const redisSavedCount = Array.isArray(redisSavedList) ? redisSavedList.length : 0;

    return this.success({
      file: cachePath,
      homeCount: homeList.length,
      redisKey,
      redisDir: `nav-${redisKey}`,
      redisRealKey: `nav-${redisKey}:1`,
      redisCount: list.length,
      redisSavedCount,
      redisBatchCount,
      redisBatchSize,
      redisKeys,
    }, 'cache refreshed');
  }
}

module.exports = ArticleCbdService;
