'use strict';

const Service = require('egg').Service;
const crypto = require('crypto');

const asText = value => value === undefined || value === null ? '' : String(value).trim();
const asNumber = (value, fallback = 0) => {
  const number = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : fallback;
};
const splitMulti = value => asText(value).split(/\$\$\$|###|\|\|/).map(item => item.trim()).filter(Boolean);
const cleanValue = value => asText(value).replace(/^<!\[CDATA\[|\]\]>$/g, '').trim();
const validObjectId = value => /^[a-fA-F0-9]{24}$/.test(String(value || ''));
const safeDate = value => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
};
const extractMediaList = (value, sourceUrl) => {
  const values = [];
  const add = item => {
    if (item === undefined || item === null) return;
    if (Array.isArray(item)) return item.forEach(add);
    const text = String(item).trim();
    if (!text) return;
    if ((text[0] === '[' && text[text.length - 1] === ']') || (text[0] === '{' && text[text.length - 1] === '}')) {
      try { return add(JSON.parse(text)); } catch (error) { /* keep the original value */ }
    }
    const htmlImages = text.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/ig);
    if (htmlImages) {
      htmlImages.forEach(image => {
        const match = image.match(/(?:src|data-src)=["']([^"']+)["']/i);
        if (match) add(match[1]);
      });
      return;
    }
    text.split(/\$\$\$|###|\|\||\r?\n|,/).map(item => item.trim()).filter(Boolean).forEach(url => {
      const resolved = resolveMediaUrl(url, sourceUrl);
      if (resolved && !values.includes(resolved)) values.push(resolved);
    });
  };
  add(value);
  return values;
};

function getPath(input, path) {
  if (!path) return input;
  return String(path).split('.').reduce((value, key) => value && value[key], input);
}

function resolveMediaUrl(value, sourceUrl) {
  const url = cleanValue(value);
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.indexOf('//') === 0) return `https:${url}`;
  try { return new URL(url, sourceUrl).toString(); } catch (error) { return url; }
}

class VideoCollectorService extends Service {
  get baseCollector() {
    return this.ctx.service.movieCollector;
  }

  fetchSource(source, page, extraParams = {}) { return this.baseCollector.fetchSource(source, page, extraParams); }
  extractRows(payload, source) { return this.baseCollector.extractRows(payload, source); }
  extractCategories(payload) { return this.baseCollector.extractCategories(payload); }
  extractRowCategories(payload, source) { return this.baseCollector.extractRowCategories(payload, source); }

  findCategoryMapping(source, typeId, typeName) {
    const mappings = Array.isArray(source.videoCategoryMappings)
      ? source.videoCategoryMappings.filter(item => Number(item.status) !== 0)
      : [];
    return mappings.find(item =>
      (item.remoteId && String(item.remoteId).trim() === String(typeId || '').trim())
      || (item.remoteName && String(item.remoteName).trim() === String(typeName || '').trim())
    );
  }

  normalizeContentType(value) {
    const text = asText(value).toLowerCase();
    if (!text) return '';
    if (/图片|图集|相册|写真|photo|image|gallery|picture/.test(text)) return 'image';
    if (/小说|文章|文学|阅读|章节|article|book|novel|chapter|text/.test(text)) return 'book';
    if (/视频|影视|电影|剧集|video|movie|film|vod/.test(text)) return 'video';
    return '';
  }

