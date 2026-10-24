'use strict';

const Service = require('egg').Service;

class AppDownloadService extends Service {
  get appDownloadModel() {
    return this.ctx.model.AppDownload || this.ctx.model.Appdownload || this.ctx.model.appDownload;
  }

  get fallbackCollections() {
    return [ 'addDownload', 'app_download' ];
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

  pickUpdates(body = {}) {
    const updates = body.updates || body;
    const allowKeys = [
      'index',
      'name',
      'view',
      'star',
      'url',
      'image',
      'iosUrl',
      'desc',
      'isBt',
      'type',
      'isHot',
      'isNew',
      'isTop',
      'sort',
      'user',
      'status',
      'createTime',
      'updateTime',
      'id',
      'keywords',
      'description',
      'content',
      'title',
    ];
    const data = {};

    for (const key of allowKeys) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        data[key] = updates[key];
      }
    }

    return data;
  }

  getObjectId(id) {
    return this.ctx.app.mongoose.Types.ObjectId(id);
  }

  async findFallbackRows(criteria, sort, pageOffset, pageLimit) {
    const { ctx } = this;

    for (const collectionName of this.fallbackCollections) {
      const collection = ctx.app.mongoose.connection.collection(collectionName);
      const count = await collection.countDocuments(criteria);
      if (!count) continue;

      const rows = await collection
        .find(criteria)
        .sort(sort)
        .skip(pageOffset)
        .limit(pageLimit)
        .toArray();

      return { rows, count, collectionName };
    }

    return { rows: [], count: 0, collectionName: '' };
  }

  async findFallbackById(id) {
    const objectId = this.getObjectId(id);

    for (const collectionName of this.fallbackCollections) {
      const collection = this.ctx.app.mongoose.connection.collection(collectionName);
      const row = await collection.findOne({ _id: objectId });
      if (row) return { row, collectionName, collection };
    }

    return { row: null, collectionName: '', collection: null };
  }

  async appDownloadList({
    limit = 20,
    offset = 0,
    page = 1,
    name,
    index,
    type,
    status,
    isHot,
    isTop,
  } = {}) {
    const { ctx } = this;
    const criteria = {};

    if (name) criteria.name = new RegExp(name, 'i');
    if (index) criteria.index = new RegExp(index, 'i');
    if (type !== undefined && type !== '') criteria.type = Number(type);
    if (status !== undefined && status !== '') criteria.status = Number(status);
    if (isHot !== undefined && isHot !== '') criteria.isHot = Number(isHot);
    if (isTop !== undefined && isTop !== '') criteria.isTop = Number(isTop);

    const pageLimit = Math.max(Number(limit) || 20, 1);
    const pageOffset = offset ? Number(offset) || 0 : (Math.max(Number(page) || 1, 1) - 1) * pageLimit;
    const sort = { sort: -1, updatedAt: -1, _id: -1 };
    let count = await this.appDownloadModel.countDocuments(criteria);
    let rows = await this.appDownloadModel
      .find(criteria)
      .sort(sort)
      .skip(pageOffset)
      .limit(pageLimit)
      .lean();

    if (!count) {
      const fallback = await this.findFallbackRows(criteria, sort, pageOffset, pageLimit);
      count = fallback.count;
      rows = fallback.rows.map(item => ({
        ...item,
        _sourceCollection: fallback.collectionName,
      }));
    }

    return this.success({
      data: ctx.service.utils.jiamiFn(rows),
      count,
      limit: pageLimit,
      offset: pageOffset,
    });
  }

  async appDownloadCreate(body = {}) {
    const { ctx } = this;

    if (!body.name) {
      return this.fail('name is required');
    }

    const data = this.pickUpdates(body);
    if (!data.id) data.id = Date.now();
    if (!data.createTime) data.createTime = new Date().toString();
    if (!data.updateTime) data.updateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const result = await this.appDownloadModel.collection.insertOne(data);
    const row = await this.appDownloadModel.findById(result.insertedId).lean();
    return this.success(ctx.service.utils.jiamiFn(row), 'created');
  }

  async appDownloadGetOne(body = {}) {
    const { ctx } = this;
    const id = body.id || body._id;

    if (!id) {
      return this.fail('id is required');
    }

    const row = await this.appDownloadModel.findById(id).lean();
    if (!row) {
      const fallback = await this.findFallbackById(id);
      if (!fallback.row) return this.fail('not found', -2);
      return this.success(ctx.service.utils.jiamiFn({
        ...fallback.row,
        _sourceCollection: fallback.collectionName,
      }));
    }

    return this.success(ctx.service.utils.jiamiFn(row));
  }

  async appDownloadUpdate(body = {}) {
    const { ctx } = this;
    const id = body._id || body.mongoId;

    if (!id) {
      return this.fail('_id is required');
    }

    const updates = this.pickUpdates(body);
    updates.updateTime = updates.updateTime || new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (!Object.keys(updates).length) {
      return this.fail('no update data');
    }

    let row = await this.appDownloadModel.findById(id).lean();
    if (row) {
      await this.appDownloadModel.collection.updateOne(
        { _id: this.getObjectId(id) },
        { $set: updates }
      );
      row = await this.appDownloadModel.findById(id).lean();
    } else {
      const fallback = await this.findFallbackById(id);
      if (fallback.collection) {
        await fallback.collection.updateOne(
          { _id: this.getObjectId(id) },
          { $set: updates }
        );
        row = await fallback.collection.findOne({ _id: this.getObjectId(id) });
        if (row) row._sourceCollection = fallback.collectionName;
      }
    }

    if (!row) {
      return this.fail('not found', -2);
    }

    return this.success(ctx.service.utils.jiamiFn(row), 'updated');
  }

  async appDownloadDelete(body = {}) {
    const id = body._id || body.id;

    if (!id) {
      return this.fail('id is required');
    }

    let row = await this.appDownloadModel.findByIdAndDelete(id).lean();
    if (!row) {
      const fallback = await this.findFallbackById(id);
      if (fallback.collection) {
        row = fallback.row;
        await fallback.collection.deleteOne({ _id: this.getObjectId(id) });
      }
    }
    if (!row) {
      return this.fail('not found', -2);
    }

    return this.success({}, 'deleted');
  }

  async appDownloadStatus(body = {}) {
    const { ctx } = this;
    const id = body._id || body.id;
    const status = Number(body.status);

    if (!id || Number.isNaN(status)) {
      return this.fail('id or status is required');
    }

    const statusUpdate = { status, updateTime: new Date().toISOString().slice(0, 19).replace('T', ' ') };
    let row = await this.appDownloadModel.findById(id).lean();
    if (row) {
      await this.appDownloadModel.collection.updateOne(
        { _id: this.getObjectId(id) },
        { $set: statusUpdate }
      );
      row = await this.appDownloadModel.findById(id).lean();
    } else {
      const fallback = await this.findFallbackById(id);
      if (fallback.collection) {
        await fallback.collection.updateOne(
          { _id: this.getObjectId(id) },
          { $set: statusUpdate }
        );
        row = await fallback.collection.findOne({ _id: this.getObjectId(id) });
        if (row) row._sourceCollection = fallback.collectionName;
      }
    }

    if (!row) {
      return this.fail('not found', -2);
    }

    return this.success(ctx.service.utils.jiamiFn(row), 'status updated');
  }
  async addDownloadList(body = {}) {
    return this.appDownloadList(body);
  }

  async addDownloadCreate(body = {}) {
    return this.appDownloadCreate(body);
  }

  async addDownloadGetOne(body = {}) {
    return this.appDownloadGetOne(body);
  }

  async addDownloadUpdate(body = {}) {
    return this.appDownloadUpdate(body);
  }

  async addDownloadDelete(body = {}) {
    return this.appDownloadDelete(body);
  }

  async addDownloadStatus(body = {}) {
    return this.appDownloadStatus(body);
  }
}

module.exports = AppDownloadService;
