'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Controller = require('egg').Controller;
const { resolveTemplate } = require('../../utils/templateExistsCache');
const { getArticleRating, getArticleRatingCount } = require('../../utils/articleRating');

function hashId(id) {
  return crypto.createHash('md5').update(String(id)).digest('hex');
}

const articleCompanyNameFilesCache = new Map();
const ARTICLE_COMPANY_NAME_FILES_CACHE_MS = 30000;

class ArticleCbdPageController extends Controller {
  get articleCbdModel() {
    const { ctx } = this;
    return ctx.model.ArticleCbd || ctx.model.ArticleCBD || ctx.model.articleCbd;
  }

  getObjectId() {
    return this.ctx.app.mongoose.Types.ObjectId;
  }

  getArticleCompanyId(domain = {}) {
    const articleCompany = domain.articleCompany || domain.company;
    if (!articleCompany) return '';
    return String(articleCompany._id || articleCompany.id || articleCompany || '');
  }

  getListLimit() {
    return 12;
  }

  cleanId(id = '') {
    return decodeURIComponent(String(id || ''))
      .replace(/\/index\.html$/i, '')
      .replace(/\.html?$/i, '')
      .replace(/\/+$/g, '')
      .trim();
  }

  safeDirName(name = '') {
    return String(name || '')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\.\.+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 80);
  }

  getCacheDir() {
    return path.join(process.cwd(), 'cache', 'article_cbd');
  }

  getArticleCompanyCacheRoot() {
    return path.join(process.cwd(), 'cache', 'articlecompany');
  }

  getListCachePath(domain = {}) {
    const cacheDir = this.getCacheDir();
    return path.join(cacheDir, 'list_home.json');
  }

  getListPageCacheDir() {
    return path.join(process.cwd(), 'cache', 'article_cbd_list');
  }

  getListPageCacheName({ lastId = '', prevId = '', limit = 12 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 30);
    if (prevId) return `prev_${this.safeDirName(prevId)}_${safeLimit}.json`;
    if (lastId) return `last_${this.safeDirName(lastId)}_${safeLimit}.json`;
    return `home_${safeLimit}.json`;
  }

  getListPageCachePath(options = {}) {
    const cacheDir = path.resolve(this.getListPageCacheDir());
    const fileName = this.getListPageCacheName(options);
    const pageId = this.cleanId(options.lastId || options.prevId || '');
    const isObjectId = pageId && this.getObjectId().isValid(pageId);
    const h = isObjectId ? hashId(pageId) : '';
    const filePath = h
      ? path.resolve(cacheDir, h.slice(0, 2), h.slice(2, 4), fileName)
      : path.resolve(cacheDir, fileName);
    if (!filePath.startsWith(cacheDir + path.sep)) return '';
    return filePath;
  }

  getSafeCachePath(id = '') {
    const cleanId = this.cleanId(id);
    if (!cleanId || !this.getObjectId().isValid(cleanId)) return '';

    const cacheDir = this.getCacheDir();
    const resolvedCacheDir = path.resolve(cacheDir);
    const h = hashId(cleanId);
    const filePath = path.resolve(resolvedCacheDir, h.slice(0, 2), h.slice(2, 4), `${cleanId}.json`);
    if (!filePath.startsWith(resolvedCacheDir + path.sep)) return '';

    return filePath;
  }

  getSafeArticleJsonPath(cacheDir, articleName = '') {
    if (!articleName) return '';

    const resolvedCacheDir = path.resolve(cacheDir);
    const articleNameText = String(articleName);
    const h = /^\d+$/.test(articleNameText) ? '' : hashId(articleNameText);
    const filePath = /^\d+$/.test(articleNameText)
      ? path.resolve(resolvedCacheDir, String(Math.floor(Number(articleNameText) / 1000) + 1), `${articleNameText}.json`)
      : path.resolve(resolvedCacheDir, 'name', h.slice(0, 2), h.slice(2, 4), `${h}.json`);
    if (!filePath.startsWith(resolvedCacheDir + path.sep)) return '';

    return filePath;
  }

  getLegacySafeArticleJsonPaths(cacheDir, articleName = '') {
    if (!articleName || /^\d+$/.test(String(articleName))) return [];

    const resolvedCacheDir = path.resolve(cacheDir);
    const articleNameText = String(articleName);
    return [
      path.resolve(resolvedCacheDir, 'name', `${hashId(articleNameText)}.json`),
      path.resolve(resolvedCacheDir, 'name', `${articleNameText}.json`),
    ].filter(filePath => filePath.startsWith(resolvedCacheDir + path.sep));
  }

  async readArticleCompanyJson(cacheDir, articleName = '') {
    const articlePath = this.getSafeArticleJsonPath(cacheDir, articleName);
    if (articlePath) {
      try {
        return await this.readJsonFile(articlePath);
      } catch (e) {
        // Try legacy flat name cache path below.
      }
    }

    const legacyPaths = this.getLegacySafeArticleJsonPaths(cacheDir, articleName);
    for (const legacyPath of legacyPaths) {
      if (!legacyPath || legacyPath === articlePath) continue;
      try {
        return await this.readJsonFile(legacyPath);
      } catch (e) {
        // Continue trying any remaining legacy path.
      }
    }

    return null;
  }

  async readJsonFile(filePath) {
    return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
  }

  async readDetailCache(id) {
    const filePath = this.getSafeCachePath(id);
    if (!filePath) return null;

    try {
      return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
    } catch (e) {
      return null;
    }
  }

  async writeDetailCache(id, data) {
    const filePath = this.getSafeCachePath(id);
    if (!filePath) return;

    try {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      // Cache write failure should not affect page rendering.
    }
  }

  async readListHomeCache(domain) {
    const filePath = this.getListCachePath(domain);

    try {
      const data = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
      const cacheTime = Number(data.cacheTime || 0);
      const dayMs = 24 * 60 * 60 * 1000;
      if (!cacheTime || Date.now() - cacheTime > dayMs) return null;
      if (Array.isArray(data.list) && data.list.length && data.list.every(item => item && item.image === undefined)) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  buildHomePageDataFromList(list = [], limit = this.getListLimit()) {
    const safeLimit = Math.max(Number(limit) || this.getListLimit(), 1);
    const normalizedList = Array.isArray(list)
      ? list.slice(0, safeLimit).map(item => this.withoutContent(this.normalizeArticle(item)))
      : [];
    const firstItem = normalizedList.length ? normalizedList[0] : null;
    const lastItem = normalizedList.length ? normalizedList[normalizedList.length - 1] : null;

    return {
      list: normalizedList,
      hasMore: Array.isArray(list) && list.length > safeLimit,
      hasPrev: false,
      nextLastId: lastItem ? lastItem._id : '',
      nextLastTitle: lastItem ? lastItem.title : '',
      nextLastDescription: lastItem ? lastItem.description : '',
      prevFirstId: firstItem ? firstItem._id : '',
    };
  }

  normalizeHomePageData(data = {}, limit = this.getListLimit()) {
    if (Array.isArray(data)) return this.buildHomePageDataFromList(data, limit);
    if (!data || typeof data !== 'object' || !Array.isArray(data.list)) return null;

    const list = data.list.map(item => this.withoutContent(this.normalizeArticle(item)));
    const firstItem = list.length ? list[0] : null;
    const lastItem = list.length ? list[list.length - 1] : null;
    return {
      ...data,
      list,
      hasMore: Boolean(data.hasMore),
      hasPrev: Boolean(data.hasPrev),
      nextLastId: data.nextLastId || (lastItem ? lastItem._id : ''),
      nextLastTitle: data.nextLastTitle || (lastItem ? lastItem.title : ''),
      nextLastDescription: data.nextLastDescription || (lastItem ? lastItem.description : ''),
      prevFirstId: data.prevFirstId || (firstItem ? firstItem._id : ''),
    };
  }

  async readHomeListCache(domain, limit) {
    try {
      const redisList = await this.ctx.service.cache.get('articleCbdList:1');
      const redisData = this.normalizeHomePageData(redisList, limit);
      if (redisData && redisData.list.length) {
        const cacheInfo = await this.ctx.service.cache.get('articleCbdList:count');
        const total = Number(cacheInfo && cacheInfo.total) || 0;
        const batchCount = Number(cacheInfo && cacheInfo.count) || 0;
        redisData.hasMore = total > redisData.list.length || batchCount > 1;
        return redisData;
      }
    } catch (e) {
      // Redis cache miss should fall through to file cache.
    }

    const fileData = await this.readListHomeCache(domain);
    const homeData = this.normalizeHomePageData(fileData, limit);
    if (homeData && homeData.list.length) return homeData;

    return null;
  }

  async writeListHomeCache(domain, data) {
    const filePath = this.getListCachePath(domain);

    try {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(
        filePath,
        JSON.stringify({
          ...data,
          cacheTime: Date.now(),
          cacheDate: new Date().toISOString(),
        }, null, 2),
        'utf8'
      );
      await this.writeRelatedListCache(domain);
    } catch (e) {
      // Cache write failure should not affect page rendering.
    }
  }

  async readListPageCache(options = {}) {
    const filePath = this.getListPageCachePath(options);
    if (!filePath) return null;

    try {
      const data = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
      const cacheTime = new Date(data.cacheDate || data.createdAt || data.cacheTime || 0).getTime();
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      if (!cacheTime || Date.now() - cacheTime > threeDaysMs) return null;
      if (!Array.isArray(data.list)) return null;
      if (data.list.length && data.list.every(item => item && item.image === undefined)) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  async writeListPageCache(options = {}, data = {}) {
    const filePath = this.getListPageCachePath(options);
    if (!filePath) return;

    try {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(
        filePath,
        JSON.stringify({
          ...data,
          cacheTime: Date.now(),
          cacheDate: new Date().toISOString(),
        }, null, 2),
        'utf8'
      );
    } catch (e) {
      // Cache write failure should not affect page rendering.
    }
  }

  formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  replaceTdkVars(item = {}, domain = {}) {
    const { ctx } = this;
    if (!item || typeof item !== 'object') return item;

    const keywordText = item.keywords || item.keyWords || '';
    const replacements = [
      [/\[域名\]|域名/g, domain.fullDomain || ''],
      [/\[站名\]|站名/g, domain.beiAnName || ''],
      [/\[版本号\]|版本号/g, domain.banBenNumber || ''],
      [/\[关键字\]|关键字/g, keywordText],
      [/\[符号\]|符号/g, ctx.service.utils.urlToemoj((domain.fullDomain || '') + ctx.url)],
      [/\[字母\]|字母/g, ctx.service.utils.urlToStr((domain.fullDomain || '') + ctx.url)],
      [/\[数字\]|数字/g, domain.urlNumber || ''],
    ];

    ['title', 'description', 'keywords', 'keyWords'].forEach(field => {
      if (!item[field]) return;
      item[field] = replacements.reduce((value, [pattern, replacement]) => {
        return value.replace(pattern, replacement);
      }, String(item[field]));
    });

    item.keyWords = item.keyWords || item.keywords || '';
    item.keywords = item.keywords || item.keyWords || '';
    return item;
  }

  normalizeArticle(item = {}) {
    const id = String(item._id || item.id || '');
    return {
      ...item,
      _id: id,
      id,
      nowName: item.nowName || '',
      prevName: item.prevName || '',
      nextName: item.nextName || '',
      url: `/v-nd/${id}.html`,
      keyWords: item.keyWords || item.keywords || '',
      createdText: this.formatDate(item.createdAt || item.updatedAt),
    };
  }

  withoutContent(item = {}) {
    const { content, ...rest } = item;
    return rest;
  }

  normalizeArticleCompanyArticle(item = {}, articleName = '') {
    const id = String(item._id || item.id || articleName || '');
    const pageName = item.nowName || articleName || id;
    return {
      ...item,
      _id: id,
      id,
      url: `/v-nd/${pageName}.html`,
      keyWords: item.keyWords || item.keywords || '',
      keywords: item.keywords || item.keyWords || '',
      createdText: item.createdText || item.time || this.formatDate(item.createdAt || item.updatedAt),
    };
  }

  buildCriteria(domain = {}) {
    const criteria = {};
    const articleCompanyId = this.getArticleCompanyId(domain);
    if (domain.isArticleCompany && articleCompanyId && this.getObjectId().isValid(articleCompanyId)) {
      criteria.articleCompany = articleCompanyId;
    }
    return criteria;
  }

  getRelatedBatchSize() {
    return 12;
  }

  getRelatedCacheKey(index = 1) {
    return `articleCbdList:${index}`;
  }

  getRelatedCacheCountKey() {
    return 'articleCbdList:count';
  }

  uniqueRelatedRows(rows = []) {
    const seen = new Set();
    return rows.filter(item => {
      const id = String(item && (item._id || item.id) || '');
      const title = String(item && item.title || '').trim();
      const key = id || title;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async writeRelatedListCache(domain = {}) {
    const batchSize = this.getRelatedBatchSize();
    const rows = await this.articleCbdModel
      .find({})
      .sort({ _id: -1 })
      .limit(120)
      .select('title description image')
      .lean();

    const list = this.uniqueRelatedRows(rows).map(item => ({
      _id: String(item._id || item.id || ''),
      title: item.title || '',
      description: item.description || '',
      image: item.image || '',
    }));

    const batchCount = Math.ceil(list.length / batchSize);
    await this.ctx.service.cache.del('articleCbdList');
    for (let index = 1; index <= batchCount; index++) {
      await this.ctx.service.cache.set(
        this.getRelatedCacheKey(index),
        list.slice((index - 1) * batchSize, index * batchSize)
      );
    }
    await this.ctx.service.cache.set(this.getRelatedCacheCountKey(), {
      count: batchCount,
      size: batchSize,
      total: list.length,
      cacheTime: Date.now(),
    });
  }

  async readRelatedListCache(domain = {}, currentId = '') {
    try {
      const cacheInfo = await this.ctx.service.cache.get(this.getRelatedCacheCountKey());
      const batchCount = Math.max(Number(cacheInfo && cacheInfo.count) || 10, 1);
      const startIndex = Math.floor(Math.random() * batchCount) + 1;

      for (let offset = 0; offset < batchCount; offset++) {
        const keyIndex = ((startIndex - 1 + offset) % batchCount) + 1;
        const list = await this.ctx.service.cache.get(this.getRelatedCacheKey(keyIndex));
        if (!Array.isArray(list) || !list.length) continue;

        const relatedList = list.filter(item => String(item && (item._id || item.id) || '') !== String(currentId));
        for (let index = relatedList.length - 1; index > 0; index--) {
          const randomIndex = Math.floor(Math.random() * (index + 1));
          const tmp = relatedList[index];
          relatedList[index] = relatedList[randomIndex];
          relatedList[randomIndex] = tmp;
        }
        if (relatedList.length) return relatedList.slice(0, 8);
      }
    } catch (e) {
      return [];
    }

    return [];
  }

  getArticleCompanyNumCacheKey(domain, dirName) {
    const articleCompany = domain && (domain.articleCompany || domain.company);
    const factoryId = articleCompany ? articleCompany._id || articleCompany.id || articleCompany : '';
    return `articleCompany:${factoryId}:${dirName || ''}`;
  }

  async getDomainArticleCompany(domain, forceFresh = false) {
    if (!domain) return null;
    const domainCompany = domain.articleCompany || domain.company;
    const factoryId = domainCompany ? domainCompany._id || domainCompany.id || domainCompany : '';

    if (!forceFresh && domainCompany && (domainCompany.fileName || domainCompany.filename)) {
      return domainCompany;
    }

    try {
      if (forceFresh && domain._id && this.ctx.model.Domain) {
        const fullDomain = await this.ctx.model.Domain
          .findById(domain._id)
          .populate({ path: 'articleCompany', select: 'name id tdkNums fileName' })
          .select('articleCompany isArticleCompany')
          .lean();
        if (fullDomain && fullDomain.articleCompany) return fullDomain.articleCompany;
      }

      const ArticleCompanyModel = this.ctx.model.ArticleComapany || this.ctx.model.ArticleCompany || this.ctx.model.articleCompany;
      if (factoryId && ArticleCompanyModel) {
        const articleCompany = await ArticleCompanyModel.findById(factoryId).lean();
        if (articleCompany) return articleCompany;
      }

      if (domainCompany && (domainCompany.fileName || domainCompany.filename)) return domainCompany;
      return null;
    } catch (e) {
      if (domainCompany && (domainCompany.fileName || domainCompany.filename)) return domainCompany;
      return null;
    }
  }

  async getArticleCompanyNum(cacheDir, domain, dirName, articleCompany) {
    const cacheKey = this.getArticleCompanyNumCacheKey({ ...domain, articleCompany }, dirName);
    try {
      const cacheNum = await this.ctx.service.cache.get(cacheKey);
      const redisTotal = Number(cacheNum);
      if (redisTotal && !Number.isNaN(redisTotal)) {
        return redisTotal;
      }
    } catch (e) {
      // Article factory total is stored in Redis by the generator.
    }

    return 0;
  }

  getRequestNumber(rawId = '', fallbackValue = 0) {
    const cleanValue = String(rawId || '').trim();
    if (/^\d+$/.test(cleanValue)) return Number(cleanValue);

    if (cleanValue) {
      return this.ctx.service.utils.strToNumber(cleanValue) || Number(fallbackValue) || 0;
    }

    return Number(fallbackValue) || 0;
  }

  async readArticleCompanyByName(domain, articleName = '', options = {}) {
    if (!articleName || !domain) {
      return null;
    }

    const articleCompany = await this.getDomainArticleCompany(domain, Boolean(options.forceFreshCompany));
    if (!articleCompany || (!articleCompany.fileName && !articleCompany.filename)) return null;

    const dirName = this.safeDirName(articleCompany.fileName || articleCompany.filename);
    const cacheDir = path.join(this.getArticleCompanyCacheRoot(), dirName);

    try {
      const article = await this.readArticleCompanyJson(cacheDir, articleName);
      if (!article) return null;
      return this.normalizeArticleCompanyArticle(article, articleName);
    } catch (e) {
      return null;
    }
  }

  async getArticleCompanyNameJsonPaths(cacheDir) {
    const nameDir = path.resolve(cacheDir, 'name');
    const now = Date.now();
    const cached = articleCompanyNameFilesCache.get(nameDir);
    if (cached && now - cached.updatedAt < ARTICLE_COMPANY_NAME_FILES_CACHE_MS) {
      return cached.paths;
    }

    const paths = [];
    const collect = async currentDir => {
      let entries = [];
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch (e) {
        return;
      }

      for (const entry of entries) {
        const entryPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await collect(entryPath);
        } else if (entry.isFile() && /\.json$/i.test(entry.name)) {
          paths.push(entryPath);
        }
      }
    };

    await collect(nameDir);
    paths.sort((left, right) => left.localeCompare(right, 'zh-Hans-CN', { numeric: true }));
    articleCompanyNameFilesCache.set(nameDir, { paths, updatedAt: now });
    return paths;
  }

  async readArticleCompanyNameByUrl(domain, url = '', options = {}) {
    const articleCompany = await this.getDomainArticleCompany(domain, Boolean(options.forceFreshCompany));
    if (!articleCompany || (!articleCompany.fileName && !articleCompany.filename)) return null;

    const dirName = this.safeDirName(articleCompany.fileName || articleCompany.filename);
    const cacheDir = path.join(this.getArticleCompanyCacheRoot(), dirName);
    const paths = await this.getArticleCompanyNameJsonPaths(cacheDir);
    if (!paths.length) return null;

    const urlNumber = Math.abs(Math.floor(Number(this.ctx.service.utils.strToNumber(url)) || 0));
    const startIndex = urlNumber % paths.length;
    for (let offset = 0; offset < paths.length; offset++) {
      const filePath = paths[(startIndex + offset) % paths.length];
      try {
        const article = await this.readJsonFile(filePath);
        return this.normalizeArticleCompanyArticle(article, path.basename(filePath, '.json'));
      } catch (e) {
        // Skip an unreadable JSON and try the next stable name-cache item.
      }
    }

    return null;
  }

  async renderArticleNotFound(domain) {
    if (domain && domain.isMuLu) {
      return await this.ctx.service.utils.allPage();
    }
    return this.ctx.render('404.html');
  }

  async readArticleCompanyByNumber(domain, numberValue, options = {}) {
    if (!domain) {
      return null;
    }

    const articleCompany = await this.getDomainArticleCompany(domain, Boolean(options.forceFreshCompany));
    if (!articleCompany || (!articleCompany.fileName && !articleCompany.filename)) return null;

    const dirName = this.safeDirName(articleCompany.fileName || articleCompany.filename);
    const cacheDir = path.join(this.getArticleCompanyCacheRoot(), dirName);
    const total = await this.getArticleCompanyNum(cacheDir, domain, dirName, articleCompany);
    if (!total || Number.isNaN(total)) return null;

    const urlNumber = Math.abs(Number(numberValue) || 0);
    const articleName = String(urlNumber % total);
    const articlePath = this.getSafeArticleJsonPath(cacheDir, articleName);
    if (!articlePath) return null;

    try {
      const article = await this.readJsonFile(articlePath);
      return this.normalizeArticleCompanyArticle(article, articleName);
    } catch (e) {
      return null;
    }
  }

  async readArticleCompanyFallback(domain, rawId = '') {
    try {
      const articleName = this.cleanId(rawId);
      const exactArticle = await this.readArticleCompanyByName(domain, articleName);
      if (exactArticle) return exactArticle;

      const requestUrl = `${domain && domain.fullDomain || this.ctx.host || ''}${this.ctx.url || ''}`;
      const nameArticle = await this.readArticleCompanyNameByUrl(domain, requestUrl);
      if (nameArticle) return nameArticle;

      const freshExactArticle = await this.readArticleCompanyByName(domain, articleName, { forceFreshCompany: true });
      if (freshExactArticle) return freshExactArticle;

      return await this.readArticleCompanyNameByUrl(domain, requestUrl, { forceFreshCompany: true });
    } catch (e) {
      return null;
    }
  }

  async getArticlePage(domain, { limit, lastId, prevId, useArticleCompany = false } = {}) {
    const criteria = useArticleCompany ? this.buildCriteria(domain) : {};
    const ObjectId = this.getObjectId();
    const isPrev = prevId && ObjectId.isValid(prevId);

    if (isPrev) {
      criteria._id = { $gt: prevId };
    } else if (lastId && ObjectId.isValid(lastId)) {
      criteria._id = { $lt: lastId };
    }

    const rows = await this.articleCbdModel
      .find(criteria)
      .sort({ _id: isPrev ? 1 : -1 })
      .limit(limit + 1)
      .select('title keywords description image block articleCompany createdAt updatedAt')
      .lean();

    const hasExtra = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    if (isPrev) pageRows.reverse();
    const list = pageRows.map(item => this.withoutContent(this.normalizeArticle(item)));
    const firstId = list.length ? list[0]._id : '';
    const lastItem = list.length ? list[list.length - 1] : null;
    const lastItemId = lastItem ? lastItem._id : '';

    return {
      list,
      hasMore: isPrev ? Boolean(lastItemId) : hasExtra,
      hasPrev: isPrev ? hasExtra : Boolean(lastId),
      nextLastId: lastItemId,
      nextLastTitle: lastItem ? lastItem.title : '',
      nextLastDescription: lastItem ? lastItem.description : '',
      prevFirstId: firstId,
    };
  }

  async renderTemplate(templateName, fallbackName, result) {
    const { ctx } = this;
    const domain = result.domain || {};
    const ratingArticle = result.detail || {};
    result.ratingValue = result.ratingValue || getArticleRating(ratingArticle, domain);
    result.ratingCount = result.ratingCount || getArticleRatingCount(ratingArticle);
    const templatePath = path.join(process.cwd(), 'app', 'view', 'template', domain.tname || '', templateName);

    const renderName = domain.tname
      ? resolveTemplate(
        `${domain.tname}:${templateName}`,
        templatePath,
        `template/${domain.tname}/${templateName}`,
        `template/components/${fallbackName || templateName}`
      )
      : `template/components/${fallbackName || templateName}`;

    return ctx.render(renderName, result).catch(() => ctx.render('error.html'));
  }

  async articleList() {
    const { ctx } = this;
    const { site, domain } = await ctx.service.utils.getSiteInfo();

    if (!domain || !domain._id) {
      return ctx.render('404.html');
    }

    const limit = this.getListLimit();
    const lastId = this.cleanId(ctx.query.lastId || '');
    const prevId = this.cleanId(ctx.query.prevId || '');
    const listCacheOptions = { lastId, prevId, limit };
    const isHomeRequest = !lastId && !prevId;
    let pageData = isHomeRequest
      ? await this.readHomeListCache(domain, limit)
      : await this.readListPageCache(listCacheOptions);
    if (!pageData) {
      pageData = await this.getArticlePage(domain, { limit, lastId, prevId });
      if (isHomeRequest) {
        await this.writeListHomeCache(domain, pageData);
      } else {
        await this.writeListPageCache(listCacheOptions, pageData);
      }
    }

    if (ctx.query.ajax === '1' || ctx.query.format === 'json') {
      const renderList = pageData.list.map(item => this.replaceTdkVars(this.withoutContent({ ...item }), domain));
      ctx.body = {
        code: 200,
        data: renderList,
        hasMore: pageData.hasMore,
        nextLastId: pageData.nextLastId,
      };
      return;
    }

    const articleList = pageData.list.map(item => this.replaceTdkVars(this.withoutContent({ ...item }), domain));
    const lastItem = articleList.length ? articleList[articleList.length - 1] : null;
    const nextLastTitle = lastItem ? lastItem.title : pageData.nextLastTitle;
    const nextLastDescription = lastItem ? lastItem.description : pageData.nextLastDescription;

    const result = {
      siteInfo: site || {},
      domain,
      articleList,
      hasMore: pageData.hasMore,
      hasPrev: pageData.hasPrev,
      nextLastId: pageData.nextLastId,
      nextLastTitle,
      nextLastDescription,
      listTitle: nextLastTitle || (articleList[0] ? articleList[0].title : ''),
      listDescription: nextLastDescription || (articleList[0] ? articleList[0].description : domain.description || ''),
      prevFirstId: pageData.prevFirstId,
      pageSize: limit,
      userConfig: ctx.app.config.MY_USER_CONFIG,
      titleCP: domain.title || domain.titleText || '',
    };

    return this.renderTemplate('article_cdb_list.html', 'article_cdb_list.html', result);
  }

  async articleDetail() {
    const { ctx } = this;
    const { site, domain } = await ctx.service.utils.getSiteInfo();

    if (!domain || !domain._id) {
      return this.renderArticleNotFound(domain);
    }

    const id = this.cleanId(ctx.params.id || '');
    if (!id || !this.getObjectId().isValid(id)) {
      const fallbackArticle = await this.readArticleCompanyFallback(domain, id);
      if (fallbackArticle) {
        const article = this.replaceTdkVars({ ...fallbackArticle }, domain);
        const relatedList = await this.readRelatedListCache(domain, id);
        return this.renderTemplate('article_cbd_detail.html', 'article_cbd_detail.html', {
          siteInfo: site || {},
          domain,
          detail: article,
          relatedList: relatedList.map(item => this.replaceTdkVars(this.normalizeArticle(item), domain)),
          userConfig: ctx.app.config.MY_USER_CONFIG,
          titleCP: article.title || domain.title || domain.titleText || '',
        });
      }

      return this.renderArticleNotFound(domain);
    }

    const cachedResult = await this.readDetailCache(id);
    if (cachedResult && !cachedResult.detail && cachedResult.article) {
      cachedResult.detail = cachedResult.article;
    }
    if (cachedResult && cachedResult.article) {
      delete cachedResult.article;
    }
    const cachedDetail = cachedResult && cachedResult.detail;
    const hasCachedNavigationNames = cachedDetail
      && Object.prototype.hasOwnProperty.call(cachedDetail, 'nowName')
      && Object.prototype.hasOwnProperty.call(cachedDetail, 'prevName')
      && Object.prototype.hasOwnProperty.call(cachedDetail, 'nextName');
    if (cachedDetail && cachedDetail.image !== undefined && hasCachedNavigationNames) {
      cachedResult.domain = domain;
      cachedResult.siteInfo = site || {};
      cachedResult.userConfig = ctx.app.config.MY_USER_CONFIG;
      cachedResult.detail = this.replaceTdkVars(cachedResult.detail, domain);
      const relatedList = await this.readRelatedListCache(domain, id);
      cachedResult.relatedList = relatedList.map(item => this.replaceTdkVars(this.normalizeArticle(item), domain));
      cachedResult.titleCP = cachedResult.detail.title;
      return this.renderTemplate('article_cbd_detail.html', 'article_cbd_detail.html', cachedResult);
    }

    const criteria = { _id: id };

    const detail = await this.articleCbdModel
      .findOne(criteria)
      .populate({ path: 'articleCompany', select: 'name fileName' })
      .select('title keywords description content image block articleCompany nowName prevName nextName createdAt updatedAt')
      .lean();

    if (!detail) {
      const fallbackArticle = await this.readArticleCompanyFallback(domain, id);
      if (fallbackArticle) {
        const article = this.replaceTdkVars({ ...fallbackArticle }, domain);
        const relatedList = await this.readRelatedListCache(domain, id);
        return this.renderTemplate('article_cbd_detail.html', 'article_cbd_detail.html', {
          siteInfo: site || {},
          domain,
          detail: article,
          relatedList: relatedList.map(item => this.replaceTdkVars(this.normalizeArticle(item), domain)),
          userConfig: ctx.app.config.MY_USER_CONFIG,
          titleCP: article.title || domain.title || domain.titleText || '',
        });
      }

      return this.renderArticleNotFound(domain);
    }

    const relatedList = await this.readRelatedListCache(domain, id);

    const rawArticle = this.normalizeArticle(detail);
    const article = this.replaceTdkVars({ ...rawArticle }, domain);
    const result = {
      siteInfo: site || {},
      domain,
      detail: article,
      relatedList: relatedList.map(item => this.replaceTdkVars(this.normalizeArticle(item), domain)),
      userConfig: ctx.app.config.MY_USER_CONFIG,
      titleCP: article.title,
    };

    await this.writeDetailCache(id, {
      detail: rawArticle,
      titleCP: rawArticle.title,
    });

    return this.renderTemplate('article_cbd_detail.html', 'article_cbd_detail.html', result);
  }
}

module.exports = ArticleCbdPageController;