  detectCollectType(row, source = {}) {
    const valueOf = (...keys) => {
      for (const key of keys) {
        if (row && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key];
      }
      return '';
    };
    const explicitType = this.normalizeContentType(valueOf(
      'collectType', 'collect_type', 'contentType', 'content_type', 'resourceType', 'resource_type',
      'mediaType', 'media_type', 'model', 'module', 'kind', 'vod_type'
    ));
    if (explicitType) return explicitType;

    const playUrl = valueOf('vod_play_url', 'play_url', 'playUrl', 'vod_url');
    const playFrom = valueOf('vod_play_from', 'play_from', 'playFrom', 'vod_play_from_name');
    if (asText(playUrl) || asText(playFrom)) return 'video';

    const categoryParts = [
      valueOf('type_name', 'typeName', 'category_name', 'categoryName', 'category', 'vod_class', 'tag'),
    ];
    const typeId = asText(valueOf('type_id', 'typeId', 'tid', 'cid', 'category_id'));
    const remoteCategories = Array.isArray(source.remoteCategories) ? source.remoteCategories : [];
    const categoryById = new Map(remoteCategories.map(item => [ asText(item.remoteId || item.id), item ]));
    const visited = new Set();
    let current = categoryById.get(typeId);
    while (current && !visited.has(asText(current.remoteId || current.id))) {
      const currentId = asText(current.remoteId || current.id);
      visited.add(currentId);
      categoryParts.push(current.remoteName || current.name);
      current = categoryById.get(asText(current.parentId || current.parent_id));
    }
    const categoryType = this.normalizeContentType(categoryParts.join(' '));
    if (categoryType === 'image' || categoryType === 'book') return categoryType;

    const imageList = valueOf(
      'image_list', 'imageList', 'images', 'pics', 'photos', 'photoPath', 'photo_path',
      'picture_list', 'pictureList', 'album_images', 'vod_pic_list', 'vod_images'
    );
    if (Array.isArray(imageList) || asText(imageList)) return 'image';

    const bookBody = valueOf(
      'book_content', 'article_content', 'novel_content', 'chapter_content', 'book_body',
      'article_body', 'chapter', 'chapters', 'body'
    );
    const bookId = valueOf('book_id', 'article_id', 'novel_id');
    if (asText(bookBody) || asText(bookId)) return 'book';

    // 列表中没有明确类型时按视频处理，保持普通 MACCMS vod 数据的兼容性。
    return 'video';
  }

  async ensurePlatform(source) {
    if (!source || Number(source.siteType) !== 8) return null;
    const VideoPlatform = this.ctx.model.VideoPlatform;
    const sourceId = String(source._id);
    let platform = null;
    if (validObjectId(source.videoPlatformId)) platform = await VideoPlatform.findById(source.videoPlatformId);
    if (!platform) platform = await VideoPlatform.findOne({ collectSourceId: sourceId });
    const values = {
      name: source.name || source.code || '视频采集源',
      shortName: source.code || source.name || 'video-source',
      siteType: 8,
      updateType: 1,
      typeName: '视频采集',
      link: source.url,
      status: Number(source.status) === 1 ? 1 : 0,
      collectSourceId: sourceId,
      collectSourceCode: source.code || '',
    };
    if (platform) {
      platform = await VideoPlatform.findByIdAndUpdate(platform._id, { $set: values }, { new: true });
    } else {
      platform = await VideoPlatform.create({ ...values, num: 0 });
    }
    if (!validObjectId(source.videoPlatformId) || String(source.videoPlatformId) !== String(platform._id)) {
      await this.ctx.model.CollectSource.updateOne({ _id: source._id }, { $set: { videoPlatformId: platform._id } });
    }
    return platform;
  }

