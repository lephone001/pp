'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Controller = require('egg').Controller;
const { resolveTemplate } = require('../../utils/templateExistsCache');
const { getArticleRating, getArticleRatingCount } = require('../../utils/articleRating');

const articleCompanyNameFilesCache = new Map();
const ARTICLE_COMPANY_NAME_FILES_CACHE_MS = 30000;

class ArticleComapmyController extends Controller {
  safeDirName(name = '') {
    return String(name || '')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\.\.+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 80);
  }

  getRequestArticleName() {
    const { ctx } = this;
    const routeName = ctx.params[0] || ctx.params.name || '';
    let routeText = String(routeName || '');
    try {
      routeText = decodeURIComponent(routeText);
    } catch (e) {
      // Keep the raw path when a malformed URL is received.
    }
    const cleanPath = routeText
      .replace(/^\/+/, '')
      .replace(/\?.*$/, '')
      .replace(/\/+$/, '');
    const fileName = cleanPath.split('/').filter(Boolean).pop() || '';

    return fileName
      .replace(/\.json$/i, '')
      .replace(/\.html?$/i, '');
  }

  hashArticleCompanyName(name = '') {
    return crypto.createHash('md5').update(String(name || '')).digest('hex');
  }

  getArticleCompanyNameFileName(articleName = '') {
    return `${this.hashArticleCompanyName(articleName)}.json`;
  }

  getArticleCompanyNamePath(cacheDir, articleName = '') {
    const resolvedCacheDir = path.resolve(cacheDir);
    const hash = this.hashArticleCompanyName(articleName);
    const filePath = path.resolve(resolvedCacheDir, 'name', hash.slice(0, 2), hash.slice(2, 4), `${hash}.json`);
    if (!filePath.startsWith(resolvedCacheDir + path.sep)) {
      return '';
    }

    return filePath;
  }

  getLegacyArticleCompanyNamePath(cacheDir, articleName = '') {
    const resolvedCacheDir = path.resolve(cacheDir);
    const filePath = path.resolve(resolvedCacheDir, 'name', this.getArticleCompanyNameFileName(articleName));
    if (!filePath.startsWith(resolvedCacheDir + path.sep)) {
      return '';
    }

    return filePath;
  }

  getSafeArticleJsonPath(cacheDir, articleName) {
    if (!articleName) return '';

    const resolvedCacheDir = path.resolve(cacheDir);
    const articleNameText = String(articleName);
    const filePath = /^\d+$/.test(articleNameText)
      ? path.resolve(resolvedCacheDir, String(Math.floor(Number(articleNameText) / 1000) + 1), `${articleNameText}.json`)
      : this.getArticleCompanyNamePath(resolvedCacheDir, articleNameText);
    if (!filePath.startsWith(resolvedCacheDir + path.sep)) {
      return '';
    }

    return filePath;
  }

  normalizeDetail(detail = {}, articleName = '') {
    detail._id = detail._id || articleName;
    detail.id = detail.id || articleName;
    detail.title = detail.title || detail.name || articleName;
    detail.description = detail.description || detail.desc || '';
    detail.content = detail.content || detail.body || '';
    detail.keyWords = detail.keyWords || detail.keywords || '';
    detail.keywords = detail.keywords || detail.keyWords || '';
    detail.createdText = detail.createdText
      || detail.time
      || (detail.createdAt ? String(detail.createdAt).slice(0, 10) : '');
    return detail;
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

  async readArticleJson(filePath, articleName = '') {
    const detail = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
    return this.normalizeDetail(detail, articleName || path.basename(filePath, '.json'));
  }

  async readArticleJsonWithFallback(cacheDir, articleName = '') {
    const articleJsonPath = this.getSafeArticleJsonPath(cacheDir, articleName);
    if (articleJsonPath) {
      try {
        return await this.readArticleJson(articleJsonPath, articleName);
      } catch (e) {
        // Try the legacy flat name path below.
      }
    }

    if (!/^\d+$/.test(String(articleName))) {
      const legacyPath = this.getLegacyArticleCompanyNamePath(cacheDir, articleName);
      if (legacyPath && legacyPath !== articleJsonPath) {
        try {
          return await this.readArticleJson(legacyPath, articleName);
        } catch (e) {
          return null;
        }
      }
    }

    return null;
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

  async readArticleCompanyNameFallback(cacheDir, url = '') {
    const paths = await this.getArticleCompanyNameJsonPaths(cacheDir);
    if (!paths.length) return null;

    const urlNumber = Math.abs(Math.floor(Number(this.ctx.service.utils.strToNumber(url)) || 0));
    const startIndex = urlNumber % paths.length;
    for (let offset = 0; offset < paths.length; offset++) {
      const filePath = paths[(startIndex + offset) % paths.length];
      try {
        return await this.readArticleJson(filePath, path.basename(filePath, '.json'));
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

  async getDomainArticleCompany(domain, forceFresh = false) {
    if (!domain) return null;
    const domainCompany = domain.articleCompany || domain.company;

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
    } catch (e) {
      // Fall back to the cached domain object below.
    }

    if (domainCompany && (domainCompany.fileName || domainCompany.filename)) return domainCompany;
    return null;
  }

  getArticleCompanyNumCacheKey(domain, dirName) {
    const factoryId = domain && domain.articleCompany ? domain.articleCompany._id || domain.articleCompany.id || '' : '';
    return `articleCompany:${factoryId}:${dirName || ''}`;
  }

  async getArticleCompanyNum(cacheDir, domain, dirName) {
    const cacheKey = this.getArticleCompanyNumCacheKey(domain, dirName);
    const cacheNum = await this.ctx.service.cache.get(cacheKey);
    const redisTotal = Math.floor(Number(cacheNum));
    if (Number.isFinite(redisTotal) && redisTotal > 0) {
      return redisTotal;
    }

    return 0;
  }

  async readFallbackArticle(cacheDir, domain, dirName) {
    try {
      const total = await this.getArticleCompanyNum(cacheDir, domain, dirName);
      if (!total) return null;

      const urlNumber = Math.abs(Math.floor(Number(domain.urlNumber) || 0));
      const articleName = String(urlNumber % total);
      return await this.readArticleJsonWithFallback(cacheDir, articleName);
    } catch (e) {
      return null;
    }
  }

  async readFreshFallbackArticle(domain) {
    const articleCompany = await this.getDomainArticleCompany(domain, true);
    if (!articleCompany || !(articleCompany.fileName || articleCompany.filename)) {
      return null;
    }

    domain.articleCompany = articleCompany;
    const dirName = this.safeDirName(articleCompany.fileName || articleCompany.filename);
    const cacheDir = path.join(process.cwd(), 'cache', 'articlecompany', dirName);
    return this.readFallbackArticle(cacheDir, domain, dirName);
  }

  async renderDetail(domain, detail = {}) {
    const { ctx } = this;
    detail = this.normalizeDetail(detail, this.getRequestArticleName());
    detail = this.replaceTdkVars(detail, domain);
    const result = {
      domain,
      detail,
      article: detail,
      relatedList: [],
      siteInfo: {},
      userConfig: ctx.app.config.MY_USER_CONFIG,
      titleCP: detail.title || domain.title || domain.titleText || '',
      ratingValue: getArticleRating(detail, domain),
      ratingCount: getArticleRatingCount(detail),
    };
    const templateName = 'article_cbd_detail.html';
    const templateDetailPath = path.join(process.cwd(), 'app', 'view', 'template', domain.tname || '', templateName);

    const renderName = domain.tname
      ? resolveTemplate(
        `${domain.tname}:${templateName}`,
        templateDetailPath,
        `template/${domain.tname}/${templateName}`,
        `template/components/${templateName}`
      )
      : `template/components/${templateName}`;

    return ctx.render(renderName, result).catch(() => {
      return ctx.render('error.html');
    });
  }

  async renderArticleCbdListFallback(domain) {
    const { ctx } = this;
    const listAction = ctx.app.controller
      && ctx.app.controller.page
      && ctx.app.controller.page.articleCbd
      && ctx.app.controller.page.articleCbd.articleList;
    if (typeof listAction !== 'function') {
      return this.renderArticleNotFound(domain);
    }

    try {
      return await listAction.call(ctx);
    } catch (error) {
      ctx.logger.warn('[article-company] articleCbd list fallback failed: %s', error && error.stack || error);
      return this.renderArticleNotFound(domain);
    }
  }

  async articlevn() {
    const { ctx } = this;
    const { domain } = await ctx.service.utils.getSiteInfo();

    if (!domain || !domain._id) {
      return ctx.render('404.html');
    }

    const articleCompany = await this.getDomainArticleCompany(domain);
    if (!domain.isArticleCompany || !articleCompany || !(articleCompany.fileName || articleCompany.filename)) {
      return this.renderArticleCbdListFallback(domain);
    }

    const articleName = this.getRequestArticleName();
    const cacheRoot = path.join(process.cwd(), 'cache', 'articlecompany');
    domain.articleCompany = articleCompany;
    const dirCacheName = this.safeDirName(articleCompany.fileName || articleCompany.filename);
    const cacheDir = path.join(cacheRoot, dirCacheName);
    try {
      const detail = await this.readArticleJsonWithFallback(cacheDir, articleName);
      if (!detail) {
        const requestUrl = `${domain.fullDomain || ctx.host || ''}${ctx.url || ''}`;
        const fallbackDetail = await this.readArticleCompanyNameFallback(cacheDir, requestUrl);
        if (!fallbackDetail) return this.renderArticleCbdListFallback(domain);
        return this.renderDetail(domain, fallbackDetail);
      }

      return this.renderDetail(domain, detail);
    } catch (e) {
      const requestUrl = `${domain.fullDomain || ctx.host || ''}${ctx.url || ''}`;
      const fallbackDetail = await this.readArticleCompanyNameFallback(cacheDir, requestUrl);
      if (!fallbackDetail) return this.renderArticleCbdListFallback(domain);
      return this.renderDetail(domain, fallbackDetail);
    }
  }
}

module.exports = ArticleComapmyController;
