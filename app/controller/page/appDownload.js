'use strict';

const fs = require('fs');
const path = require('path');
const Controller = require('egg').Controller;
const { resolveTemplate } = require('../../utils/templateExistsCache');
const { getArticleRating, getArticleRatingCount } = require('../../utils/articleRating');

const articleCompanyNameFilesCache = new Map();
const ARTICLE_COMPANY_NAME_FILES_CACHE_MS = 30000;

class AppDownloadPageController extends Controller {
  safeDirName(name = '') {
    return String(name || '')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\.\.+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 80);
  }

  getRequestName() {
    const { ctx } = this;
    const routeName = ctx.params[0] || '';
    const cleanPath = decodeURIComponent(String(routeName || ''))
      .replace(/^\/+/, '')
      .replace(/\?.*$/, '')
      .replace(/\/+$/, '');
    const fileName = cleanPath.split('/').filter(Boolean).pop() || '';

    return fileName
      .replace(/\.json$/i, '')
      .replace(/\.html?$/i, '');
  }

  getSafeJsonPath(cacheDir, fileName) {
    if (!fileName) return '';

    const filePath = path.resolve(cacheDir, `${fileName}.json`);
    const resolvedCacheDir = path.resolve(cacheDir);
    if (!filePath.startsWith(resolvedCacheDir + path.sep)) {
      return '';
    }

    return filePath;
  }

  getSafeArticleCompanyJsonPath(cacheDir, articleName) {
    if (!articleName) return '';

    const resolvedCacheDir = path.resolve(cacheDir);
    const articleNameText = String(articleName);
    const filePath = /^\d+$/.test(articleNameText)
      ? path.resolve(resolvedCacheDir, String(Math.floor(Number(articleNameText) / 1000) + 1), `${articleNameText}.json`)
      : path.resolve(resolvedCacheDir, 'name', `${articleNameText}.json`);
    if (!filePath.startsWith(resolvedCacheDir + path.sep)) {
      return '';
    }

    return filePath;
  }

  async readJsonFile(filePath) {
    return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
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

  async applyArticleDescriptionPool(detail = {}, domain = {}) {
    const { ctx } = this;
    const articleService = ctx.service.fanmuluArticle;
    if (!articleService || typeof articleService.getPool !== 'function') return detail;

    let descriptions = [];
    try {
      descriptions = await articleService.getPool('description');
    } catch (error) {
      ctx.logger.warn('[app-download] description library read failed: %s', error.message);
    }
    if (!Array.isArray(descriptions) || !descriptions.length) return detail;

    const seed = `${domain.fullDomain || ctx.host || ''}${ctx.path || ctx.url || ''}`;
    const urlNumber = ctx.service.utils.strToNumber(seed) || 1;
    const description = String(descriptions[urlNumber % descriptions.length] || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (description) detail.description = description;
    return detail;
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
    const cacheNum = await this.ctx.service.cache.get(cacheKey);
    const redisTotal = Number(cacheNum);
    if (redisTotal && !Number.isNaN(redisTotal)) {
      return redisTotal;
    }

    return 0;
  }

  async readArticleCompanyByUrlNumber(domain) {
    const detail = await this.readArticleCompanyByNumber(domain, domain && domain.urlNumber);
    if (detail && detail.title) return detail;
    return this.readArticleCompanyByNumber(domain, domain && domain.urlNumber, { forceFreshCompany: true });
  }

  async readArticleCompanyByNumber(domain, numberValue, options = {}) {
    if (!domain || !domain.isArticleCompany) {
      return {};
    }

    try {
      const articleCompany = await this.getDomainArticleCompany(domain, Boolean(options.forceFreshCompany));
      if (!articleCompany || (!articleCompany.fileName && !articleCompany.filename)) return {};

      const dirName = this.safeDirName(articleCompany.fileName || articleCompany.filename);
      const cacheDir = path.join(process.cwd(), 'cache', 'articlecompany', dirName);
      const total = await this.getArticleCompanyNum(cacheDir, domain, dirName, articleCompany);
      if (!total || Number.isNaN(total)) return {};

      const urlNumber = Math.abs(Number(numberValue) || 0);
      const articleName = String(urlNumber % total);
      const articlePath = this.getSafeArticleCompanyJsonPath(cacheDir, articleName);
      if (!articlePath) return {};

      const article = await this.readJsonFile(articlePath);
      article._id = article._id || articleName;
      article.id = article.id || articleName;
      article.keyWords = article.keyWords || article.keywords || '';
      return this.replaceTdkVars(article, domain);
    } catch (e) {
      return {};
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
    if (!domain || !domain.isArticleCompany) return {};

    try {
      const articleCompany = await this.getDomainArticleCompany(domain, Boolean(options.forceFreshCompany));
      if (!articleCompany || (!articleCompany.fileName && !articleCompany.filename)) return {};

      const dirName = this.safeDirName(articleCompany.fileName || articleCompany.filename);
      const cacheDir = path.join(process.cwd(), 'cache', 'articlecompany', dirName);
      const paths = await this.getArticleCompanyNameJsonPaths(cacheDir);
      if (!paths.length) return {};

      const urlNumber = Math.abs(Math.floor(Number(this.ctx.service.utils.strToNumber(url)) || 0));
      const startIndex = urlNumber % paths.length;
      for (let offset = 0; offset < paths.length; offset++) {
        const filePath = paths[(startIndex + offset) % paths.length];
        try {
          const article = await this.readJsonFile(filePath);
          const articleName = article.nowName || path.basename(filePath, '.json');
          article._id = article._id || articleName;
          article.id = article.id || articleName;
          article.keyWords = article.keyWords || article.keywords || '';
          return this.replaceTdkVars(article, domain);
        } catch (e) {
          // Skip an unreadable JSON and try the next stable name-cache item.
        }
      }
    } catch (e) {
      return {};
    }

    return {};
  }

  async readArticleCompanyNameByCurrentUrl(domain) {
    const { ctx } = this;
    const requestUrl = `${domain && domain.fullDomain || ctx.host || ''}${ctx.url || ''}`;
    let detail = await this.readArticleCompanyNameByUrl(domain, requestUrl);
    if (detail && detail.title) return detail;
    detail = await this.readArticleCompanyNameByUrl(domain, requestUrl, { forceFreshCompany: true });
    return detail && detail.title ? detail : {};
  }

  async renderArticleNotFound(domain) {
    if (domain && domain.isMuLu) {
      return await this.ctx.service.utils.allPage();
    }
    return this.ctx.render('404.html');
  }

  getRequestNumber(fallbackValue = 0) {
    const requestName = this.getRequestName();
    const numberMatch = String(requestName || '').match(/\d+/);
    if (numberMatch) return Number(numberMatch[0]);
    return Number(fallbackValue) || 0;
  }

  async renderDetail(result) {
    const { ctx } = this;
    const domain = result.domain || {};
    this.injectRating(result);
    const templatePath = path.join(process.cwd(), 'app', 'view', 'template', domain.tname || '', 'detail.html');

    const renderName = domain.tname
      ? resolveTemplate(`${domain.tname}:detail.html`, templatePath, `template/${domain.tname}/detail.html`, 'template/components/detail.html')
      : 'template/components/detail.html';

    return ctx.render(renderName, result).catch(() => {
      return ctx.render('error.html');
    });
  }

  async renderArticleCbdDetail(result) {
    const { ctx } = this;
    const domain = result.domain || {};
    this.injectRating(result);
    const templatePath = path.join(process.cwd(), 'app', 'view', 'template', domain.tname || '', 'article_cbd_detail.html');

    const renderName = domain.tname
      ? resolveTemplate(`${domain.tname}:article_cbd_detail.html`, templatePath, `template/${domain.tname}/article_cbd_detail.html`, 'template/components/article_cbd_detail.html')
      : 'template/components/article_cbd_detail.html';

    return ctx.render(renderName, result).catch(() => {
      return ctx.render('error.html');
    });
  }

  async renderAppDownload(result) {
    const { ctx } = this;
    const domain = result.domain || {};
    this.injectRating(result);
    const templatePath = path.join(process.cwd(), 'app', 'view', 'template', domain.tname || '', 'app_download.html');

    const renderName = domain.tname
      ? resolveTemplate(`${domain.tname}:app_download.html`, templatePath, `template/${domain.tname}/app_download.html`, 'template/components/app_download.html')
      : 'template/components/app_download.html';

    return ctx.render(renderName, result).catch(() => {
      return ctx.render('error.html');
    });
  }

  injectRating(result = {}) {
    const ratingArticle = result.detail || result.article || result.app || result.companyDetail || {};
    result.ratingValue = result.ratingValue || getArticleRating(ratingArticle, result.domain || {});
    result.ratingCount = result.ratingCount || getArticleRatingCount(ratingArticle);
    return result;
  }

  async getLocalFallbackDomain() {
    const { ctx } = this;
    const host = String(ctx.request.host || '').split(':')[0];
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (!isLocal) return null;

    try {
      const domain = await ctx.model.Domain
        .findOne({ isArticleCompany: true, articleCompany: { $exists: true, $ne: null } })
        .populate('articleCompany')
        .lean();
      if (domain) {
        domain.urlNumber = ctx.service.utils.strToNumber(`${host}${ctx.url}`) || 1;
      }
      return domain;
    } catch (e) {
      return null;
    }
  }

  async appDownloadDetail() {
    const { ctx } = this;
    let { site, domain } = await ctx.service.utils.getSiteInfo();

    if (!domain || !domain._id) {
      if (!domain || !domain._id) {
        return ctx.render('404.html');
      }
    }

    const appName = this.getRequestName();
    const appCacheDir = path.join(process.cwd(), 'cache', 'app_download');
    const appJsonPath = this.getSafeJsonPath(appCacheDir, appName);

    try {
      if (appJsonPath) {
        try {
          const detail = this.replaceTdkVars(await this.readJsonFile(appJsonPath), domain);
          await this.applyArticleDescriptionPool(detail, domain);
          const companyDetail = await this.readArticleCompanyByUrlNumber(domain);
          const contentParts = [ detail.content, companyDetail && companyDetail.content ].filter(Boolean);
          detail.content = contentParts.join('\n');
          const titleCP = companyDetail && companyDetail.title
            ? `${detail.title || detail.name || ''} ${companyDetail.title}`.trim()
            : detail.title || detail.name || domain.title || '';
          const result = {
            siteInfo: site || {},
            domain,
            detail,
            app: detail,
            appDownload: detail,
            companyDetail,
            titleCP,
            userConfig: ctx.app.config.MY_USER_CONFIG,
          };

          return this.renderAppDownload(result);
        } catch (e) {
          // App JSON missing or broken: fall back to article company content below.
        }
      }

      let detail = await this.readArticleCompanyNameByCurrentUrl(domain);
      if (!detail || !detail.title) {
        const requestNumber = this.getRequestNumber(domain.urlNumber);
        detail = await this.readArticleCompanyByNumber(domain, requestNumber);
      }
      if (!detail || !detail.title) return this.renderArticleNotFound(domain);

      detail.description = detail.description || domain.description || '';
      detail.keywords = detail.keywords || detail.keyWords || domain.keyWords || '';
      detail.keyWords = detail.keyWords || detail.keywords || '';
      this.replaceTdkVars(detail, domain);
      detail.content = detail.content || '';
      detail.view = Number(detail.view || domain.urlNumber || 1);
      detail.time = detail.time || new Date().toISOString().slice(0, 10);
      detail.createdText = detail.createdText || detail.time;
      const result = {
        siteInfo: site || {},
        domain,
        detail,
        companyDetail: detail,
        article: detail,
        tdk: detail,
        titleCP: detail.title,
        imageNums: Math.abs(Number(domain.urlNumber) || 10) % 2000,
        articleList: [],
        newArticleList: [],
        articleNext: {},
        articlePrve: {},
        userConfig: ctx.app.config.MY_USER_CONFIG,
      };

      return this.renderArticleCbdDetail(result);
    } catch (e) {
      ctx.status = 500;
      return ctx.render('error.html');
    }
  }
}

module.exports = AppDownloadPageController;