  normalize(row, source, platform) {
    const get = (...keys) => {
      for (const key of keys) {
        const value = row && row[key];
        if (value !== undefined && value !== null && String(value) !== '') return value;
      }
      return '';
    };
    const vodId = cleanValue(get('vod_id', 'vodId', 'id', 'ids', 'vodid'));
    const title = cleanValue(get('vod_name', 'name', 'title'));
    if (!vodId || !title) return null;

    const typeId = cleanValue(get('type_id', 'typeId', 'tid', 'cid', 'category_id'));
    const typeName = cleanValue(get('type_name', 'typeName', 'type', 'category', 'category_name'));
    const mapping = this.findCategoryMapping(source, typeId, typeName);
    // 视频分类绑定使用本地 VideoCategory 的 ObjectId。没有有效绑定时跳过，
    // 不写入没有 cid 的视频，也不为它额外请求详情。
    if (!mapping || !validObjectId(mapping.localCategoryId)) {
      return { __skip: true, skipReason: '未绑定分类', vodId };
    }
    const playFrom = cleanValue(get('vod_play_from', 'play_from', 'playFrom', 'vod_play_from_name'));
    const playUrl = cleanValue(get('vod_play_url', 'play_url', 'playUrl', 'url', 'vod_url'));
    const fromNames = splitMulti(playFrom);
    const urlGroups = splitMulti(playUrl);
    const playSources = urlGroups.map((group, sourceIndex) => {
      const name = fromNames[sourceIndex] || `线路${sourceIndex + 1}`;
      const episodes = group.split('#').map(item => item.trim()).filter(Boolean).map((item, episodeIndex) => {
        const parts = item.split('$');
        const hasTitle = parts.length > 1;
        const episodeTitle = hasTitle ? cleanValue(parts.shift()) : `${title} ${episodeIndex + 1}`;
        const rawUrl = hasTitle ? parts.join('$') : item;
        return { title: episodeTitle, episode: episodeIndex + 1, url: resolveMediaUrl(rawUrl, source.url) };
      }).filter(item => item.url);
      return { name, url: group, episodes };
    }).filter(item => item.episodes.length || item.url);
    const firstUrl = playSources.length && playSources[0].episodes.length ? playSources[0].episodes[0].url : '';
    const cover = resolveMediaUrl(get('vod_pic', 'vod_pic_thumb', 'vod_pic_slide', 'cover', 'pic', 'image'), source.url);
    const content = cleanValue(get('vod_content', 'content', 'description', 'desc'));
    const description = cleanValue(get('vod_blurb', 'vod_remarks', 'remark', 'remarks', 'description'));
    const actor = cleanValue(get('vod_actor', 'actor', 'actors'));
    const director = cleanValue(get('vod_director', 'director'));
    const writer = cleanValue(get('vod_writer', 'writer'));
    const dateText = cleanValue(get('vod_time', 'time', 'vod_pubdate', 'publishTime'));
    const remarks = cleanValue(get('vod_remarks', 'remark', 'remarks'));
    const payload = {
      collectType: 'video',
      title,
      copyid: vodId,
      subName: cleanValue(get('vod_sub', 'subName', 'sub_title')),
      enName: cleanValue(get('vod_en', 'enName', 'en')),
      time: dateText || new Date().toISOString(),
      status: 1,
      content,
      description,
      keywords: cleanValue(get('vod_keywords', 'keywords')),
      tag: cleanValue(get('vod_tag', 'tag', 'vod_class')) || typeName,
      view: asNumber(get('vod_hits', 'hits', 'view', 'viewCount')),
      star: asNumber(get('vod_score', 'score')),
      videoTime: cleanValue(get('vod_duration', 'duration', 'videoTime')) || remarks,
      viewUrl: cleanValue(get('vod_jumpurl', 'jumpurl', 'viewUrl')),
      collectSourceId: String(source._id),
      collectVodId: vodId,
      sourceName: source.name || '',
      sourceUrl: source.url || '',
      vodId,
      typeId,
      typeName,
      firstLetter: cleanValue(get('vod_letter', 'firstLetter')),
      year: cleanValue(get('vod_year', 'year')),
      area: cleanValue(get('vod_area', 'area')),
      lang: cleanValue(get('vod_lang', 'lang', 'language')),
      actor,
      director,
      writer,
      remarks,
      score: asNumber(get('vod_score', 'score')),
      isEnd: asNumber(get('vod_isend', 'isEnd', 'vod_serial')),
      episodeCount: asNumber(get('vod_total', 'episodeCount')),
      cover,
      coverBig: resolveMediaUrl(get('vod_pic_slide', 'coverBig', 'vod_pic_thumb') || cover, source.url),
      publishTime: safeDate(get('vod_pubdate', 'publishTime')),
      updateTime: safeDate(get('vod_time', 'updateTime')),
      playFrom,
      playUrl,
      playSources,
      rawData: row,
      fromObj: {
        source: 'video-collector',
        collectSourceId: String(source._id),
        collectSourceCode: source.code || '',
        remoteId: vodId,
        remoteTypeId: typeId,
      },
    };
    if (cover) payload.image = cover;
    if (firstUrl) payload.video = firstUrl;
    payload.cid = mapping.localCategoryId;
    if (platform && platform._id) payload.pid = platform._id;
    return payload;
  }

