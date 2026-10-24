'use strict';

const Service = require('egg').Service;
const axios = require('axios').default;
const isObjectId = value => /^[a-fA-F0-9]{24}$/.test(String(value || ''));
const asNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const firstValue = (...values) => values.find(value => value !== undefined && value !== null && String(value).trim() !== '') || '';
const normalizeScheduleTime = (value, fallback = '03:00') => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};
const normalizeCollectType = value => [ 'video', 'book', 'image' ].includes(String(value || '').toLowerCase())
  ? String(value).toLowerCase()
  : 'video';

class CollectSourceService extends Service {
  collectorFor(target) {
    return Number(target && (target.siteType || target)) === 8
      ? this.ctx.service.videoCollector
      : this.ctx.service.movieCollector;
  }

  async ensureVideoPlatform(source) {
    if (!source || Number(source.siteType) !== 8) return null;
    return this.ctx.service.videoCollector.ensurePlatform(source);
  }

  async recoverStaleTasks(sourceId) {
    const query = {
      status: { $in: [ 'pending', 'running' ] },
      $or: [
        { maxPages: { $lte: 0 }, endPage: { $lte: 0 }, allPages: { $ne: true } },
        { status: 'pending', createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } },
        { status: 'running', heartbeatAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) } },
        { status: 'running', heartbeatAt: { $exists: false }, startedAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) } },
      ],
    };
    if (isObjectId(sourceId)) query.sourceId = sourceId;
    await this.ctx.model.CollectTask.updateMany(query, {
      $set: { status: 'failed', message: '采集任务超时', error: '任务长时间没有心跳，已自动释放', finishedAt: new Date() },
    });
  }

  async list(params = {}) {
    const query = { siteType: asNumber(params.siteType, 11) };
    if (params.status !== undefined && params.status !== '') query.status = asNumber(params.status);
    const rows = await this.ctx.model.CollectSource.find(query).sort({ sort: 1, _id: -1 }).lean();
    const data = await Promise.all(rows.map(async row => {
      const sourceIds = [ String(row._id), String(row.code || '').trim() ].filter((item, index, list) => item && list.indexOf(item) === index);
      const videoTarget = Number(row.siteType) === 8;
      const collectType = normalizeCollectType(row.collectType);
      let videoPlatformId = row.videoPlatformId;
      if (videoTarget) {
        const platform = await this.ensureVideoPlatform(row);
        videoPlatformId = platform && platform._id || videoPlatformId;
      }
      const videoCount = videoTarget ? await this.ctx.model.Video.countDocuments({ collectSourceId: String(row._id), status: { $ne: 0 } }) : 0;
      const bookCount = videoTarget ? await this.ctx.model.VideoBook.countDocuments({ collectSourceId: String(row._id), status: { $ne: 0 } }) : 0;
      const imageCount = videoTarget ? await this.ctx.model.VideoImage.countDocuments({ collectSourceId: String(row._id), status: { $ne: 0 } }) : 0;
      return {
        ...row,
        movieCount: videoTarget ? 0 : await this.ctx.model.Movie.countDocuments({ sourceId: { $in: sourceIds }, siteType: 11, status: { $ne: 0 } }),
        videoCount,
        bookCount,
        imageCount,
        resourceCount: videoTarget
          ? (collectType === 'book' ? bookCount : collectType === 'image' ? imageCount : videoCount + bookCount + imageCount)
          : 0,
        videoPlatformId,
      };
    }));
    return { code: 200, data: { data, count: data.length } };
  }

  normalizeVideoSyncSource(input = {}) {
    const name = String(input.name || '').trim();
    const url = String(input.url || '').trim();
    const code = String(input.code || name).trim().toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-');
    if (!name || !url || !code) return null;
    const format = String(input.format || 'xml').toLowerCase();
    return {
      siteType: 8,
      collectType: normalizeCollectType(input.collectType),
      name,
      code,
      url,
      format: [ 'json', 'html' ].includes(format) ? format : 'xml',
      method: String(input.method || 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET',
      status: asNumber(input.status, 1),
      pageParam: input.pageParam || 'pg',
      pageSizeParam: input.pageSizeParam || 'limit',
      pageSize: Math.min(100, Math.max(1, asNumber(input.pageSize, 20))),
      concurrency: Math.min(32, Math.max(1, asNumber(input.concurrency, 8) || 8)),
      listPath: input.listPath || '',
      headers: input.headers || {},
      params: input.params || {},
      parser: input.parser || {},
      remoteCategories: Array.isArray(input.remoteCategories) ? input.remoteCategories : [],
      remoteCategoriesFetchedAt: input.remoteCategoriesFetchedAt || null,
      sort: asNumber(input.sort),
      scheduleEnabled: asNumber(input.scheduleEnabled, 0) === 1 ? 1 : 0,
      scheduleTime: normalizeScheduleTime(input.scheduleTime),
      schedulePages: Math.min(1000, Math.max(1, asNumber(input.schedulePages, 10) || 10)),
    };
  }

  async videoSyncList({ password } = {}) {
    const domainService = this.ctx.service.domain;
    if (!domainService.getDomainSyncKey()) return { code: -1, message: '远程服务器未配置 DOMAIN_SYNC_KEY！' };
    if (!domainService.isDomainSyncPasswordValid(password)) return { code: -1, message: '同步密码错误！' };
    const rows = await this.ctx.model.CollectSource.find({ siteType: 8 }).sort({ sort: 1, _id: -1 }).lean();
    if (rows.length > 5000) return { code: -1, message: '视频采集源超过 5000 条，已停止同步！' };
    const sources = rows.map(row => this.normalizeVideoSyncSource(row)).filter(Boolean);
    return { code: 200, message: `读取到 ${sources.length} 个视频采集源`, data: { sources, count: sources.length } };
  }

  async videoSync({ serverUrl, password } = {}) {
    if (!/^https?:\/\//i.test(String(serverUrl || '')) || !String(password || '')) {
      return { code: -1, message: '请填写正确的远程服务器地址和同步密码！' };
    }
    let remoteUrl;
    try {
      remoteUrl = String(serverUrl).trim().replace(/\/+$/, '');
      if (!/\/api\/tongbuVideoCollectSourceList$/i.test(remoteUrl)) remoteUrl += '/api/tongbuVideoCollectSourceList';
      remoteUrl = new URL(remoteUrl).toString();
    } catch (error) {
      return { code: -1, message: '远程服务器地址格式错误！' };
    }

    let remoteResponse;
    try {
      remoteResponse = await axios.post(remoteUrl, { password }, {
        timeout: 60000,
        maxContentLength: 20 * 1024 * 1024,
        maxBodyLength: 20 * 1024 * 1024,
      });
    } catch (error) {
      return { code: -1, message: `远程服务器连接失败：${error.message}` };
    }
    const remoteData = remoteResponse && remoteResponse.data;
    if (!remoteData || remoteData.code !== 200) {
      return { code: -1, message: remoteData && remoteData.message ? remoteData.message : '远程服务器返回的数据无效！' };
    }
    const rows = remoteData.data && Array.isArray(remoteData.data.sources) ? remoteData.data.sources : [];
    if (rows.length > 5000) return { code: -1, message: '远程视频采集源超过 5000 条，已停止同步！' };

    let created = 0;
    let updated = 0;
    const failed = [];
    for (const remoteRow of rows) {
      const source = this.normalizeVideoSyncSource(remoteRow);
      if (!source) {
        failed.push({ code: remoteRow && remoteRow.code || '', message: '名称、编码或接口地址为空' });
        continue;
      }
      try {
        const existing = await this.ctx.model.CollectSource.findOne({ siteType: 8, code: source.code }).select('_id').lean();
        let saved;
        if (existing) {
          saved = await this.ctx.model.CollectSource.findByIdAndUpdate(existing._id, {
            $set: { ...source, scheduleLastDate: '' },
          }, { new: true, runValidators: true }).lean();
          updated += 1;
        } else {
          saved = await this.ctx.model.CollectSource.create(source);
          created += 1;
        }
        await this.ensureVideoPlatform(saved && saved.toObject ? saved.toObject() : saved);
      } catch (error) {
        failed.push({ code: source.code, message: error.message });
      }
    }
    return {
      code: 200,
      message: `视频采集源同步完成：新增 ${created} 个，覆盖 ${updated} 个，失败 ${failed.length} 个`,
      data: { created, updated, failed, total: rows.length },
    };
  }

  async create(input = {}) {
    if (!input.name || !input.url) return { code: -1, message: '采集源名称和接口地址不能为空' };
    const format = String(input.format || 'xml').toLowerCase();
    const data = {
      siteType: asNumber(input.siteType, 11), collectType: normalizeCollectType(input.collectType), name: String(input.name).trim(),
      code: String(input.code || input.name).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-'),
      url: String(input.url).trim(),
      format: [ 'json', 'html' ].includes(format) ? format : 'xml',
      method: String(input.method || 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET',
      status: asNumber(input.status, 1), pageParam: input.pageParam || 'pg', pageSizeParam: input.pageSizeParam || 'limit',
      pageSize: Math.min(100, Math.max(1, asNumber(input.pageSize, 20))), listPath: input.listPath || '',
      concurrency: Math.min(32, Math.max(1, asNumber(input.concurrency, 8) || 8)),
      headers: input.headers || {}, params: input.params || {}, parser: input.parser || {}, sort: asNumber(input.sort),
      scheduleEnabled: asNumber(input.scheduleEnabled, 0) === 1 ? 1 : 0,
      scheduleTime: normalizeScheduleTime(input.scheduleTime),
      schedulePages: Math.min(1000, Math.max(1, asNumber(input.schedulePages, 10) || 10)),
    };
    try {
      const row = await this.ctx.model.CollectSource.create(data);
      if (data.siteType === 8) {
        const platform = await this.ensureVideoPlatform(row.toObject ? row.toObject() : row);
        if (platform) row.videoPlatformId = platform._id;
      }
      return { code: 200, data: row };
    } catch (error) {
      if (error && error.code === 11000) return { code: -1, message: '采集源 code 已存在' };
      throw error;
    }
  }

  async update(id, input = {}) {
    if (!isObjectId(id)) return { code: -1, message: '采集源 ID 无效' };
    const allowed = [ 'siteType', 'collectType', 'name', 'code', 'url', 'format', 'method', 'status', 'pageParam', 'pageSizeParam', 'pageSize', 'concurrency', 'listPath', 'headers', 'params', 'parser', 'sort', 'scheduleEnabled', 'scheduleTime', 'schedulePages' ];
    const updates = {};
    allowed.forEach(key => { if (input[key] !== undefined) updates[key] = input[key]; });
    [ 'siteType', 'status', 'pageSize', 'concurrency', 'sort', 'scheduleEnabled', 'schedulePages' ].forEach(key => { if (updates[key] !== undefined) updates[key] = asNumber(updates[key]); });
    if (updates.collectType !== undefined) updates.collectType = normalizeCollectType(updates.collectType);
    if (updates.concurrency !== undefined) updates.concurrency = Math.min(32, Math.max(1, updates.concurrency || 8));
    if (updates.scheduleEnabled !== undefined) updates.scheduleEnabled = updates.scheduleEnabled === 1 ? 1 : 0;
    if (updates.scheduleTime !== undefined) updates.scheduleTime = normalizeScheduleTime(updates.scheduleTime);
    if (updates.schedulePages !== undefined) updates.schedulePages = Math.min(1000, Math.max(1, updates.schedulePages || 10));
    if (updates.scheduleEnabled !== undefined || updates.scheduleTime !== undefined || updates.schedulePages !== undefined) updates.scheduleLastDate = '';
    if (updates.format) updates.format = [ 'json', 'html' ].includes(String(updates.format).toLowerCase()) ? String(updates.format).toLowerCase() : 'xml';
    if (updates.method) updates.method = String(updates.method).toUpperCase() === 'POST' ? 'POST' : 'GET';
    if (updates.url !== undefined || updates.format !== undefined || updates.listPath !== undefined) {
      updates.remoteCategories = [];
      updates.remoteCategoriesFetchedAt = null;
    }
    const row = await this.ctx.model.CollectSource.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).lean();
    if (row && Number(row.siteType) === 8) await this.ensureVideoPlatform(row);
    return row ? { code: 200, data: row } : { code: 404, message: '采集源不存在' };
  }

  async categoryMappings(id) {
    if (!isObjectId(id)) return { code: -1, message: '采集源 ID 无效' };
    const source = await this.ctx.model.CollectSource.findById(id).lean();
    if (!source) return { code: 404, message: '采集源不存在' };
    if (Number(source.siteType) === 8) {
      const categories = await this.ctx.model.VideoCategory.find({ status: 1 }).sort({ name: 1, _id: 1 }).lean();
      return { code: 200, data: { source, mappings: source.videoCategoryMappings || [], categories } };
    }
    const categories = await this.ctx.model.MovieCategory.find({ siteType: 11, status: 1 }).sort({ sort: 1, _id: 1 }).lean();
    return { code: 200, data: { source, mappings: source.categoryMappings || [], categories } };
  }

  async updateCategoryMappings(id, mappings = []) {
    if (!isObjectId(id)) return { code: -1, message: '采集源 ID 无效' };
    if (!Array.isArray(mappings)) return { code: -1, message: '分类绑定数据格式错误' };
    const sourceTarget = await this.ctx.model.CollectSource.findById(id).select('siteType').lean();
    if (!sourceTarget) return { code: 404, message: '采集源不存在' };
    if (Number(sourceTarget.siteType) === 8) {
      const videoCategories = await this.ctx.model.VideoCategory.find({ status: 1 }).lean();
      const categoryMap = new Map(videoCategories.map(item => [ String(item._id), item ]));
      const videoMappings = mappings.map(item => {
        const category = item.localCategoryId && categoryMap.get(String(item.localCategoryId));
        return {
          remoteId: String(item.remoteId || '').trim(),
          remoteName: String(item.remoteName || '').trim(),
          localCategoryId: category ? category._id : (isObjectId(item.localCategoryId) ? item.localCategoryId : null),
          localName: category ? category.name : String(item.localName || '').trim(),
          status: Number(item.status) === 0 ? 0 : 1,
        };
      }).filter(item => item.remoteId || item.remoteName);
      const videoSource = await this.ctx.model.CollectSource.findByIdAndUpdate(id, { $set: { videoCategoryMappings: videoMappings } }, { new: true }).lean();
      return videoSource ? { code: 200, data: videoSource.videoCategoryMappings || [], message: '分类绑定已保存' } : { code: 404, message: '采集源不存在' };
    }
    const categories = await this.ctx.model.MovieCategory.find({ siteType: 11, status: 1 }).lean();
    const categoryMap = new Map(categories.map(item => [ String(item._id), item ]));
    const normalized = mappings.map(item => {
      const category = item.localCategoryId && categoryMap.get(String(item.localCategoryId));
      return {
        remoteId: String(item.remoteId || '').trim(),
        remoteName: String(item.remoteName || '').trim(),
        localCategoryId: category ? category._id : null,
        localTypeId: category ? String(category.typeId) : String(item.localTypeId || '').trim(),
        localName: category ? category.name : String(item.localName || '').trim(),
        status: Number(item.status) === 0 ? 0 : 1,
      };
    }).filter(item => item.remoteId || item.remoteName);
    const source = await this.ctx.model.CollectSource.findByIdAndUpdate(id, { $set: { categoryMappings: normalized } }, { new: true }).lean();
    return source ? { code: 200, data: source.categoryMappings || [], message: '分类绑定已保存' } : { code: 404, message: '采集源不存在' };
  }

  async remoteCategories(id, options = {}) {
    if (!isObjectId(id)) return { code: -1, message: '采集源 ID 无效' };
    const source = await this.ctx.model.CollectSource.findById(id).lean();
    if (!source) return { code: 404, message: '采集源不存在' };
    const isVideo = Number(source.siteType) === 8;
    const force = options && (options.force === true || options.refresh === true);
    try {
      const collector = this.collectorFor(source);
      const cachedRows = Array.isArray(source.remoteCategories) ? source.remoteCategories.map(item => ({
        id: String(item.remoteId || '').trim(), name: String(item.remoteName || '').trim(), parentId: String(item.parentId || '').trim(),
      })).filter(item => item.id || item.name) : [];
      const cachedHasHierarchy = Array.isArray(source.remoteCategories)
        && source.remoteCategories.some(item => Object.prototype.hasOwnProperty.call(item, 'parentId') && String(item.parentId || '').trim() !== '');
      const fallbackRows = !force && cachedRows.length && cachedHasHierarchy ? cachedRows : await (async () => {
        const payload = await collector.fetchSource(source, 1);
        const rows = collector.extractCategories(payload);
        return rows.length ? rows : collector.extractRowCategories(payload, source);
      })();
      if (!fallbackRows.length) {
        return { code: -1, data: [], message: 'Remote interface returned no recognizable categories. Check the source format or add mappings manually.' };
      }
      const categoryRows = isVideo
        ? await this.syncVideoRemoteCategories(source, fallbackRows)
        : await this.syncRemoteCategories(source, fallbackRows);
      return { code: 200, data: categoryRows.categories, mappings: categoryRows.mappings, categories: categoryRows.localCategories, cached: cachedRows.length > 0 };
    } catch (error) {
      this.ctx.logger.warn(`[${isVideo ? 'video' : 'movie'}] remote categories failed: ${error.message}`);
      return { code: -1, data: [], message: `Remote category request failed: ${error.message}` };
    }
  }

  async syncRemoteCategories(source, rows) {
    const mappings = Array.isArray(source.categoryMappings) ? source.categoryMappings.map(item => ({ ...item })) : [];
    const mappingByRemoteId = new Map(mappings.filter(item => item.remoteId).map(item => [ String(item.remoteId), item ]));
    const normalizedRows = [];
    for (const row of rows) {
      const remoteId = String(row.id || row.remoteId || '').trim();
      const remoteName = String(row.name || row.remoteName || '').trim();
      const parentIdValue = firstValue(row.parentId, row.parent_id, row.type_pid, row.typePid);
      const parentId = String(parentIdValue).trim() || '0';
      if (!remoteId && !remoteName) continue;
      const key = remoteId || `name:${remoteName}`;
      if (normalizedRows.some(item => item.key === key)) continue;
      normalizedRows.push({ key, remoteId, remoteName, parentId });

      const typeId = remoteId || `remote_${Buffer.from(remoteName).toString('hex').slice(0, 24)}`;
      const categoryUpdate = {
        $set: { parentId },
        $setOnInsert: { siteType: 11, typeId, name: remoteName, sort: Number(remoteId) || 0, status: 1 },
      };
      if (remoteName) categoryUpdate.$set.name = remoteName;
      let category;
      try {
        category = await this.ctx.model.MovieCategory.findOne({ siteType: 11, typeId }).lean();
        if (!category && remoteName) {
          category = await this.ctx.model.MovieCategory.findOne({ siteType: 11, name: remoteName }).sort({ _id: 1 }).lean();
        }
        if (category) {
          category = await this.ctx.model.MovieCategory.findOneAndUpdate({ _id: category._id }, { $set: categoryUpdate.$set }, { new: true }).lean();
        } else {
          category = await this.ctx.model.MovieCategory.findOneAndUpdate(
            { siteType: 11, typeId }, categoryUpdate,
            { upsert: true, new: true, setDefaultsOnInsert: true }
          ).lean();
        }
      } catch (error) {
        if (error && error.code === 11000) category = await this.ctx.model.MovieCategory.findOne({ siteType: 11, typeId }).lean();
        else throw error;
      }
      if (!category) continue;
      const existing = mappingByRemoteId.get(remoteId);
      const mapping = existing || {};
      mapping.remoteId = remoteId;
      mapping.remoteName = remoteName;
      mapping.localCategoryId = mapping.localCategoryId || category._id;
      mapping.localTypeId = String(mapping.localTypeId || category.typeId);
      mapping.localName = String(mapping.localName || category.name);
      mapping.status = Number(mapping.status) === 0 ? 0 : 1;
      if (!existing) mappings.push(mapping);
    }
    const remoteCategories = normalizedRows.map(item => ({ remoteId: item.remoteId, remoteName: item.remoteName, parentId: item.parentId }));
    const saved = await this.ctx.model.CollectSource.findByIdAndUpdate(source._id, {
      $set: { remoteCategories, remoteCategoriesFetchedAt: new Date(), categoryMappings: mappings },
    }, { new: true }).lean();
    const allLocalCategories = await this.ctx.model.MovieCategory.find({ siteType: 11, status: 1 }).sort({ sort: 1, _id: 1 }).lean();
    return {
      categories: normalizedRows.map(item => ({ id: item.remoteId, name: item.remoteName, parentId: item.parentId })),
      mappings: saved && saved.categoryMappings || mappings,
      localCategories: allLocalCategories,
    };
  }

  async syncVideoRemoteCategories(source, rows) {
    const platform = await this.ensureVideoPlatform(source);
    if (!platform) return { categories: [], mappings: [], localCategories: [] };
    const categoryType = source.collectType === 'image' ? 1 : (source.collectType === 'book' ? 2 : 0);
    const mappings = Array.isArray(source.videoCategoryMappings) ? source.videoCategoryMappings.map(item => ({ ...item })) : [];
    const mappingByRemoteId = new Map(mappings.filter(item => item.remoteId).map(item => [ String(item.remoteId), item ]));
    const normalizedRows = [];
    for (const row of rows) {
      const remoteId = String(row.id || row.remoteId || '').trim();
      const remoteName = String(row.name || row.remoteName || '').trim();
      const parentId = String(firstValue(row.parentId, row.parent_id, row.type_pid, row.typePid)).trim() || '0';
      if (!remoteId && !remoteName) continue;
      const key = remoteId || `name:${remoteName}`;
      if (normalizedRows.some(item => item.key === key)) continue;
      normalizedRows.push({ key, remoteId, remoteName, parentId });
      const copyid = remoteId || `remote_${Buffer.from(remoteName).toString('hex').slice(0, 24)}`;
      const categoryValues = {
        name: remoteName || copyid,
        typeName: remoteName || copyid,
        type: categoryType,
        status: 1,
        remoteParentId: parentId,
        collectSourceId: String(source._id),
        fromObj: { source: 'video-collector', collectSourceId: String(source._id), remoteId, parentId },
      };
      let category = await this.ctx.model.VideoCategory.findOne({ pid: platform._id, copyid }).lean();
      if (!category && remoteName) {
        category = await this.ctx.model.VideoCategory.findOne({ pid: platform._id, name: remoteName, type: categoryType }).sort({ _id: 1 }).lean();
      }
      if (category) {
        category = await this.ctx.model.VideoCategory.findOneAndUpdate({ _id: category._id }, { $set: categoryValues }, { new: true }).lean();
      } else {
        category = await this.ctx.model.VideoCategory.findOneAndUpdate(
          { pid: platform._id, copyid },
          { $set: categoryValues, $setOnInsert: { pid: platform._id, copyid, isHot: 0, num: 0, view: 0 } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
      }
      if (!category) continue;
      const existing = mappingByRemoteId.get(remoteId);
      const mapping = existing || {};
      mapping.remoteId = remoteId;
      mapping.remoteName = remoteName;
      mapping.localCategoryId = mapping.localCategoryId || category._id;
      mapping.localName = String(mapping.localName || category.name);
      mapping.status = Number(mapping.status) === 0 ? 0 : 1;
      if (!existing) mappings.push(mapping);
    }
    const remoteCategories = normalizedRows.map(item => ({ remoteId: item.remoteId, remoteName: item.remoteName, parentId: item.parentId }));
    const saved = await this.ctx.model.CollectSource.findByIdAndUpdate(source._id, {
      $set: { remoteCategories, remoteCategoriesFetchedAt: new Date(), videoCategoryMappings: mappings, videoPlatformId: platform._id },
    }, { new: true }).lean();
    const localCategories = await this.ctx.model.VideoCategory.find({ status: 1 }).sort({ name: 1, _id: 1 }).lean();
    return {
      categories: normalizedRows.map(item => ({ id: item.remoteId, name: item.remoteName, parentId: item.parentId })),
      mappings: saved && saved.videoCategoryMappings || mappings,
      localCategories,
    };
  }

  async remove(id) {
    if (!isObjectId(id)) return { code: -1, message: '采集源 ID 无效' };
    await this.recoverStaleTasks(id);
    const source = await this.ctx.model.CollectSource.findById(id).lean();
    if (!source) return { code: 404, message: '采集源不存在' };
    const running = await this.ctx.model.CollectTask.findOne({ sourceId: id, status: 'running' }).lean();
    if (running) return { code: -1, message: '采集源正在执行任务，请先暂停或等待任务结束后再删除' };

    // 删除采集配置及任务日志，不删除已经采集入库的视频、小说和图片资源。
    const tasks = await this.ctx.model.CollectTask.find({ sourceId: id }).select('_id').lean();
    const taskIds = tasks.map(task => task._id);
    await Promise.all([
      taskIds.length ? this.ctx.model.CollectLog.deleteMany({ taskId: { $in: taskIds } }) : Promise.resolve(),
      this.ctx.model.CollectLog.deleteMany({ sourceId: id }),
      this.ctx.model.CollectTask.deleteMany({ sourceId: id }),
    ]);
    const row = await this.ctx.model.CollectSource.findByIdAndDelete(id).lean();
    return row ? { code: 200, message: '采集源已删除，已有资源已保留' } : { code: 404, message: '采集源不存在' };
  }

  async clearMovies(id) {
    if (!isObjectId(id)) return { code: -1, message: '采集源 ID 无效' };
    const source = await this.ctx.model.CollectSource.findById(id).select('name code siteType videoPlatformId').lean();
    if (!source) return { code: 404, message: '采集源不存在' };
    if (Number(source.siteType) === 8) return this.clearVideos(source);
    await this.recoverStaleTasks(id);
    const active = await this.ctx.model.CollectTask.findOne({ sourceId: id, status: { $in: [ 'pending', 'running', 'paused' ] } }).lean();
    if (active) return { code: -1, message: '该采集源有任务正在等待或执行，暂不能清空' };
    // 兼容早期采集数据可能使用采集源 code 作为 sourceId 的情况。
    const sourceIds = [ String(id), String(source.code || '').trim() ].filter((item, index, list) => item && list.indexOf(item) === index);
    const movies = await this.ctx.model.Movie.find({ sourceId: { $in: sourceIds }, siteType: 11 }).select('_id').lean();
    const movieIds = movies.map(item => item._id);
    if (!movieIds.length) return { code: 200, data: { movieCount: 0, episodeCount: 0, playSourceCount: 0, playUrlCount: 0 }, message: '该采集源没有资源' };
    const [ episodes, playSources, playUrls, relations, seoPages, removedMovies ] = await Promise.all([
      this.ctx.model.Episode.deleteMany({ movieId: { $in: movieIds } }),
      this.ctx.model.PlaySource.deleteMany({ movieId: { $in: movieIds } }),
      this.ctx.model.PlayUrl.deleteMany({ movieId: { $in: movieIds } }),
      this.ctx.model.MovieRelation.deleteMany({ $or: [ { movieId: { $in: movieIds } }, { relatedMovieId: { $in: movieIds } } ] }),
      this.ctx.model.SeoPage.deleteMany({ movieId: { $in: movieIds } }),
      this.ctx.model.Movie.deleteMany({ _id: { $in: movieIds } }),
    ]);
    const count = result => Number(result.deletedCount === undefined ? result.n || 0 : result.deletedCount);
    return { code: 200, data: { movieCount: count(removedMovies), episodeCount: count(episodes), playSourceCount: count(playSources), playUrlCount: count(playUrls), relationCount: count(relations), seoPageCount: count(seoPages) }, message: `已清空采集源「${source.name}」资源` };
  }

  async clearVideos(source) {
    await this.recoverStaleTasks(source._id);
    const active = await this.ctx.model.CollectTask.findOne({ sourceId: source._id, status: { $in: [ 'pending', 'running', 'paused' ] } }).lean();
    if (active) return { code: -1, message: '该采集源有任务正在等待或执行，暂不能清空' };
    const sourceId = String(source._id);
    const videos = await this.ctx.model.Video.find({
      $or: [ { collectSourceId: sourceId }, { 'fromObj.collectSourceId': sourceId } ],
    }).select('_id').lean();
    const videoIds = videos.map(item => item._id);
    const bookCountBefore = await this.ctx.model.VideoBook.countDocuments({ collectSourceId: sourceId });
    const imageCountBefore = await this.ctx.model.VideoImage.countDocuments({ collectSourceId: sourceId });
    if (!videoIds.length && (bookCountBefore || imageCountBefore)) {
      await Promise.all([
        this.ctx.model.VideoBook.deleteMany({ collectSourceId: sourceId }),
        this.ctx.model.VideoImage.deleteMany({ collectSourceId: sourceId }),
      ]);
      return { code: 200, data: { videoCount: 0, bookCount: bookCountBefore, imageCount: imageCountBefore }, message: `已清空采集源「${source.name}」资源` };
    }
    if (!videoIds.length) return { code: 200, data: { videoCount: 0 }, message: '该采集源没有资源' };
    const removed = await this.ctx.model.Video.deleteMany({ _id: { $in: videoIds } });
    const count = Number(removed.deletedCount === undefined ? removed.n || 0 : removed.deletedCount);
    const [removedBooks, removedImages] = await Promise.all([
      this.ctx.model.VideoBook.deleteMany({ collectSourceId: sourceId }),
      this.ctx.model.VideoImage.deleteMany({ collectSourceId: sourceId }),
    ]);
    const bookCount = Number(removedBooks.deletedCount === undefined ? removedBooks.n || 0 : removedBooks.deletedCount);
    const imageCount = Number(removedImages.deletedCount === undefined ? removedImages.n || 0 : removedImages.deletedCount);
    await this.ctx.model.VideoCategory.updateMany({ collectSourceId: sourceId }, { $set: { num: 0 } });
    return { code: 200, data: { videoCount: count, bookCount, imageCount }, message: `已清空采集源「${source.name}」资源` };
  }

  async createTask(input = {}) {
    if (!isObjectId(input.sourceId)) return { code: -1, message: '请选择有效采集源' };
    const source = await this.ctx.model.CollectSource.findOne({ _id: input.sourceId, status: 1 }).lean();
    if (!source) return { code: 404, message: '采集源不存在或已停用' };
    await this.recoverStaleTasks(source._id);
    const running = await this.ctx.model.CollectTask.findOne({ sourceId: source._id, status: { $in: [ 'pending', 'running', 'paused' ] } }).lean();
    if (running) return { code: -1, message: '该采集源已有任务在等待或执行中', data: running };
    const startPage = Math.max(1, asNumber(input.page, 1));
    // 默认只采集最新 10 页；pages=0 或 pages=all 时按接口结束条件采集全部页面。
    const allPages = input.allPages === true || String(input.pages || '').toLowerCase() === 'all' || input.pages === 0 || String(input.pages) === '0';
    const requestedPages = allPages ? 0 : asNumber(input.pages, 10);
    const maxPages = allPages ? 0 : Math.min(1000, Math.max(1, requestedPages || 10));
    const collectType = normalizeCollectType(input.collectType || source.collectType);
    const task = await this.ctx.model.CollectTask.create({
      siteType: asNumber(source.siteType, asNumber(input.siteType, 11)), collectType, sourceId: source._id, mode: input.mode === 'full' ? 'full' : 'incremental',
      page: startPage, maxPages, allPages, endPage: maxPages ? startPage + maxPages - 1 : 0,
      maxRetries: Math.min(10, Math.max(0, asNumber(input.maxRetries, 3))),
      requestedBy: isObjectId(input.requestedBy) ? input.requestedBy : null,
    });
    this.collectorFor(source).run(task._id).catch(error => this.ctx.logger.error(`[${Number(source.siteType) === 8 ? 'video' : 'movie'}-collector] %s`, error.stack || error));
    return { code: 200, data: task, message: '采集任务已创建' };
  }

  async taskList(params = {}) {
    await this.recoverStaleTasks();
    const page = Math.max(1, asNumber(params.page, 1));
    const limit = Math.min(100, Math.max(1, asNumber(params.limit, 50)));
    const query = { siteType: asNumber(params.siteType, 11) };
    if (params.sourceId && isObjectId(params.sourceId)) query.sourceId = params.sourceId;
    const [ rows, count ] = await Promise.all([
      this.ctx.model.CollectTask.find(query).populate('sourceId', 'name code').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.ctx.model.CollectTask.countDocuments(query),
    ]);
    const data = rows.map(row => ({ ...row, sourceName: row.sourceId && row.sourceId.name, sourceCode: row.sourceId && row.sourceId.code, sourceId: row.sourceId && row.sourceId._id }));
    return { code: 200, data: { data, rows: data, count, page, limit } };
  }

  async pauseTask(id) {
    if (!isObjectId(id)) return { code: -1, message: '任务 ID 无效' };
    const task = await this.ctx.model.CollectTask.findOneAndUpdate(
      { _id: id, status: { $in: [ 'pending', 'running' ] } },
      { $set: { status: 'paused', message: '任务已暂停' } },
      { new: true }
    ).lean();
    return task ? { code: 200, data: task, message: '任务已暂停' } : { code: -1, message: '只有等待中或采集中的任务可以暂停' };
  }

  async resumeTask(id) {
    if (!isObjectId(id)) return { code: -1, message: '任务 ID 无效' };
    const task = await this.ctx.model.CollectTask.findOneAndUpdate(
      { _id: id, status: 'paused' },
      { $set: { status: 'pending', message: '等待继续', error: '', finishedAt: null, heartbeatAt: null } },
      { new: true }
    );
    if (!task) return { code: -1, message: '只有已暂停的任务可以继续' };
    this.collectorFor(task).run(task._id).catch(error => this.ctx.logger.error(`[${Number(task.siteType) === 8 ? 'video' : 'movie'}-collector] %s`, error.stack || error));
    return { code: 200, data: task, message: '任务已继续' };
  }

  async deleteTask(id) {
    if (!isObjectId(id)) return { code: -1, message: '任务 ID 无效' };
    const task = await this.ctx.model.CollectTask.findById(id).lean();
    if (!task) return { code: 404, message: '任务不存在' };
    if (task.status === 'running') {
      await this.ctx.model.CollectTask.updateOne({ _id: id, status: 'running' }, { $set: { status: 'canceled', message: '任务已取消，准备删除' } });
      for (let index = 0; index < 20; index++) {
        const running = await this.ctx.model.CollectTask.findOne({ _id: id, status: 'running' }).select('_id').lean();
        if (!running) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const stillRunning = await this.ctx.model.CollectTask.findOne({ _id: id, status: 'running' }).select('_id').lean();
      if (stillRunning) return { code: -1, message: '任务正在处理当前数据，请稍后再删除' };
    }
    await this.ctx.model.CollectLog.deleteMany({ taskId: id });
    await this.ctx.model.CollectTask.deleteOne({ _id: id });
    return { code: 200, message: '任务已删除' };
  }

  async retryTask(id) {
    if (!isObjectId(id)) return { code: -1, message: '任务 ID 无效' };
    const task = await this.ctx.model.CollectTask.findOneAndUpdate(
      { _id: id, status: 'failed' },
      { $set: { status: 'pending', message: '', error: '' }, $inc: { retryCount: 1 } },
      { new: true }
    );
    if (!task) return { code: -1, message: '只有失败任务可以重试，或任务不存在' };
    this.collectorFor(task).run(task._id).catch(error => this.ctx.logger.error(`[${Number(task.siteType) === 8 ? 'video' : 'movie'}-collector] %s`, error.stack || error));
    return { code: 200, data: task, message: '重试任务已提交' };
  }
}

// Invalidate both before and after edits, including partial remote-sync failures.
// All workers observe the same on-disk revision.
for (const name of [ 'create', 'update', 'remove', 'videoSync' ]) {
  const original = CollectSourceService.prototype[name];
  CollectSourceService.prototype[name] = async function(...args) {
    const state = require('../lib/collectScheduleState');
    await state.invalidate(this.ctx.app);
    try { return await original.apply(this, args); }
    finally { await state.invalidate(this.ctx.app); }
  };
}

module.exports = CollectSourceService;
