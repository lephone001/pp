'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const Service = require('../app/service/wenzhang');
const Domain = require('../app/service/domain');
const query = value => ({ select() { return this; }, lean: async () => value });
async function main() {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenzhang-sync-'));
  const categories = [], articles = [];
  const Cate = {
    async findOneAndUpdate(filter, update) {
      let row = categories.find(c => c.name === filter.name);
      if (!row) { row = { _id: String(new mongoose.Types.ObjectId()), name: filter.name, syncKeys: [] }; categories.push(row); }
      Object.assign(row, update.$set);
      if (!row.syncKeys.includes(update.$addToSet.syncKeys)) row.syncKeys.push(update.$addToSet.syncKeys);
      return row;
    },
    findOne: filter => query(categories.find(c => c.syncKeys.includes(filter.syncKeys))),
  };
  const Article = {
    findOne: filter => query(articles.find(a => a.sourceUrl === filter.sourceUrl)),
    findOneAndUpdate(filter, update) {
      let row = articles.find(a => String(a._id) === String(filter._id));
      if (!row) { row = { _id: String(filter._id) }; articles.push(row); }
      Object.assign(row, update.$set); return query(row);
    },
    findById: id => query(articles.find(a => String(a._id) === String(id))),
  };
  const service = Object.create(Service.prototype);
  service.app = { baseDir, mongoose };
  service.ctx = { model: { Wenzhang: Article, WenzhangCate: Cate } };
  const domain = Object.create(Domain.prototype);
  domain.ctx = { model: service.ctx.model, service: { wenzhang: service } };
  const remoteId = '507f1f77bcf86cd799439011';
  const sourceServer = 'https://source.example';
  const run = args => domain.executeContentSyncImport({ type: 'wenzhang', sourceServer, items: [], categories: [], ...args });
  try {
    assert.equal(domain.getContentSyncConfig('wenzhang').itemModel, Article);
    await run({ categories: [{ _id: remoteId, name: 'Technology' }] });
    await run({ sourceServer: 'https://second.example', categories: [{ _id: remoteId, name: 'Technology' }] });
    assert.equal(categories.length, 1, 'merge same category name across servers');
    assert.equal(categories[0].syncKeys.length, 2, 'preserve both source category mappings');
    const remote = { _id: remoteId, title: 'First', sourceUrl: 'https://news.example/1', categoryId: remoteId,
      content: '<p>Hello</p><script>bad()</script>', sourceId: remoteId, status: 1 };
    assert.equal((await run({ items: [remote] })).data.created, 1);
    const id = articles[0]._id;
    assert.equal(articles[0].categoryId, categories[0]._id);
    assert.equal(articles[0].sourceId, null);
    assert(!articles[0].content.includes('script'));
    assert.equal((await service.detail(id)).title, 'First');
    assert.equal((await run({ items: [{ ...remote, title: 'Updated' }] })).data.updated, 1);
    assert.equal(articles.length, 1, 'repeat sync deduplicates by source URL');
    assert.equal((await service.detail(id)).title, 'Updated', 'existing JSON cache refreshed');
    await run({ items: [{ ...remote, status: 0 }] });
    assert.equal(await service.detail(id), null, 'hidden articles stay hidden in cache');
    assert.equal((await run({ items: [{ ...remote, sourceUrl: '' }] })).code, -1);
    const cache = service.cache;
    service.cache = async () => { throw new Error('disk full'); };
    assert.equal((await run({ items: [remote] })).code, -1, 'cache failure cannot report success');
    assert(!fs.existsSync(service.cachePath(id)), 'no stale sharded cache after failure');
    assert(!fs.existsSync(service.legacyCachePath(id)), 'no stale legacy cache after failure');
    service.cache = cache;
    await domain.finalizeContentCategoryRelations({ type: 'wenzhang', categories: [], sourceServer });
    console.log('wenzhang remote sync: PASS');
  } finally { fs.rmSync(baseDir, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