  normalizeBook(row, source) {
    const get = (...keys) => {
      for (const key of keys) {
        const value = row && row[key];
        if (value !== undefined && value !== null && String(value) !== '') return value;
      }
      return '';
    };
    const collectVodId = cleanValue(get('book_id', 'article_id', 'aid', 'vod_id', 'vodId', 'id', 'ids'));
    const title = cleanValue(get('book_title', 'article_title', 'vod_name', 'name', 'title'));
    if (!collectVodId || !title) return null;
    const typeId = cleanValue(get('type_id', 'typeId', 'tid', 'cid', 'category_id'));
    const typeName = cleanValue(get('type_name', 'typeName', 'type', 'category', 'category_name'));
    const mapping = this.findCategoryMapping(source, typeId, typeName);
    if (!mapping || !validObjectId(mapping.localCategoryId)) return { __skip: true, skipReason: '未绑定分类', vodId: collectVodId };
    const cover = resolveMediaUrl(get('book_cover', 'article_cover', 'vod_pic', 'cover', 'pic', 'image', 'thumb'), source.url);
    const body = cleanValue(get('book_content', 'article_content', 'vod_content', 'content', 'body', 'description', 'desc'));
    const dateText = cleanValue(get('update_time', 'updatedAt', 'vod_time', 'time', 'publishTime'));
    return {
      collectType: 'book',
      title,
      copyid: collectVodId,
      time: dateText || new Date().toISOString(),
      status: 1,
      content: body,
      description: cleanValue(get('book_description', 'article_description', 'vod_blurb', 'remark', 'remarks')),
      keywords: cleanValue(get('keywords', 'vod_keywords')),
      image: cover,
      view: asNumber(get('view', 'views', 'vod_hits', 'hits', 'viewCount')),
      star: asNumber(get('star', 'score', 'vod_score')),
      bad: 0,
      isHot: asNumber(get('isHot', 'hot')),
      tag: cleanValue(get('tag', 'tags', 'vod_tag', 'vod_class')) || typeName,
      categoryId: mapping.localCategoryId,
      collectSourceId: String(source._id),
      collectVodId,
      sourceName: source.name || '',
      sourceUrl: source.url || '',
      vodId: collectVodId,
      typeId,
      typeName,
      publishTime: safeDate(get('publish_time', 'vod_pubdate', 'publishTime')),
      updateTime: safeDate(get('update_time', 'updatedAt', 'vod_time', 'updateTime')),
      rawData: row,
      fromObj: { source: 'video-collector', collectSourceId: String(source._id), remoteId: collectVodId, remoteTypeId: typeId },
    };
  }

  normalizeImage(row, source) {
    const get = (...keys) => {
      for (const key of keys) {
        const value = row && row[key];
        if (value !== undefined && value !== null && String(value) !== '') return value;
      }
      return '';
    };
    const collectVodId = cleanValue(get('image_id', 'album_id', 'article_id', 'aid', 'vod_id', 'vodId', 'id', 'ids'));
    const title = cleanValue(get('image_title', 'album_title', 'article_title', 'vod_name', 'name', 'title'));
    if (!collectVodId || !title) return null;
    const typeId = cleanValue(get('type_id', 'typeId', 'tid', 'cid', 'category_id'));
    const typeName = cleanValue(get('type_name', 'typeName', 'type', 'category', 'category_name'));
    const mapping = this.findCategoryMapping(source, typeId, typeName);
    if (!mapping || !validObjectId(mapping.localCategoryId)) return { __skip: true, skipReason: '未绑定分类', vodId: collectVodId };
    const imageList = extractMediaList(get('image_list', 'imageList', 'images', 'pics', 'photos', 'photoPath', 'content'), source.url);
    const cover = resolveMediaUrl(get('image', 'cover', 'pic', 'thumb', 'vod_pic'), source.url) || imageList[0] || '';
    const dateText = cleanValue(get('update_time', 'updatedAt', 'vod_time', 'time', 'publishTime'));
    return {
      collectType: 'image',
      title,
      copyid: collectVodId,
      time: dateText || new Date().toISOString(),
      status: 1,
      content: cleanValue(get('description', 'desc', 'content', 'remark', 'remarks')),
      description: cleanValue(get('description', 'desc', 'remark', 'remarks')),
      keywords: cleanValue(get('keywords', 'vod_keywords')),
      image: cover,
      image_list: imageList.join(','),
      width: asNumber(get('width', 'image_width')),
      view: asNumber(get('view', 'views', 'vod_hits', 'hits', 'viewCount')),
      star: asNumber(get('star', 'score', 'vod_score')),
      bad: 0,
      isHot: asNumber(get('isHot', 'hot')),
      tag: cleanValue(get('tag', 'tags', 'vod_tag', 'vod_class')) || typeName,
      categoryId: mapping.localCategoryId,
      collectSourceId: String(source._id),
      collectVodId,
      sourceName: source.name || '',
      sourceUrl: source.url || '',
      vodId: collectVodId,
      typeId,
      typeName,
      publishTime: safeDate(get('publish_time', 'vod_pubdate', 'publishTime')),
      updateTime: safeDate(get('update_time', 'updatedAt', 'vod_time', 'updateTime')),
      rawData: row,
      fromObj: { source: 'video-collector', collectSourceId: String(source._id), remoteId: collectVodId, remoteTypeId: typeId },
    };
  }

