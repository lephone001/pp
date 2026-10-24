'use strict';
const Service = require('egg').Service;
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const feed = require('../lib/wenzhangFeed');
const { withLock } = require('../lib/advFileStore');
const idOK = value => /^[a-f0-9]{24}$/i.test(String(value || ''));
const presets = require('../lib/wenzhangSources');
const { exclusionReason } = require('../lib/wenzhangPolicy');
class WenzhangService extends Service {
  get root() { return path.join(this.app.baseDir, 'cache/wenzhang'); }
  requireId(id) { if (!idOK(id)) throw new Error('无效的记录 ID'); return String(id); }
  lock(id, action) { return withLock(path.join(this.root, '.locks', this.requireId(id)), action); }
  cachePath(id) {
    id = this.requireId(id);
    const hash = crypto.createHash('md5').update(id).digest('hex');
    return path.join(this.root, hash.slice(0, 2), hash.slice(2, 4), id + '.json');
  }
  legacyCachePath(id) { return path.join(this.root, this.requireId(id) + '.json'); }
  async unlinkCacheFile(file) {
    await fs.unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  async invalidateCache(id) {
    // Remove legacy first so a failed write cannot revive stale data via fallback.
    await this.unlinkCacheFile(this.legacyCachePath(id));
    await this.unlinkCacheFile(this.cachePath(id));
  }
  async cache(row) {
    const id = this.requireId(row._id);
    const file = this.cachePath(id);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = file + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
    try { await fs.writeFile(temp, JSON.stringify(row)); await fs.rename(temp, file); }
    finally { await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    await this.unlinkCacheFile(this.legacyCachePath(id));
  }
  async detail(id) {
    this.requireId(id);
    return this.lock(id, async () => {
      let row;
      try { row = JSON.parse(await fs.readFile(this.cachePath(id), 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
      if (!row) {
        try { row = JSON.parse(await fs.readFile(this.legacyCachePath(id), 'utf8')); }
        catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
        if (row) await this.cache(row);
      }
      if (!row) {
        row = await this.ctx.model.Wenzhang.findById(id).lean();
        if (row) await this.cache(row);
      }
      return row && Number(row.status) === 1 ? row : null;
    });
  }
  async category(id) {
    if (!id) return null;
    this.requireId(id);
    if (!await this.ctx.model.WenzhangCate.exists({ _id: id })) throw new Error('分类不存在');
    return id;
  }
  async publicList(body = {}) {
    const filter = { status: 1 };
    if (body.categoryId) filter.categoryId = this.requireId(body.categoryId);
    const cursor = body.id ? this.requireId(body.id) : '';
    const previous = body.direction === 'prev';
    const criteria = { ...filter };
    if (cursor) criteria._id = previous ? { $gt: cursor } : { $lt: cursor };
    const limit = 20;
    const found = await this.ctx.model.Wenzhang.find(criteria).select('-content')
      .sort({ _id: previous && cursor ? 1 : -1 }).limit(limit + 1).lean();
    const extra = found.length > limit;
    const rows = found.slice(0, limit);
    if (previous && cursor) rows.reverse();
    let hasPrev = false, hasNext = false;
    if (rows.length) {
      if (previous && cursor) {
        hasPrev = extra;
        hasNext = Boolean(await this.ctx.model.Wenzhang.exists({ ...filter, _id: { $lt: rows[rows.length - 1]._id } }));
      } else {
        hasNext = extra;
        hasPrev = Boolean(cursor) && Boolean(await this.ctx.model.Wenzhang.exists({ ...filter, _id: { $gt: rows[0]._id } }));
      }
    }
    return { rows, hasPrev, hasNext };
  }
  async neighbors(id) {
    id = this.requireId(id);
    const fields = '_id title';
    const [ previous, next ] = await Promise.all([
      this.ctx.model.Wenzhang.findOne({ status: 1, _id: { $gt: id } }).select(fields).sort({ _id: 1 }).lean(),
      this.ctx.model.Wenzhang.findOne({ status: 1, _id: { $lt: id } }).select(fields).sort({ _id: -1 }).lean(),
    ]);
    return { previous, next };
  }
  async list(body = {}, publicOnly = false) {
    const filter = { status: { $ne: -1 } };
    if (publicOnly) filter.status = 1;
    else if ([ 0, 1 ].includes(Number(body.status)) && body.status !== '' && body.status !== undefined) filter.status = Number(body.status);
    if (body.categoryId) filter.categoryId = this.requireId(body.categoryId);
    if (body.keyword) filter.title = new RegExp(String(body.keyword).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const page = Math.min(10000, Math.max(1, Number(body.page) || 1));
    const limit = Math.min(50, Math.max(1, Number(body.limit) || 20));
    const [ rows, total ] = await Promise.all([
      this.ctx.model.Wenzhang.find(filter).select('-content').sort({ _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.ctx.model.Wenzhang.countDocuments(filter),
    ]);
    return { rows, total, page, limit };
  }
  async save(body) {
    const id = this.requireId(body._id);
    if (!String(body.title || '').trim()) throw new Error('请填写文章标题');
    const categoryId = await this.category(body.categoryId);
    return this.lock(id, async () => {
      // Invalidate before DB write: cache-write failure must not leave stale published content.
      await this.invalidateCache(id);
      const row = await this.ctx.model.Wenzhang.findOneAndUpdate({ _id: id, status: { $ne: -1 } }, { $set: {
        title: String(body.title).trim().slice(0, 300), description: String(body.description || '').slice(0, 1000),
        content: feed.cleanContent(body.content || '', body.sourceUrl), image: feed.url(body.image),
        categoryId, status: Number(body.status) === 0 ? 0 : 1,
      } }, { new: true, runValidators: true }).lean();
      if (!row) throw new Error('文章不存在');
      await this.cache(row);
      return row;
    });
  }
  async remove(id) {
    return this.lock(id, async () => {
      await this.invalidateCache(id);
      const row = await this.ctx.model.Wenzhang.findByIdAndUpdate(id, { $set: { status: -1 } }, { new: true }).lean();
      if (row) await this.cache(row); // tombstone prevents the next feed poll republishing deleted articles
      return { removed: Boolean(row) };
    });
  }
  async categories() { return this.ctx.model.WenzhangCate.find({}).sort({ sort: 1, _id: -1 }).lean(); }
  async importRemote({ items = [], categories = [], sourceServer }) {
    // Serialize remote imports across workers; article locks also coordinate edits and cache reads.
    return this.lock('000000000000000000000000', async () => {
      const Cate = this.ctx.model.WenzhangCate, Article = this.ctx.model.Wenzhang;
      const key = id => JSON.stringify([sourceServer, this.requireId(id)]);
      for (const remote of categories) {
        const name = String(remote.name || '').trim().slice(0, 100);
        if (!name) throw new Error('远程分类名称为空');
        // Merge equal names while retaining mappings from multiple source servers.
        await Cate.findOneAndUpdate({ name }, {
          $set: { description: String(remote.description || '').slice(0, 500), sort: Number(remote.sort) || 0 },
          $addToSet: { syncKeys: key(remote._id) },
        }, { upsert: true, new: true, runValidators: true });
      }
      let created = 0, updated = 0, failed = 0;
      const errors = [];
      for (const remote of items) {
        try {
          const sourceUrl = feed.url(remote.sourceUrl);
          const title = String(remote.title || '').trim().slice(0, 300);
          if (!sourceUrl || !title) throw new Error('文章缺少有效来源链接或标题');
          let categoryId = null;
          if (remote.categoryId) {
            const category = await Cate.findOne({ syncKeys: key(remote.categoryId) }).lean();
            if (!category) throw new Error('远程文章分类尚未同步');
            categoryId = category._id;
          }
          const existing = await Article.findOne({ sourceUrl }).select('_id').lean();
          const id = existing ? existing._id : new this.app.mongoose.Types.ObjectId();
          const publishedAt = remote.publishedAt ? new Date(remote.publishedAt) : null;
          if (publishedAt && !Number.isFinite(publishedAt.getTime())) throw new Error('文章发布日期无效');
          await this.lock(String(id), async () => {
            await this.invalidateCache(id);
            const row = await Article.findOneAndUpdate({ _id: id }, { $set: {
              title, sourceUrl, categoryId, publishedAt,
              description: String(remote.description || '').slice(0, 1000),
              content: feed.cleanContent(remote.content || '', sourceUrl), image: feed.url(remote.image, sourceUrl),
              sourceName: String(remote.sourceName || '').slice(0, 300),
              status: [-1, 0, 1].includes(Number(remote.status)) ? Number(remote.status) : 1,
              // Source settings are local; never copy a foreign database ID.
              ...(existing ? {} : { sourceId: null }),
            } }, { upsert: true, new: true, runValidators: true }).lean();
            await this.cache(row);
          });
          if (existing) updated++; else created++;
        } catch (error) {
          failed++;
          if (errors.length < 10) errors.push(String(error.message).slice(0, 300));
        }
      }
      return { code: failed ? -1 : 200,
        message: `采集文章同步：新增 ${created} 条，覆盖 ${updated} 条，失败 ${failed} 条${errors.length ? '；' + errors.join('；') : ''}`,
        data: { created, updated, failed } };
    });
  }
  async saveCategory(body) {
    const data = { name: String(body.name || '').trim().slice(0, 100), description: String(body.description || '').slice(0, 500), sort: Number(body.sort) || 0 };
    if (!data.name) throw new Error('请填写分类名称');
    if (!body._id) return this.ctx.model.WenzhangCate.create(data);
    const row = await this.ctx.model.WenzhangCate.findByIdAndUpdate(this.requireId(body._id), { $set: data }, { new: true, runValidators: true }).lean();
    if (!row) throw new Error('分类不存在');
    return row;
  }
  async removeCategory(id) {
    this.requireId(id);
    if (await this.ctx.model.Wenzhang.exists({ categoryId: id, status: { $ne: -1 } }) ||
      await this.ctx.model.WenzhangSource.exists({ categoryId: id })) throw new Error('分类仍有文章或采集源，请先调整分类');
    await this.ctx.model.WenzhangCate.deleteOne({ _id: id });
    return {};
  }
  async sources() { return { rows: await this.ctx.model.WenzhangSource.find({}).sort({ _id: -1 }).lean(), presets }; }
  async saveSource(body) {
    const url = feed.url(body.url), name = String(body.name || '').trim().slice(0, 100);
    if (!url || !name) throw new Error('请填写名称和 HTTP(S) RSS/Atom 地址');
    const data = { name, url, categoryId: await this.category(body.categoryId), enabled: body.enabled !== false,
      auto: body.auto === true, limit: Math.min(50, Math.max(1, Number(body.limit) || 20)) };
    if (!body._id) return this.ctx.model.WenzhangSource.create(data);
    const row = await this.ctx.model.WenzhangSource.findOneAndUpdate({ _id: this.requireId(body._id), runningUntil: { $lte: new Date() } },
      { $set: data }, { new: true, runValidators: true }).lean();
    if (!row) throw new Error('采集源不存在或正在采集，请稍后修改');
    return row;
  }
  async removeSource(id) {
    const result = await this.ctx.model.WenzhangSource.deleteOne({ _id: this.requireId(id), runningUntil: { $lte: new Date() } });
    if (!result.deletedCount) throw new Error('采集源不存在或正在采集');
    return {};
  }
  async collect(id, dailyDate) {
    const filter = { _id: this.requireId(id), enabled: true, runningUntil: { $lte: new Date() } };
    if (dailyDate) { filter.auto = true; filter.lastDate = { $ne: dailyDate }; }
    const lease = new Date(Date.now() + 10 * 60 * 1000);
    const set = { runningUntil: lease, lastRunAt: new Date() };
    if (dailyDate) set.lastDate = dailyDate;
    const source = await this.ctx.model.WenzhangSource.findOneAndUpdate(filter, { $set: set }, { new: true }).lean();
    if (!source) throw new Error('采集源停用、正在采集或今天已自动执行');
    let message = '';
    try {
      const response = await feed.fetchFeed(source.url);
      const rows = feed.parseFeed(response.text, response.url, source.limit);
      let inserted = 0, skipped = 0, failed = 0, filtered = 0;
      const errors = [];
      const deadline = Date.now() + 120000;
      for (const item of rows) {
        if (Date.now() > deadline) { failed += rows.length - inserted - skipped - failed - filtered; errors.push('本次采集达到两分钟处理时限，请稍后重试'); break; }
        if (exclusionReason(item)) { filtered++; continue; }
        try {
          // Existing records are left untouched, preserving editorial changes and deleted state.
          const result = await this.ctx.model.Wenzhang.updateOne({ sourceUrl: item.sourceUrl }, { $setOnInsert: {
            ...item, sourceId: source._id, sourceName: source.name, categoryId: source.categoryId, status: 1,
          } }, { upsert: true });
          const added = result.upsertedCount || (result.upserted && result.upserted.length);
          if (added) inserted++; else skipped++;
          const row = await this.ctx.model.Wenzhang.findOne({ sourceUrl: item.sourceUrl }).select('_id').lean();
          await this.lock(String(row._id), async () => {
            const latest = await this.ctx.model.Wenzhang.findById(row._id).lean();
            if (latest) await this.cache(latest);
          });
        } catch (error) { failed++; errors.push(String(error.message).slice(0, 200)); }
      }
      message = `读取 ${rows.length} 条，新增 ${inserted} 条，已存在 ${skipped} 条，内容过滤 ${filtered} 条，失败 ${failed} 条`;
      return { inserted, skipped, filtered, failed, total: rows.length, errors, message };
    } catch (error) { message = '采集失败：' + error.message; throw error; }
    finally {
      await this.ctx.model.WenzhangSource.updateOne({ _id: source._id, runningUntil: lease },
        { $set: { runningUntil: new Date(0), lastResult: message.slice(0, 1000) } });
    }
  }
  async daily() {
    if (this.ctx.model.WenzhangSource.db.readyState !== 1) return;
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    // Cursor bounds memory even when many sources are configured.
    const cursor = this.ctx.model.WenzhangSource.find({ enabled: true, auto: true, lastDate: { $ne: date } }).select('_id').lean().cursor();
    try {
      for (let row = await cursor.next(); row; row = await cursor.next()) {
        try { await this.collect(String(row._id), date); }
        catch (error) { this.ctx.logger.warn('[wenzhang] source %s: %s', row._id, error.message); }
      }
    } finally { await cursor.close(); }
  }
}
module.exports = WenzhangService;
