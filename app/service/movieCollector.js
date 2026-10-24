'use strict';

const Service = require('egg').Service;
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const http = require('http');
const https = require('https');

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 32 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 32 });

const asText = value => value === undefined || value === null ? '' : String(value).trim();
const asNumber = (value, fallback = 0) => {
  const number = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : fallback;
};
const splitMulti = value => asText(value).split(/\$\$\$|###|\|\|/).map(item => item.trim()).filter(Boolean);
const slug = value => asText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'default';
const safeDate = value => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
};
const cleanValue = value => asText(value).replace(/^<!\[CDATA\[|\]\]>$/g, '').trim();
const resolveMediaUrl = (value, sourceUrl) => {
  const url = cleanValue(value);
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.indexOf('//') === 0) return `https:${url}`;
  try { return new URL(url, sourceUrl).toString(); } catch (error) { return url; }
};

function getPath(input, path) {
  if (!path) return input;
  return String(path).split('.').reduce((value, key) => value && value[key], input);
}

function findArrays(input, output = []) {
  if (Array.isArray(input)) output.push(input);
  else if (input && typeof input === 'object') Object.keys(input).forEach(key => findArrays(input[key], output));
  return output;
}

class MovieCollectorService extends Service {
  async fetchSource(source, page, extraParams = {}) {
    const url = String(source.url).replace(/\{page\}/g, page).replace(/\{limit\}/g, source.pageSize || 20);
    const detailMode = extraParams && extraParams.ac === 'detail';
    const params = { ...(source.params || {}), ...extraParams };
    if (!detailMode && !String(source.url).includes('{page}') && source.pageParam) params[source.pageParam] = page;
    if (!detailMode && !String(source.url).includes('{limit}') && source.pageSizeParam) params[source.pageSizeParam] = source.pageSize || 20;
    if (detailMode) {
      if (source.pageParam) delete params[source.pageParam];
      if (source.pageSizeParam) delete params[source.pageSizeParam];
    }
    const config = { url, method: source.method || 'GET', params, headers: source.headers || {}, timeout: 30000, responseType: 'text', transformResponse: [ value => value ], httpAgent, httpsAgent };
    if (config.method === 'POST') { config.data = params; delete config.params; }
    const response = await axios(config);
    const raw = response.data;
    if (String(source.format).toLowerCase() === 'html') {
      const $ = cheerio.load(String(raw || ''));
      const parser = source.parser && typeof source.parser === 'object' ? source.parser : {};
      const fields = parser.fields && typeof parser.fields === 'object' ? parser.fields : {};
      const defaultSelectors = {
        id: '[data-id],[data-vod-id],[data-content-id],.id',
        title: 'h1,h2,h3,.title,.name,[data-title]',
        typeId: '[data-type-id],.type-id',
        typeName: '[data-type-name],.type-name,.category,.cat',
        content: '.content,.description,.desc,.summary',
        image: 'img',
      };
      const readField = ($item, key) => {
        const configured = fields[key] || defaultSelectors[key];
        const config = typeof configured === 'string' ? { selector: configured } : configured || {};
        const node = config.selector ? $item.find(config.selector).first() : $item;
        if (!node || !node.length) return '';
        return config.attr ? node.attr(config.attr) || '' : node.text().trim();
      };
      const itemSelector = parser.itemSelector || 'article,.item,.list-item,li,[data-content-id],[data-vod-id]';
      const rows = [];
      $(itemSelector).each((index, element) => {
        const $item = $(element);
        const row = {
          id: readField($item, 'id'),
          title: readField($item, 'title'),
          typeId: readField($item, 'typeId'),
          typeName: readField($item, 'typeName'),
          content: readField($item, 'content'),
          image: readField($item, 'image'),
          image_list: $item.find('img').map((i, image) => $(image).attr('src') || $(image).attr('data-src') || '').get().filter(Boolean).join(','),
        };
        if (!row.id) row.id = $item.attr('data-id') || $item.attr('data-vod-id') || $item.attr('data-content-id') || '';
        if (!row.title) row.title = $item.attr('data-title') || '';
        if (row.id && row.title) rows.push(row);
      });
      return { list: rows, pagecount: asNumber(parser.pageCount, 0) };
    }
    if (source.format === 'json' || (typeof raw === 'string' && /^\s*[\[{]/.test(raw))) {
      try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (error) { throw new Error(`JSON 解析失败: ${error.message}`); }
    }
    const $ = cheerio.load(String(raw || ''), { xmlMode: true, decodeEntities: true });
    const rows = [];
    const categories = [];
    $('video').each((index, element) => {
      const row = {};
      $(element).children().each((childIndex, child) => { row[child.name] = $(child).text(); });
      rows.push(row);
    });
    const categorySeen = new Set();
    $('class,classes,category,categories,types').each((index, element) => {
      $(element).children().each((childIndex, child) => {
        const name = $(child).attr('name') || $(child).attr('type_name') || $(child).attr('typeName') || $(child).text().trim();
        const id = $(child).attr('id') || $(child).attr('type_id') || $(child).attr('typeId') || $(child).attr('value') || '';
        const parentId = $(child).attr('parentId') || $(child).attr('parent_id') || $(child).attr('type_pid') || $(child).attr('typePid') || $(child).attr('pid') || '0';
        const categoryKey = `${id}|${name}`;
        if ((name || id) && !categorySeen.has(categoryKey)) {
          categorySeen.add(categoryKey);
          categories.push({ id: String(id), name, parentId: String(parentId) });
        }
      });
    });
    $('list > ty,list > type,list > category').each((index, child) => {
      const name = $(child).attr('name') || $(child).attr('type_name') || $(child).attr('typeName') || $(child).text().trim();
      const id = $(child).attr('id') || $(child).attr('type_id') || $(child).attr('typeId') || $(child).attr('value') || '';
      const parentId = $(child).attr('parentId') || $(child).attr('parent_id') || $(child).attr('type_pid') || $(child).attr('typePid') || $(child).attr('pid') || '0';
      const categoryKey = `${id}|${name}`;
      if ((name || id) && !categorySeen.has(categoryKey)) {
        categorySeen.add(categoryKey);
        categories.push({ id: String(id), name, parentId: String(parentId) });
      }
    });
    const pageCount = $('pagecount').first().text() || $('page').first().attr('pagecount') || '';
    return { list: rows, categories, pagecount: asNumber(pageCount, 0) };
  }

  extractRows(payload, source) {
    if (payload && source.listPath) {
      const configured = getPath(payload, source.listPath);
      if (Array.isArray(configured)) return configured;
    }
    const direct = payload && (payload.list || payload.data || payload.result || payload.vod);
    if (Array.isArray(direct)) return direct;
    const arrays = findArrays(payload);
    return arrays.sort((left, right) => right.length - left.length)[0] || [];
  }

  extractCategories(payload) {
    const result = [];
    const seen = new Set();
    const categoryKeys = new Set([ 'class', 'classes', 'category', 'categories', 'type', 'types' ]);
    const readCategory = item => {
      if (item === undefined || item === null) return null;
      if (typeof item !== 'object') return { id: '', name: cleanValue(item) };
      const id = item.id ?? item.type_id ?? item.typeId ?? item.value ?? item.cid ?? item.class_id;
      const name = item.name ?? item.type_name ?? item.typeName ?? item.category_name ?? item.title ?? item.text;
      const parentId = item.parentId ?? item.parent_id ?? item.type_pid ?? item.typePid ?? '';
      if ((id === undefined || id === '') && (name === undefined || name === '')) return null;
      return { id: String(id ?? '').trim(), name: cleanValue(name ?? ''), parentId: String(parentId ?? '').trim() };
    };
    const add = item => {
      const category = readCategory(item);
      if (!category || (!category.id && !category.name)) return;
      if (!category.id && /[,，|、\/]/.test(category.name)) {
        category.name.split(/[,，|、\/]/).map(name => name.trim()).filter(Boolean).forEach(name => add({ name }));
        return;
      }
      const itemKey = `${category.id}|${category.name}`;
      if (!seen.has(itemKey)) {
        seen.add(itemKey);
        result.push(category);
      }
    };
    // 苹果 CMS 类接口通常把分类放在 class，视频列表放在 list/data。
    // class 存在且可识别时只使用 class，避免把视频列表字段误判为分类。
    const explicitClassValues = [
      payload && payload.class,
      payload && payload.data && payload.data.class,
      payload && payload.result && payload.result.class,
    ].filter(value => value !== undefined && value !== null);
    const explicitClassPresent = [ payload, payload && payload.data, payload && payload.result ].some(value =>
      value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'class')
    );
    const explicitClassRows = [];
    const collectClassRows = value => {
      if (typeof value === 'string') {
        try { return collectClassRows(JSON.parse(value)); } catch (error) { return; }
      }
      if (Array.isArray(value)) return value.forEach(collectClassRows);
      if (!value || typeof value !== 'object') return;
      if (value.vod_id !== undefined || value.vod_name !== undefined || value.vod_play_url !== undefined) return;
      const category = readCategory(value);
      if (category && (category.id || category.name)) explicitClassRows.push(category);
      else Object.keys(value).forEach(key => collectClassRows(value[key]));
    };
    explicitClassValues.forEach(collectClassRows);
    if (explicitClassPresent) {
      const explicitSeen = new Set();
      return explicitClassRows.filter(item => {
        const key = `${item.id}|${item.name}|${item.parentId}`;
        if (explicitSeen.has(key)) return false;
        explicitSeen.add(key);
        return true;
      });
    }
    const walk = (value, key = '', inCategory = false) => {
      const normalizedKey = String(key).toLowerCase();
      const isCategoryKey = categoryKeys.has(normalizedKey) && (normalizedKey !== 'type' || (value && typeof value === 'object'));
      const categoryContext = inCategory || isCategoryKey;
      if (Array.isArray(value)) {
        const looksLikeCategoryList = value.length > 0 && value.every(item => item && typeof item === 'object'
          && (item.type_id !== undefined || item.typeId !== undefined || item.id !== undefined)
          && (item.type_name !== undefined || item.typeName !== undefined || item.name !== undefined)
          && item.vod_name === undefined && item.vod_id === undefined);
        if (categoryContext || looksLikeCategoryList) value.forEach(add);
        value.forEach(item => walk(item, key, categoryContext));
      } else if (value && typeof value === 'object') {
        if (categoryContext) add(value);
        Object.keys(value).forEach(childKey => walk(value[childKey], childKey, categoryContext));
      } else if ((isCategoryKey || String(key).toLowerCase() === 'ty') && value !== undefined && value !== null) {
        add(value);
      }
    };
    walk(payload);
    return result;
  }

  extractRowCategories(payload, source) {
    const result = [];
    const seen = new Set();
    this.extractRows(payload, source).forEach(row => {
      if (!row || typeof row !== 'object') return;
      const id = row.type_id ?? row.typeId ?? row.tid ?? row.category_id ?? row.categoryId ?? row.cid ?? '';
      const name = row.type_name ?? row.typeName ?? row.type ?? row.category_name ?? row.categoryName ?? row.category ?? '';
      const parentId = row.type_pid ?? row.typePid ?? row.parent_id ?? row.parentId ?? '';
      if (!id && !name) return;
      const item = { id: String(id).trim(), name: cleanValue(name), parentId: String(parentId).trim() };
      const key = `${item.id}|${item.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    });
    return result;
  }

  normalize(row, source) {
    const get = (...keys) => {
      for (const key of keys) {
        const value = row && row[key];
        if (value !== undefined && value !== null && String(value) !== '') return value;
      }
      return '';
    };
    const sourceKey = String(source._id);
    const vodId = asText(get('vod_id', 'vodId', 'id', 'ids', 'vodid'));
    if (!vodId) return null;
    const tags = splitMulti(get('vod_tag', 'tag', 'tags')).join(',').split(/[,，|]/).map(item => item.trim()).filter(Boolean);
    const cover = resolveMediaUrl(get('vod_pic', 'vod_pic_thumb', 'vod_pic_slide', 'cover', 'pic', 'image'), source.url);
    const movie = {
      sourceId: sourceKey, vodId, name: cleanValue(get('vod_name', 'name', 'title')),
      subName: cleanValue(get('vod_sub', 'subName', 'sub_title')), enName: cleanValue(get('vod_en', 'enName', 'en')),
      typeId: cleanValue(get('type_id', 'typeId', 'tid', 'cid')), typeName: cleanValue(get('type_name', 'typeName', 'type', 'category')),
      year: cleanValue(get('vod_year', 'year')), area: cleanValue(get('vod_area', 'area')), lang: cleanValue(get('vod_lang', 'lang', 'language')),
      actor: cleanValue(get('vod_actor', 'actor', 'actors')), director: cleanValue(get('vod_director', 'director')),
      writer: cleanValue(get('vod_writer', 'writer')), cover, coverBig: resolveMediaUrl(get('vod_pic_slide', 'coverBig', 'vod_pic_thumb') || cover, source.url), remark: cleanValue(get('vod_remarks', 'remark', 'remarks')),
      content: cleanValue(get('vod_content', 'content', 'description', 'desc')), score: asNumber(get('vod_score', 'score')),
      status: 1, isEnd: /完|全/.test(asText(get('vod_remarks', 'remark'))) ? 1 : 0, tags,
      publishTime: safeDate(get('vod_pubdate', 'publishTime')), updateTime: safeDate(get('vod_time', 'updateTime', 'last')), siteType: 11,
    };
    const mappings = Array.isArray(source.categoryMappings) ? source.categoryMappings.filter(item => Number(item.status) !== 0) : [];
    const mapping = mappings.find(item =>
      (item.remoteId && String(item.remoteId) === movie.typeId) ||
      (item.remoteName && String(item.remoteName).trim() === movie.typeName)
    );
    // 只有已经绑定到本地分类的资源才允许进入 movie。未绑定资源直接跳过，
    // 避免把远程分类 ID 当成本地分类写入，后续也不再请求详情。
    if (!mapping || !mapping.localTypeId) {
      return { __skip: true, skipReason: '未绑定分类', vodId };
    }
    movie.typeId = String(mapping.localTypeId);
    movie.typeName = String(mapping.localName || movie.typeName);
    const from = cleanValue(get('vod_play_from', 'play_from', 'playFrom', 'vod_play_from_name'));
    const play = cleanValue(get('vod_play_url', 'play_url', 'playUrl', 'url', 'vod_url'));
    const sourceNames = splitMulti(from);
    const sourceUrls = splitMulti(play);
    movie.play = sourceUrls.map((value, index) => ({ name: sourceNames[index] || `线路${index + 1}`, value }));
    movie.playBaseUrl = source.url;
    if (!movie.name) movie.name = `未命名-${vodId}`;
    return movie;
  }

  parsePlayLines(movie) {
    const result = [];
    const hasMultipleEpisodes = (movie.play || []).some(line => asText(line.value).split('#').filter(Boolean).length > 1);
    (movie.play || []).forEach((line, sourceIndex) => {
      const sourceName = line.name || `线路${sourceIndex + 1}`;
      const sourceSlug = slug(sourceName);
      const sourceCode = sourceSlug === 'default' ? `source_${sourceIndex + 1}` : sourceSlug;
      const tokens = asText(line.value).split('#').map(item => item.trim()).filter(Boolean);
      (tokens.length ? tokens : [ line.value ]).forEach((token, episodeIndex) => {
        const split = token.split('$');
        const title = split.length > 1 ? split[0] : `${movie.name} ${episodeIndex + 1}`;
        const rawUrl = split.length > 1 ? split.slice(1).join('$') : token;
        const url = resolveMediaUrl(rawUrl, movie.playBaseUrl);
        if (url) result.push({ sourceName, sourceCode, title, url, episode: hasMultipleEpisodes ? episodeIndex + 1 : 0, sourceIndex });
      });
    });
    return result;
  }

  async upsertMovie(source, normalized) {
    const Movie = this.ctx.model.Movie;
    const existing = await Movie.findOne({ sourceId: normalized.sourceId, vodId: normalized.vodId }).select('_id viewCount likeCount').lean();
    const movie = { ...normalized };
    delete movie.play;
    delete movie.playBaseUrl;
    const row = await Movie.findOneAndUpdate(
      { sourceId: movie.sourceId, vodId: movie.vodId },
      { $set: movie, $setOnInsert: { viewCount: 0, likeCount: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return { row, isNew: !existing, play: normalized.play || [] };
  }

  async upsertPlayData(movieRow, normalized) {
    const Movie = this.ctx.model.Movie;
    const Episode = this.ctx.model.Episode;
    const PlaySource = this.ctx.model.PlaySource;
    const PlayUrl = this.ctx.model.PlayUrl;
    const lines = this.parsePlayLines(normalized);
    // 列表接口可能暂时不返回播放地址，此时保留旧播放数据，避免增量采集把可播放内容清空。
    if (!lines.length) return;
    const episodes = new Map();
    // 电影多线路不需要 Episode 0；旧版本曾生成过该占位集时只停用，不删除历史数据。
    await Episode.updateMany({ movieId: movieRow._id, episode: 0 }, { $set: { status: 0 } });
    for (const line of lines) {
      const source = await PlaySource.findOneAndUpdate(
        { movieId: movieRow._id, code: line.sourceCode },
        { $set: { name: line.sourceName, playerType: /m3u8/i.test(line.url) ? 'm3u8' : 'url', sort: line.sourceIndex, status: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      let episodeId = null;
      if (line.episode > 0) {
        const episode = await Episode.findOneAndUpdate(
          { movieId: movieRow._id, episode: line.episode },
          { $set: { episodeName: line.title, sort: line.episode, status: 1 } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        episodeId = episode._id;
        episodes.set(line.episode, episode);
      }
      const duplicate = await PlayUrl.findOne({ movieId: movieRow._id, url: line.url }).select('_id').lean();
      const filter = duplicate ? { _id: duplicate._id } : { movieId: movieRow._id, episodeId, sourceId: source.code };
      await PlayUrl.findOneAndUpdate(filter, {
        $set: { movieId: movieRow._id, episodeId, sourceId: source.code, episode: line.episode, title: line.title, url: line.url, urlType: /m3u8/i.test(line.url) ? 'm3u8' : 'url', sort: line.sourceIndex, status: 1 },
      }, { upsert: true, new: true, setDefaultsOnInsert: true });
    }
    const sourceCodes = [ ...new Set(lines.map(line => line.sourceCode)) ];
    const urls = [ ...new Set(lines.map(line => line.url)) ];
    await PlayUrl.updateMany({ movieId: movieRow._id, status: 1, sourceId: { $nin: sourceCodes } }, { $set: { status: 0 } });
    await PlayUrl.updateMany({ movieId: movieRow._id, status: 1, sourceId: { $in: sourceCodes }, url: { $nin: urls } }, { $set: { status: 0 } });
    await PlaySource.updateMany({ movieId: movieRow._id, status: 1, code: { $nin: sourceCodes } }, { $set: { status: 0 } });
    if (episodes.size) {
      const episodeNumbers = [ ...episodes.keys() ];
      await Episode.updateMany({ movieId: movieRow._id, status: 1, episode: { $nin: episodeNumbers } }, { $set: { status: 0 } });
      await Movie.updateOne({ _id: movieRow._id }, { $set: { episodeCount: episodes.size } });
    } else {
      await Episode.updateMany({ movieId: movieRow._id, status: 1 }, { $set: { status: 0 } });
      await Movie.updateOne({ _id: movieRow._id }, { $set: { episodeCount: 0 } });
    }
  }

  async log(task, source, level, action, message, meta = {}) {
    await this.ctx.model.CollectLog.create({ taskId: task._id, sourceId: source._id, level, action, message, meta }).catch(() => {});
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
    if (!source || source.status !== 1) {
      await this.ctx.model.CollectTask.updateOne({ _id: task._id, lockToken: token }, { $set: { status: 'failed', error: '采集源不存在或已停用', finishedAt: new Date() } });
      return null;
    }
    let page = task.page || 1;
    // 历史任务没有页数时按 10 页处理；maxPages=0 表示用户明确选择了全部采集。
    const requestedMaxPages = task.allPages === true ? 0 : (task.maxPages === undefined || task.maxPages === null ? 10 : asNumber(task.maxPages, 10));
    const maxPages = requestedMaxPages <= 0 ? 0 : Math.min(1000, Math.max(1, requestedMaxPages));
    const isAllPages = task.allPages === true || maxPages === 0;
    const endPage = maxPages ? (task.endPage > 0 ? Math.min(task.endPage, page + maxPages - 1) : page + maxPages - 1) : (task.endPage > 0 ? task.endPage : 0);
    if (!task.maxPages || !task.endPage) {
      await this.ctx.model.CollectTask.updateOne({ _id: task._id, lockToken: token }, { $set: { maxPages, endPage } });
    }
    const isRunning = async () => Boolean(await this.ctx.model.CollectTask.findOne({ _id: task._id, lockToken: token, status: 'running' }).select('_id').lean());
    try {
      // 全部采集优先使用接口 total/limit 计算页数，没有总数时直到空页结束，并保留安全上限。
      while (page <= 10000 && (!maxPages || page <= endPage)) {
        if (!(await isRunning())) return task;
        const payload = await this.fetchSource(source, page);
        const rows = this.extractRows(payload, source);
        if (!rows.length) break;
        const concurrency = Math.min(32, Math.max(1, asNumber(source.concurrency, 8) || 8));
        const processRow = async raw => {
          try {
            let normalized = this.normalize(raw, source);
            if (normalized && normalized.__skip) {
              await this.ctx.model.CollectTask.updateOne(
                { _id: task._id, lockToken: token },
                { $inc: { skippedCount: 1 } }
              );
              return;
            }
            if (!normalized) throw new Error('缺少 vodId');
            if (!(normalized.play || []).length) {
              try {
                const detailPayload = await this.fetchSource(source, page, { ac: 'detail', ids: normalized.vodId });
                const detailRows = this.extractRows(detailPayload, source);
                if (detailRows.length) normalized = this.normalize({ ...raw, ...detailRows[0] }, source) || normalized;
              } catch (error) {
                this.ctx.logger.warn(`[movie-collector] detail fetch failed for ${normalized.vodId}: ${error.message}`);
              }
            }
            const result = await this.upsertMovie(source, normalized);
            await this.upsertPlayData(result.row, normalized);
            await this.ctx.model.CollectTask.updateOne({ _id: task._id, lockToken: token }, { $inc: { [result.isNew ? 'createdCount' : 'updatedCount']: 1 } });
          } catch (error) {
            await this.ctx.model.CollectTask.updateOne({ _id: task._id, lockToken: token }, { $inc: { failedCount: 1 } });
            await this.log(task, source, 'error', 'movie', error.message, { raw });
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
        // 全部采集不能因为某一页返回数量不足本地 pageSize 就提前结束，下一页为空时自然结束。
        if ((pageCount && page >= pageCount) || (!isAllPages && rows.length < (source.pageSize || 20))) break;
        page += 1;
      }
      const completed = await this.ctx.model.CollectTask.updateOne(
        { _id: task._id, lockToken: token, status: 'running' },
        { $set: { status: 'success', message: '采集完成', finishedAt: new Date(), heartbeatAt: new Date() } }
      );
      if (Number(completed.matchedCount || completed.n)) await this.log(task, source, 'info', 'task', '采集完成');
    } catch (error) {
      if (!(await isRunning())) return task;
      await this.ctx.model.CollectTask.updateOne({ _id: task._id, lockToken: token }, { $set: { status: 'failed', error: error.message, message: '采集失败', finishedAt: new Date() } });
      await this.log(task, source, 'error', 'task', error.message);
    }
    return task;
  }
}

module.exports = MovieCollectorService;