  normalizeByType(row, source, platform, collectType) {
    const resolvedType = collectType === 'auto' ? this.detectCollectType(row, source) : collectType;
    if (resolvedType === 'book') return this.normalizeBook(row, source);
    if (resolvedType === 'image') return this.normalizeImage(row, source);
    return this.normalize(row, source, platform);
  }

  async upsertContent(source, normalized, collectType) {
    collectType = collectType === 'auto' ? normalized.collectType || 'video' : collectType;
    if (collectType === 'video') return this.upsertVideo(source, normalized);
    const Model = collectType === 'book' ? this.ctx.model.VideoBook : this.ctx.model.VideoImage;
    const query = { collectSourceId: normalized.collectSourceId, collectVodId: normalized.collectVodId };
    let existing = await Model.findOne(query).select('_id title content image image_list categoryId').lean();
    if (!existing) existing = await Model.findOne({ 'fromObj.collectSourceId': normalized.collectSourceId, 'fromObj.remoteId': normalized.collectVodId }).select('_id title content image image_list categoryId').lean();
    const changed = !existing || [ 'title', 'content', 'image', 'image_list', 'categoryId' ].some(key => String(existing[key] || '') !== String(normalized[key] || ''));
    if (existing && !changed) return { row: existing, isNew: false, changed: false };
    const filter = existing ? { _id: existing._id } : query;
    const set = { ...normalized };
    [ 'image', 'image_list', 'content', 'description', 'keywords' ].forEach(key => {
      if (set[key] === '' || set[key] === null || set[key] === undefined) delete set[key];
    });
    const row = await Model.findOneAndUpdate(filter, { $set: set }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return { row, isNew: !existing, changed: true };
  }

  async upsertVideo(source, normalized) {
    const Video = this.ctx.model.Video;
    const query = { collectSourceId: normalized.collectSourceId, collectVodId: normalized.collectVodId };
    const compareFields = '_id fromObj title playFrom playUrl';
    let existing = await Video.findOne(query).select(compareFields).lean();
    if (!existing) existing = await Video.findOne({ 'fromObj.collectSourceId': normalized.collectSourceId, 'fromObj.remoteId': normalized.collectVodId }).select(compareFields).lean();
    let changed = !existing;
    if (existing) {
      const titleChanged = asText(existing.title) !== asText(normalized.title);
      // 列表接口经常只有 vod_play_from，没有 vod_play_url；没有完整地址时保留旧播放源，避免误清空。
      const hasCompletePlaySource = Boolean(asText(normalized.playUrl));
      const sourceChanged = hasCompletePlaySource && (
        asText(existing.playFrom) !== asText(normalized.playFrom)
        || asText(existing.playUrl) !== asText(normalized.playUrl)
      );
      changed = titleChanged || sourceChanged;
      if (!changed) return { row: existing, isNew: false, changed: false };
    }
    const filter = existing ? { _id: existing._id } : query;
    const set = { ...normalized };
    if (existing && existing.fromObj && normalized.fromObj) set.fromObj = { ...existing.fromObj, ...normalized.fromObj };
    // 远程接口偶尔会返回空封面或空播放地址，增量更新时保留旧值。
    [ 'image', 'video', 'cid', 'pid', 'content', 'description', 'keywords', 'viewUrl' ].forEach(key => {
      if (set[key] === '' || set[key] === null || set[key] === undefined) delete set[key];
    });
    if (!asText(normalized.playUrl)) {
      [ 'playFrom', 'playUrl', 'playSources' ].forEach(key => { delete set[key]; });
    }
    let row;
    try {
      row = await Video.findOneAndUpdate(
        filter,
        // normalized 已经包含 status、view、star，不能再和 $setOnInsert 重复写入同一路径。
        { $set: set, $setOnInsert: { bad: 0, isHot: 0 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (error && error.code === 11000) {
        row = await Video.findOneAndUpdate(query, { $set: set }, { new: true });
      } else throw error;
    }
    return { row, isNew: !existing, changed };
  }

  async log(task, source, level, action, message, meta = {}, videoId = null) {
    await this.ctx.model.CollectLog.create({ taskId: task._id, sourceId: source._id, videoId, level, action, message, meta }).catch(() => {});
  }

  async run(taskId) {
    const token = crypto.randomBytes(12).toString('hex');
    const task = await this.ctx.model.CollectTask.findOneAndUpdate(
      { _id: taskId, status: 'pending' },
      { $set: { status: 'running', lockToken: token, startedAt: new Date(), heartbeatAt: new Date(), message: '' } },
      { new: true }
    );
    if (!task) return null;
    const source = await this.ctx.model.CollectSource.findById(task.sourceId).lean();
    if (!source || Number(source.siteType) !== 8 || Number(source.status) !== 1) {
      await this.ctx.model.CollectTask.updateOne({ _id: task._id, lockToken: token }, { $set: { status: 'failed', error: '视频采集源不存在或已停用', finishedAt: new Date() } });
      return null;
    }
    const platform = await this.ensurePlatform(source);
    const configuredCollectType = [ 'video', 'book', 'image' ].includes(String(task.collectType || source.collectType || '').toLowerCase())
      ? String(task.collectType || source.collectType).toLowerCase()
      : 'video';
    // MACCMS 的 vod 列表可能同时返回视频、小说和图片，选择“视频”时按每条数据自动分流。
    const collectType = configuredCollectType === 'video' ? 'auto' : configuredCollectType;
    const requestedMaxPages = task.allPages === true ? 0 : (task.maxPages === undefined || task.maxPages === null ? 10 : asNumber(task.maxPages, 10));
    const maxPages = requestedMaxPages <= 0 ? 0 : Math.min(1000, Math.max(1, requestedMaxPages));
    const isAllPages = task.allPages === true || maxPages === 0;
    let page = task.page || 1;
    const endPage = maxPages ? (task.endPage > 0 ? Math.min(task.endPage, page + maxPages - 1) : page + maxPages - 1) : (task.endPage > 0 ? task.endPage : 0);
    await this.ctx.model.CollectTask.updateOne({ _id: task._id, lockToken: token }, { $set: { maxPages, endPage } });
    const isRunning = async () => Boolean(await this.ctx.model.CollectTask.findOne({ _id: task._id, lockToken: token, status: 'running' }).select('_id').lean());
    try {
      while (page <= 10000 && (!maxPages || page <= endPage)) {
        if (!(await isRunning())) return task;
        const payload = await this.fetchSource(source, page);
        const rows = this.extractRows(payload, source);
        if (!rows.length) break;
        const concurrency = Math.min(32, Math.max(1, asNumber(source.concurrency, 8) || 8));
        const processRow = async raw => {
          try {
            let normalized = this.normalizeByType(raw, source, platform, collectType);
            if (normalized && normalized.__skip) {
              await this.ctx.model.CollectTask.updateOne(
                { _id: task._id, lockToken: token },
                { $inc: { skippedCount: 1 } }
              );
              return;
            }
            if (!normalized) {
              const message = '跳过入库：缺少标题或远程 ID';
              await this.ctx.model.CollectTask.updateOne(
                { _id: task._id, lockToken: token },
                { $inc: { skippedCount: 1 } }
              );
              await this.log(task, source, 'warn', 'skip', message, { raw });
              return;
            }
            let rowCollectType = normalized.collectType || (collectType === 'auto' ? this.detectCollectType(raw, source) : collectType);
            const needsDetail = rowCollectType === 'video'
              ? !normalized.playUrl
              : rowCollectType === 'book'
                ? !normalized.content
                : !normalized.image_list;
            if (needsDetail) {
              try {
                const detailPayload = await this.fetchSource(source, page, { ac: 'detail', ids: normalized.collectVodId });
                const detailRows = this.extractRows(detailPayload, source);
                let detailRaw = detailRows.length ? { ...raw, ...detailRows[0] } : { ...raw };
                const detailType = collectType === 'auto' ? this.detectCollectType(detailRaw, source) : collectType;
                normalized = this.normalizeByType(detailRaw, source, platform, detailType) || normalized;
                rowCollectType = normalized.collectType || detailType;
              } catch (error) {
                this.ctx.logger.warn(`[video-collector] detail fetch failed for ${normalized.collectVodId}: ${error.message}`);
              }
            }
            if (rowCollectType === 'video') {
              const missing = [];
              if (!asText(normalized.title)) missing.push('标题');
              if (!asText(normalized.cover || normalized.image)) missing.push('封面地址');
              if (!asText(normalized.playUrl)) missing.push('播放地址');
              if (missing.length) {
                const message = `跳过入库：缺少${missing.join('、')}`;
                await this.ctx.model.CollectTask.updateOne(
                  { _id: task._id, lockToken: token },
                  { $inc: { skippedCount: 1 } }
                );
                await this.log(task, source, 'warn', 'skip', message, {
                  remoteId: normalized.collectVodId,
                  missing,
                  raw,
                });
                return;
              }
            }
            const result = await this.upsertContent(source, normalized, rowCollectType);
            const counter = result.isNew ? 'createdCount' : (result.changed ? 'updatedCount' : 'duplicateCount');
            if (counter) await this.ctx.model.CollectTask.updateOne({ _id: task._id, lockToken: token }, { $inc: { [counter]: 1 } });
          } catch (error) {
            await this.ctx.model.CollectTask.updateOne({ _id: task._id, lockToken: token }, { $inc: { failedCount: 1 } });
            await this.log(task, source, 'error', 'video', error.message, { raw });
          }
        };
        for (let offset = 0; offset < rows.length; offset += concurrency) {
          if (!(await isRunning())) return task;
          await Promise.all(rows.slice(offset, offset + concurrency).map(processRow));
        }
        await this.ctx.model.CollectTask.updateOne({ _id: task._id, lockToken: token }, { $set: { page: page + 1, heartbeatAt: new Date() } });
        await this.ctx.model.CollectSource.updateOne({ _id: source._id }, { $set: { lastPage: page, lastRunAt: new Date() } });
        if (!(await isRunning())) return task;
        const reportedPageCount = asNumber(payload && (payload.pagecount || payload.pageCount || getPath(payload, 'pagination.pageCount')));
        const total = asNumber(payload && (payload.total || getPath(payload, 'pagination.total')));
        const remoteLimit = asNumber(payload && (payload.limit || getPath(payload, 'pagination.limit')), source.pageSize || 20);
        const totalPageCount = total && remoteLimit ? Math.ceil(total / remoteLimit) : 0;
        const pageCount = isAllPages ? totalPageCount : Math.max(reportedPageCount, totalPageCount);
        if ((pageCount && page >= pageCount) || (!isAllPages && rows.length < (source.pageSize || 20))) break;
        page += 1;
      }
      await this.ctx.model.CollectTask.updateOne(
        { _id: task._id, lockToken: token, status: 'running' },
        { $set: { status: 'success', message: '采集完成', finishedAt: new Date(), heartbeatAt: new Date() } }
      );
      await this.log(task, source, 'info', 'task', '采集完成');
      await this.ctx.service.video.videoUpdateAll().catch(error => this.ctx.logger.warn(`[video-collector] cache refresh failed: ${error.message}`));
    } catch (error) {
      if (!(await isRunning())) return task;
      await this.ctx.model.CollectTask.updateOne({ _id: task._id, lockToken: token }, { $set: { status: 'failed', error: error.message, message: '采集失败', finishedAt: new Date() } });
      await this.log(task, source, 'error', 'task', error.message);
    }
    return task;
  }
}

module.exports = VideoCollectorService;
