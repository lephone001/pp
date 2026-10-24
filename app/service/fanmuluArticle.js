'use strict';

const Service = require('egg').Service;
const crypto = require('crypto');
const path = require('path');
const fse = require('fs-extra');
const iconv = require('iconv-lite');
const xss = require('xss');
const cheerio = require('cheerio');
const buildDownloadPortal = require('../utils/downloadPortal');
const buildBackupDomains = require('../utils/backupDomains');
const { normalizeVideoUrl } = require('../utils/moviePlayback');

/* 中文标签必须作为字符串键；循环内回调使用固定种子和调用序号。 */
/* eslint-disable quote-props, no-loop-func, no-control-regex */

const CACHE_SCHEMA_VERSION = 2;
const MEMORY_PAGE_LIMIT = 2000;
const MAX_PATH_LENGTH = 2048;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_CACHE_FILES_PER_SHARD = 500;
const MAX_CACHE_WRITES_PER_MINUTE = 60;
const PAGE_STATE_QUEUE_LIMIT = 1000;
const PAGE_STATE_BATCH_SIZE = 10;
const PAGE_STATE_FLUSH_INTERVAL_MS = 10000;
const PAGE_STATE_IO_CONCURRENCY = 2;
const PAGE_STATE_MAX_RETRIES = 2;
const SHARD_USAGE_CACHE_MS = 60000;
const SPIDER_UA = /(Baiduspider|Googlebot|bingbot|360Spider|HaosouSpider|Sogou|YisouSpider|SMSpider|Bytespider|ToutiaoSpider|YandexBot|PetalBot|AhrefsBot|bot|crawler|spider|slurp)/i;
const DEFAULT_ROUTE_DIRECTORY = 'Article';
const MOVIE_ROUTE_PREFIX = '/Article/Movie';
const MOVIE_TITLE_FILE_LIMIT = 32;
const MOVIE_PLAY_FILE_LIMIT = 8;
const MOVIE_TEMPLATE = { id: 'new_moviex', name: 'MovieX 影视详情', file: 'movie/new_moviex.html' };
const HOME_TEMPLATES = [
  { name: '首页·软件下载站', file: 'home/home_portal.html' },
  { name: '首页·影视内容站', file: 'home/home_magazine.html' },
  { name: '首页·资讯文章站', file: 'home/home_directory.html' },
];

/* 正文允许常用排版标签；脚本、内嵌页面、事件属性和危险协议由 xss 过滤。 */
const ARTICLE_HTML_FILTER = new xss.FilterXSS({
  whiteList: {
    p: [], h2: [], h3: [], h4: [], h5: [], h6: [],
    strong: [], b: [], em: [], i: [], u: [], s: [],
    ul: [], ol: [], li: [], blockquote: [], br: [], hr: [],
    pre: [], code: [], article: [], section: [],
    table: [], thead: [], tbody: [], tr: [], th: [], td: [],
    figure: [], figcaption: [],
    a: [ 'href', 'title', 'target', 'rel' ],
    img: [ 'src', 'alt', 'title', 'width', 'height', 'loading' ],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: [ 'script', 'style', 'iframe', 'object', 'embed', 'form', 'head', 'svg', 'math' ],
});

const DEFAULT_SETTINGS = {
  enabled: true,
  friendLinksEnabled: true,
  spiderStrongEnabled: false,
  enabledTemplates: [],
};

const CATEGORY_LABELS = {
  banben: '版本词库',
  biaoqing: '表情词库',
  biaoti: '标题格式',
  description: '描述词库',
  diqu: '地区词库',
  fanti: '繁体词库',
  fan: '备用泛域名',
  gpt: '本地文章库',
  guanjianci: '关键词格式',
  imglink: '图片链接库',
  juzi: '句子词库',
  keyword: '主关键词',
  keyword_home: '泛目录首页标题词库',
  keyword1: '扩展关键词1',
  keyword2: '扩展关键词2',
  keyword3: '扩展关键词3',
  keyword4: '扩展关键词4',
  links: '静态词库友链',
  miaoshu: '描述格式',
  mulu: '目录词库',
  name: '人名词库',
  shuangpin: '双拼词库',
  sitename: '站点名称',
  title: '普通标题',
  url: '链接格式',
  zh: '蜘蛛强引词库',
  zidingyi: '自定义词库',
  zidingyi1: '自定义词库1',
  zidingyi2: '自定义词库2',
  zidingyi3: '自定义词库3',
};

function cleanText(value, maxLength) {
  return String(value === undefined || value === null ? '' : value)
    .replace(new RegExp('[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]', 'g'), '')
    .trim()
    .slice(0, maxLength || 1000000);
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isArticleLink(value) {
  const link = String(value || '').trim();
  return /^(?:https?:\/\/[^\s"'<>]+|\/\/[^\s"'<>]+|\/(?!\/)[^\s"'<>]*)$/i.test(link);
}

function movieArticleLink(link, currentUrl) {
  try {
    const base = new URL(currentUrl);
    const target = new URL(link, base);
    if (!/^https?:$/.test(target.protocol) || target.host !== base.host
      || !/^\/Article(?:\/|$)/.test(target.pathname)
      || /^\/Article\/Movie(?:\/|$)/.test(target.pathname)) return link;
    return MOVIE_ROUTE_PREFIX + target.pathname.slice('/Article'.length) + target.search + target.hash;
  } catch (error) {
    return link;
  }
}

function movieContentLinks(html, currentUrl) {
  const $ = cheerio.load(html, { decodeEntities: false });
  $('a[href]').each((index, element) => {
    const anchor = $(element);
    const link = anchor.attr('href');
    const movieLink = movieArticleLink(link, currentUrl);
    if (movieLink !== link) anchor.attr('href', movieLink);
  });
  return $.html();
}

function decodeBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) return String(buffer || '');
  let value = buffer.toString('utf8');
  if (value.indexOf('\ufffd') !== -1 && !Buffer.from(value, 'utf8').equals(buffer)) value = iconv.decode(buffer, 'gb18030');
  return value.replace(/^\ufeff/, '');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function stableIndex(seed, salt, count) {
  if (!count) return -1;
  const digest = sha256(String(seed) + '|' + String(salt));
  return parseInt(digest.slice(0, 12), 16) % count;
}

function stablePick(list, seed, salt, fallback) {
  if (!Array.isArray(list) || !list.length) return fallback || '';
  return list[stableIndex(seed, salt, list.length)];
}

function replaceHomeTitleTokens(value, urlSeed) {
  let occurrence = 0;
  return String(value || '').replace(/[A-Za-z]+|\d+/g, token => {
    const salt = 'home-title-token-' + occurrence++ + '-' + token.toLowerCase();
    const digest = sha256(String(urlSeed) + '|' + salt);
    const length = 1 + (parseInt(digest.slice(0, 2), 16) % 7);
    if (/^\d+$/.test(token)) {
      let digits = '';
      for (let i = 0; i < length; i++) digits += digest.charAt((2 + i) % digest.length);
      digits = digits.replace(/[a-f]/gi, char => String(parseInt(char, 16) % 10));
      if (length > 1 && digits.charAt(0) === '0') digits = '1' + digits.slice(1);
      return digits;
    }
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    let letters = '';
    for (let i = 0; i < length; i++) letters += alphabet.charAt(parseInt(digest.slice(2 + i * 2, 4 + i * 2), 16) % alphabet.length);
    return letters;
  });
}

function formatShanghai(date, withTime) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const iso = shifted.toISOString();
  return withTime ? iso.slice(0, 19).replace('T', ' ') : iso.slice(0, 10);
}

function safeCategory(value) {
  const category = cleanText(value, 40);
  return /^[a-zA-Z0-9_-]+$/.test(category) ? category : '';
}

function safeRouteDirectory(value) {
  const directory = cleanText(value, 40);
  return /^[A-Za-z0-9_-]{1,40}$/.test(directory) ? directory : DEFAULT_ROUTE_DIRECTORY;
}

function safeFileName(value) {
  const fileName = cleanText(value, 180);
  if (!fileName || path.basename(fileName) !== fileName || !/\.txt$/i.test(fileName)) return '';
  if (/[\\/:*?"<>|]/.test(fileName)) return '';
  return fileName;
}

function isInside(root, candidate) {
  const resolvedRoot = path.resolve(root) + path.sep;
  const resolvedCandidate = path.resolve(candidate);
  return resolvedCandidate.indexOf(resolvedRoot) === 0;
}

function uniqueLines(value) {
  const seen = Object.create(null);
  return String(value || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => {
      if (!line || seen[line]) return false;
      seen[line] = true;
      return true;
    });
}

class FanmuluArticleService extends Service {
  get roots() {
    const articleRoot = path.join(this.app.baseDir, 'app', 'common_data', 'Article');
    return {
      article: articleRoot,
      data: path.join(articleRoot, 'data'),
      templates: path.join(articleRoot, 'templates'),
      settings: path.join(articleRoot, 'settings.json'),
      manifest: path.join(articleRoot, 'templates', 'manifest.json'),
      cache: path.join(this.app.baseDir, 'cache', 'fanmulu_article'),
    };
  }

  async ensureDirectories() {
    if (this.app.fanmuluArticleDirectoriesReady) return;
    if (this.app.fanmuluArticleDirectoryPromise) {
      await this.app.fanmuluArticleDirectoryPromise;
      return;
    }
    const roots = this.roots;
    this.app.fanmuluArticleDirectoryPromise = (async () => {
      await Promise.all([
        fse.ensureDir(roots.data),
        fse.ensureDir(roots.templates),
        fse.ensureDir(roots.cache),
        fse.ensureDir(path.join(roots.data, 'links')),
        fse.ensureDir(path.join(roots.data, 'zh')),
      ]);

      if (!await fse.pathExists(roots.settings)) {
        await this.atomicJson(roots.settings, DEFAULT_SETTINGS);
      }
      const zhFile = path.join(roots.data, 'zh', 'zh.txt');
      if (!await fse.pathExists(zhFile)) await fse.outputFile(zhFile, '', 'utf8');
      this.app.fanmuluArticleDirectoriesReady = true;
    })();
    try {
      await this.app.fanmuluArticleDirectoryPromise;
    } finally {
      this.app.fanmuluArticleDirectoryPromise = null;
    }
  }

  async atomicJson(filePath, value) {
    await fse.ensureDir(path.dirname(filePath));
    const nonce = crypto.randomBytes(6).toString('hex');
    const temporary = filePath + '.' + process.pid + '.' + Date.now() + '.' + nonce + '.tmp';
    await fse.writeFile(temporary, JSON.stringify(value, null, 2), 'utf8');
    await fse.move(temporary, filePath, { overwrite: true });
  }

  clearPageStateMemory() {
    this.app.fanmuluArticleCacheGeneration = (Number(this.app.fanmuluArticleCacheGeneration) || 0) + 1;
    this.app.fanmuluArticlePageCache = new Map();
    if (this.app.fanmuluArticlePageStateQueue) this.app.fanmuluArticlePageStateQueue.clear();
    if (this.app.fanmuluArticlePageStateQueueTimer) {
      clearTimeout(this.app.fanmuluArticlePageStateQueueTimer);
      this.app.fanmuluArticlePageStateQueueTimer = null;
    }
    this.app.fanmuluArticleShardUsage = Object.create(null);
    this.app.fanmuluArticleWriteBudget = null;
  }

  invalidateMemory() {
    this.clearPageStateMemory();
    this.app.fanmuluArticleRuntimeReady = false;
    this.app.fanmuluArticlePools = Object.create(null);
    this.app.fanmuluArticleMoviePools = new Map();
    this.app.fanmuluArticleMoviePlayPools = new Map();
    this.app.fanmuluArticleSettings = null;
    this.app.fanmuluArticleManifest = null;
    this.app.fanmuluArticleCategoryFiles = Object.create(null);
    this.app.fanmuluArticleTextCache = new Map();
  }

  async preloadRuntimeData(force) {
    if (this.app.fanmuluArticlePreloadPromise) {
      await this.app.fanmuluArticlePreloadPromise;
      return;
    }

    this.app.fanmuluArticlePreloadPromise = (async () => {
      await this.ensureDirectories();
      const categories = Object.keys(CATEGORY_LABELS).filter(name => name !== 'gpt');
      const loaded = await Promise.all([
        this.getSettings(force),
        this.getTemplateManifest(force),
        this.categoryFiles('gpt', force),
      ].concat(categories.map(name => this.getPool(name, force))));
      const articleFiles = loaded[2];
      for (let index = 0; index < articleFiles.length; index += 16) {
        const group = articleFiles.slice(index, index + 16);
        await Promise.all(group.map(async fileName => {
          try {
            await this.readTextFile(path.join(this.roots.data, 'gpt', fileName), force);
          } catch (error) {
            this.app.logger.warn('[fanmulu-article] preload skipped %s: %s', fileName, error.message);
          }
        }));
      }
      this.app.fanmuluArticleRuntimeReady = true;
    })();

    try {
      await this.app.fanmuluArticlePreloadPromise;
    } finally {
      this.app.fanmuluArticlePreloadPromise = null;
    }
  }

  async refreshRuntimeData(reason) {
    this.invalidateMemory();
    await this.preloadRuntimeData(true);
    if (this.app.messenger && typeof this.app.messenger.sendToApp === 'function') {
      this.app.messenger.sendToApp('fanmulu-article-data-updated', {
        sourcePid: process.pid,
        reason: cleanText(reason, 80),
      });
    }
  }

  async getSettings(force) {
    await this.ensureDirectories();
    const current = this.app.fanmuluArticleSettings;
    if (!force && current) return current.value;
    let stored = {};
    try {
      stored = await fse.readJson(this.roots.settings);
    } catch (error) {
      this.ctx.logger.warn('[fanmulu-article] settings read failed: %s', error.message);
    }
    const value = Object.assign({}, DEFAULT_SETTINGS, stored || {});
    value.enabledTemplates = Array.isArray(value.enabledTemplates)
      ? value.enabledTemplates.map(item => cleanText(item, 120)).filter(Boolean)
      : [];
    this.app.fanmuluArticleSettings = { value };
    return value;
  }

  async getTemplateManifest(force) {
    await this.ensureDirectories();
    const current = this.app.fanmuluArticleManifest;
    if (!force && current) return current.value;
    let value = [];
    try {
      const parsed = await fse.readJson(this.roots.manifest);
      value = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      this.ctx.logger.warn('[fanmulu-article] template manifest read failed: %s', error.message);
    }
    value = value
      .filter(item => item && /^[a-zA-Z0-9_/-]+\.html$/.test(String(item.file || '')))
      .map(item => ({
        id: cleanText(item.id, 80),
        name: cleanText(item.name, 120),
        file: cleanText(item.file, 160),
        source: cleanText(item.source, 300),
        defaultOnly: item.defaultOnly === true,
      }));
    this.app.fanmuluArticleManifest = { value };
    return value;
  }

  async categoryFiles(category, force) {
    const safe = safeCategory(category);
    if (!safe) return [];
    if (!this.app.fanmuluArticleCategoryFiles) this.app.fanmuluArticleCategoryFiles = Object.create(null);
    const cached = this.app.fanmuluArticleCategoryFiles[safe];
    if (!force && cached) return cached.value;
    const directory = path.join(this.roots.data, safe);
    if (!isInside(this.roots.data, directory) || !await fse.pathExists(directory)) return [];
    const entries = await fse.readdir(directory);
    const value = entries.filter(name => safeFileName(name)).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    this.app.fanmuluArticleCategoryFiles[safe] = { value };
    return value;
  }

  async readTextFile(filePath, force) {
    if (!this.app.fanmuluArticleTextCache) this.app.fanmuluArticleTextCache = new Map();
    const memory = this.app.fanmuluArticleTextCache.get(filePath);
    if (!force && memory) return memory.value;
    const info = await fse.stat(filePath);
    if (!info.isFile() || info.size > MAX_FILE_BYTES) throw new Error('词库文件不存在或超过 5MB 限制');
    const value = decodeBuffer(await fse.readFile(filePath));
    const cache = this.app.fanmuluArticleTextCache;
    if (cache.has(filePath)) cache.delete(filePath);
    cache.set(filePath, { value });
    if (cache.size > 512) cache.delete(cache.keys().next().value);
    return value;
  }

  async getPool(category, force) {
    const safe = safeCategory(category);
    if (!safe) return [];
    if (!this.app.fanmuluArticlePools) this.app.fanmuluArticlePools = Object.create(null);
    const cached = this.app.fanmuluArticlePools[safe];
    if (!force && cached) return cached.value;
    const files = await this.categoryFiles(safe);
    const chunks = [];
    for (let i = 0; i < files.length; i++) {
      try {
        chunks.push(await this.readTextFile(path.join(this.roots.data, safe, files[i])));
      } catch (error) {
        this.ctx.logger.warn('[fanmulu-article] skip library file %s/%s: %s', safe, files[i], error.message);
      }
    }
    const value = uniqueLines(chunks.join('\n'));
    this.app.fanmuluArticlePools[safe] = { value };
    return value;
  }

  async getMovieTitlePool(identity) {
    const files = await this.categoryFiles('moviex');
    if (!files.length) return [];
    if (!this.app.fanmuluArticleMoviePools) this.app.fanmuluArticleMoviePools = new Map();
    const cache = this.app.fanmuluArticleMoviePools;
    const start = stableIndex(identity.hash, 'moviex-file', files.length);
    for (let offset = 0; offset < files.length; offset++) {
      const fileName = files[(start + offset) % files.length];
      let words = cache.get(fileName);
      if (!words) {
        try {
          words = uniqueLines(await this.readTextFile(path.join(this.roots.data, 'moviex', fileName)));
        } catch (error) {
          this.ctx.logger.warn('[fanmulu-article] skip movie library file %s: %s', fileName, error.message);
          continue;
        }
      }
      cache.delete(fileName);
      cache.set(fileName, words);
      if (cache.size > MOVIE_TITLE_FILE_LIMIT) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
        if (this.app.fanmuluArticleTextCache) this.app.fanmuluArticleTextCache.delete(path.join(this.roots.data, 'moviex', oldest));
      }
      if (words.length) return words;
    }
    return [];
  }

  async getMoviePlayUrl(identity) {
    const files = await this.categoryFiles('movieplay');
    if (!files.length) return '';
    if (!this.app.fanmuluArticleMoviePlayPools) this.app.fanmuluArticleMoviePlayPools = new Map();
    const cache = this.app.fanmuluArticleMoviePlayPools;
    const start = stableIndex(identity.hash, 'movieplay-file', files.length);
    for (let offset = 0; offset < files.length; offset++) {
      const fileName = files[(start + offset) % files.length];
      let urls = cache.get(fileName);
      if (!urls) {
        try {
          urls = uniqueLines(await this.readTextFile(path.join(this.roots.data, 'movieplay', fileName)))
            .map(normalizeVideoUrl).filter(Boolean);
        } catch (error) {
          this.ctx.logger.warn('[fanmulu-article] skip movie playback file %s: %s', fileName, error.message);
          continue;
        }
      }
      cache.delete(fileName);
      cache.set(fileName, urls);
      if (cache.size > MOVIE_PLAY_FILE_LIMIT) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
        if (this.app.fanmuluArticleTextCache) this.app.fanmuluArticleTextCache.delete(path.join(this.roots.data, 'movieplay', oldest));
      }
      if (urls.length) return stablePick(urls, identity.hash, 'movieplay-url', '');
    }
    return '';
  }

  normalizeRequestPath(value, routeDirectory, globalRoute) {
    const directory = safeRouteDirectory(routeDirectory);
    const prefix = '/' + directory;
    let requestPath = cleanText(value || '/', MAX_PATH_LENGTH);
    const fragmentAt = requestPath.indexOf('#');
    if (fragmentAt !== -1) requestPath = requestPath.slice(0, fragmentAt);
    const queryAt = requestPath.indexOf('?');
    const query = queryAt === -1 ? '' : requestPath.slice(queryAt + 1);
    if (queryAt !== -1) requestPath = requestPath.slice(0, queryAt);
    try {
      requestPath = decodeURI(requestPath);
    } catch (error) {
      // 保留原始安全路径；错误编码不应导致前台返回 500。
    }
    requestPath = requestPath.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
    if (requestPath.charAt(0) !== '/') requestPath = '/' + requestPath;
    const normalized = path.posix.normalize(requestPath);
    if (!globalRoute && normalized.indexOf(prefix + '/') !== 0 && normalized !== prefix) return prefix + '/index.html';
    const target = normalized + (query ? '?' + query : '');
    return target.slice(0, MAX_PATH_LENGTH);
  }

  pageIdentity(requestPath, routeDirectory, globalRoute) {
    const normalized = this.normalizeRequestPath(requestPath, routeDirectory, globalRoute);
    const hash = sha256(normalized);
    return {
      path: normalized,
      hash,
      urlNumber: parseInt(hash.slice(0, 8), 16),
    };
  }

  cacheFile(hash) {
    return path.join(this.roots.cache, hash.slice(0, 2), hash + '.json');
  }

  async canPersistPage(filePath, fileExists) {
    const minute = Math.floor(Date.now() / 60000);
    if (!this.app.fanmuluArticleWriteBudget || this.app.fanmuluArticleWriteBudget.minute !== minute) {
      this.app.fanmuluArticleWriteBudget = { minute, count: 0 };
    }
    const budget = this.app.fanmuluArticleWriteBudget;
    if (budget.count >= MAX_CACHE_WRITES_PER_MINUTE) return false;

    let usage = null;
    if (!fileExists) {
      if (!this.app.fanmuluArticleShardUsage) this.app.fanmuluArticleShardUsage = Object.create(null);
      const shard = path.dirname(filePath);
      usage = this.app.fanmuluArticleShardUsage[shard];
      if (!usage || usage.expiresAt <= Date.now()) {
        let count = 0;
        try {
          const entries = await fse.readdir(shard);
          count = entries.filter(name => /^[a-f0-9]{64}\.json$/i.test(name)).length;
        } catch (error) {
          count = 0;
        }
        usage = { count, expiresAt: Date.now() + SHARD_USAGE_CACHE_MS };
        this.app.fanmuluArticleShardUsage[shard] = usage;
      }
      if (usage.count >= MAX_CACHE_FILES_PER_SHARD) return false;
    }

    budget.count++;
    if (usage) usage.count++;
    return true;
  }

  rememberPage(hash, state) {
    if (!this.app.fanmuluArticlePageCache) this.app.fanmuluArticlePageCache = new Map();
    const cache = this.app.fanmuluArticlePageCache;
    if (cache.has(hash)) cache.delete(hash);
    cache.set(hash, state);
    if (cache.size > MEMORY_PAGE_LIMIT) cache.delete(cache.keys().next().value);
  }

  pageStateMatches(value, state) {
    return value && value.schemaVersion === CACHE_SCHEMA_VERSION &&
      value.path === state.path && value.hash === state.hash &&
      value.urlNumber === state.urlNumber && value.templateId === state.templateId &&
      value.templateFile === state.templateFile && value.articleFile === state.articleFile;
  }

  enqueuePageState(filePath, state) {
    if (!this.app.fanmuluArticlePageStateQueue) this.app.fanmuluArticlePageStateQueue = new Map();
    const queue = this.app.fanmuluArticlePageStateQueue;
    if (!queue.has(state.hash) && queue.size >= PAGE_STATE_QUEUE_LIMIT) {
      this.app.fanmuluArticlePageStateQueueDropped = (Number(this.app.fanmuluArticlePageStateQueueDropped) || 0) + 1;
      return false;
    }

    queue.set(state.hash, {
      filePath,
      state,
      generation: Number(this.app.fanmuluArticleCacheGeneration) || 0,
      attempts: 0,
    });
    this.schedulePageStateQueue();
    return true;
  }

  schedulePageStateQueue() {
    if (this.app.fanmuluArticlePageStateQueueTimer || this.app.fanmuluArticlePageStateQueueProcessing) return;
    const timer = setTimeout(() => {
      this.app.fanmuluArticlePageStateQueueTimer = null;
      this.drainPageStateQueue().catch(error => {
        this.app.logger.warn('[fanmulu-article] page state queue failed: %s', error.message);
      });
    }, PAGE_STATE_FLUSH_INTERVAL_MS);
    if (typeof timer.unref === 'function') timer.unref();
    this.app.fanmuluArticlePageStateQueueTimer = timer;
  }

  requeuePageState(item) {
    const queue = this.app.fanmuluArticlePageStateQueue;
    if (!queue || (queue.size >= PAGE_STATE_QUEUE_LIMIT && !queue.has(item.state.hash))) {
      this.app.fanmuluArticlePageStateQueueDropped = (Number(this.app.fanmuluArticlePageStateQueueDropped) || 0) + 1;
      return;
    }
    queue.set(item.state.hash, item);
  }

  async processPageStateQueueItem(item) {
    if ((Number(this.app.fanmuluArticleCacheGeneration) || 0) !== item.generation) return;

    let stored = null;
    let fileExists = false;
    try {
      stored = await fse.readJson(item.filePath);
      fileExists = true;
    } catch (error) {
      fileExists = !error || error.code !== 'ENOENT';
    }
    if (this.pageStateMatches(stored, item.state)) return;
    if ((Number(this.app.fanmuluArticleCacheGeneration) || 0) !== item.generation) return;
    if (!await this.canPersistPage(item.filePath, fileExists)) return;
    if ((Number(this.app.fanmuluArticleCacheGeneration) || 0) !== item.generation) return;
    await this.atomicJson(item.filePath, item.state);
  }

  async drainPageStateQueue() {
    if (this.app.fanmuluArticlePageStateQueueProcessing) return;
    const queue = this.app.fanmuluArticlePageStateQueue;
    if (!queue || !queue.size) return;

    const batch = [];
    for (const [ hash, item ] of queue) {
      queue.delete(hash);
      batch.push(item);
      if (batch.length >= PAGE_STATE_BATCH_SIZE) break;
    }

    this.app.fanmuluArticlePageStateQueueProcessing = true;
    try {
      for (let index = 0; index < batch.length; index += PAGE_STATE_IO_CONCURRENCY) {
        const group = batch.slice(index, index + PAGE_STATE_IO_CONCURRENCY);
        await Promise.all(group.map(async item => {
          try {
            await this.processPageStateQueueItem(item);
          } catch (error) {
            item.attempts++;
            if (item.attempts <= PAGE_STATE_MAX_RETRIES) {
              this.requeuePageState(item);
            } else {
              this.app.logger.warn('[fanmulu-article] cache item dropped after retries: %s', error.message);
            }
          }
        }));
      }
    } finally {
      this.app.fanmuluArticlePageStateQueueProcessing = false;
      if (queue.size) this.schedulePageStateQueue();
    }
  }

  async createPageState(identity, templates) {
    const articleFiles = await this.categoryFiles('gpt');
    const template = stablePick(templates, identity.hash, 'template', null);
    return {
      schemaVersion: CACHE_SCHEMA_VERSION,
      path: identity.path,
      hash: identity.hash,
      urlNumber: identity.urlNumber,
      templateId: template ? template.id : '',
      templateFile: template ? template.file : '',
      articleFile: stablePick(articleFiles, identity.hash, 'article-file', ''),
      createdAt: new Date().toISOString(),
    };
  }

  async getPageState(identity, templates) {
    if (!this.app.fanmuluArticlePageCache) this.app.fanmuluArticlePageCache = new Map();
    const memory = this.app.fanmuluArticlePageCache.get(identity.hash);
    if (memory && memory.path === identity.path && memory.schemaVersion === CACHE_SCHEMA_VERSION
      && templates.some(item => item.id === memory.templateId && item.file === memory.templateFile)) return memory;

    // URL 到模板、文章的映射完全由 SHA256 确定，前台请求不等待 JSON 磁盘读取。
    const filePath = this.cacheFile(identity.hash);
    const state = await this.createPageState(identity, templates);
    this.rememberPage(identity.hash, state);
    this.enqueuePageState(filePath, state);
    return state;
  }

  async getArticleSource(fileName, identity) {
    const safe = safeFileName(fileName);
    if (safe) {
      try {
        const raw = await this.readTextFile(path.join(this.roots.data, 'gpt', safe));
        const fallbackTitle = path.basename(safe, '.txt').replace(/-[a-f0-9]{8}$/i, '');
        const rows = String(raw).split(/\r?\n/);
        const first = cleanText(rows[0], 300);
        if (first && stripHtml(first) === stripHtml(fallbackTitle)) rows.shift();
        return { title: first || fallbackTitle, content: rows.join('\n').trim() };
      } catch (error) {
        this.ctx.logger.warn('[fanmulu-article] article file read failed: %s', error.message);
      }
    }
    const titles = await this.getPool('title');
    return {
      title: stablePick(titles, identity.hash, 'fallback-title', '本地资讯详情'),
      content: '',
    };
  }

  deterministicCharacters(identity, salt, min, max, alphabet) {
    const seed = identity && typeof identity === 'object' ? identity.hash : identity;
    const length = min + stableIndex(seed, salt + '-length', Math.max(1, max - min + 1));
    let result = '';
    for (let i = 0; i < length; i++) {
      result += alphabet.charAt(stableIndex(seed, salt + '-' + i, alphabet.length));
    }
    return result;
  }

  formatArticleContent(input, fallback) {
    let content = String(input || fallback || '').slice(0, 200000);

    // 兼容词库中“< h2 >”“</ h2 >”这类多余空格，同时避免正文出现第二个 h1。
    content = content.replace(
      /<\s*(\/?)\s*(h[1-6]|p|strong|b|em|i|u|s|ul|ol|li|blockquote|br|hr|pre|code|article|section|table|thead|tbody|tr|th|td|figure|figcaption)\s*>/gi,
      (all, closing, tagName) => '<' + closing + (String(tagName).toLowerCase() === 'h1' ? 'h2' : String(tagName).toLowerCase()) + '>'
    );

    const filtered = ARTICLE_HTML_FILTER.process(content).trim();
    if (!filtered) return '<p>' + escapeHtml(fallback || '') + '</p>';

    // 完全没有 HTML 的旧词库仍按行自动生成段落。
    if (!/<\/?(?:p|h[2-6]|ul|ol|li|blockquote|pre|table|article|section|figure|br|hr)\b/i.test(filtered)) {
      return filtered
        .split(/\r?\n+/)
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, 120)
        .map(item => '<p>' + item + '</p>')
        .join('');
    }

    return filtered;
  }

  renderFriendLinks(pools, values, identity, seed, enabled) {
    const links = [];
    if (!enabled) return links;
    for (let i = 0; i < 10; i++) {
      const raw = stablePick(pools.links || [], identity.hash, 'friend-link-' + i, '');
      const rendered = this.renderLibraryText(raw, values, pools, identity, 'friend-link-' + i, seed).trim();
      if (isArticleLink(rendered)) links.push({ title: '', url: escapeHtml(rendered), source: 'links' });
    }
    return links;
  }

  // Also used by synchronous business-template helpers: consume preloaded pools only.
  downloadPortal(input = {}, context = {}) {
    const pools = context.pools || {};
    if (!context.pools) {
      const cached = this.app.fanmuluArticlePools || {};
      Object.keys(cached).forEach(name => { pools[name] = cached[name].value; });
    }
    const host = input.host || this.ctx.host || '';
    const pathname = this.ctx.path || '/';
    const identity = context.identity || { hash: sha256(input.seed || host + pathname), path: pathname };
    const date = input.date || formatShanghai(new Date(), false);
    const origin = (this.ctx.protocol === 'https' ? 'https' : 'http') + '://' + host;
    const title = input.articleTitle || (input.detail && (input.detail.name || input.detail.title)) || input.title || '应用指南';
    const values = Object.assign({
      articleTitle: title, articleContent: input.contentHtml || '',
      host, rootDomain: this.rootDomain(host), origin, currentUrl: origin + pathname,
      now: formatShanghai(new Date(), true), date, timestamp: Math.floor(Date.now() / 1000),
    }, context.values);
    const categories = {
      keyword: 'keyword', keyword1: 'keyword1', keyword2: 'keyword2', keyword3: 'keyword3', keyword4: 'keyword4',
      shortTitle: 'title', shortDescription: 'description', descriptionFormat: 'miaoshu',
      titleFormat: 'biaoti', keywordFormat: 'guanjianci', linkFormat: 'url',
      emoji: 'biaoqing', personName: 'name', siteName: 'sitename', image: 'imglink',
      shuangpin: 'shuangpin', directory: 'mulu', sentence: 'juzi', region: 'diqu', version: 'banben',
      custom: 'zidingyi', custom1: 'zidingyi1', custom2: 'zidingyi2', custom3: 'zidingyi3',
    };
    const fallbacks = { keyword: title, shortDescription: input.description || title, descriptionFormat: '{描述}', siteName: input.siteName || host };
    Object.keys(categories).forEach(key => {
      if (values[key] === undefined) values[key] = stablePick(pools[categories[key]] || [], identity.hash, 'portal-' + key, fallbacks[key] || '');
    });
    const backupSeed = crypto.randomBytes(16).toString('hex');
    return buildDownloadPortal(Object.assign({}, input, {
      words: input.words || pools.keyword,
      siteNames: pools.sitename || [],
      headerWords: pools.mulu || [],
      backupDomains: buildBackupDomains({ patterns: pools.fan || [], origin: values.origin,
        render: (pattern, salt) => this.renderLibraryText(pattern, values, pools, identity, salt, backupSeed),
      }),
      friendLinks: Array.isArray(input.friendLinks) ? input.friendLinks : this.renderFriendLinks(
        pools, values, identity, crypto.randomBytes(16).toString('hex'),
        !(this.app.fanmuluArticleSettings && this.app.fanmuluArticleSettings.value.friendLinksEnabled === false)
      ),
      renderLibrary: (pattern, salt) => this.renderLibraryText(pattern, values, pools, identity, salt),
    }));
  }

  renderLibraryText(input, values, pools, identity, saltPrefix, seed) {
    let output = String(input || '');
    let occurrence = 0;
    const renderSeed = seed || identity.hash;
    const fixed = {
      '标题格式': values.titleFormat,
      '描述格式': values.descriptionFormat,
      '关键词格式': values.keywordFormat,
      '链接': values.linkFormat,
      '关键词': values.keyword,
      '关键词1': values.keyword1,
      '关键词2': values.keyword2,
      '关键词3': values.keyword3,
      '关键词4': values.keyword4,
      '标题': values.shortTitle,
      '描述': values.shortDescription,
      '表情': values.emoji,
      '人名': values.personName,
      '网站名称': values.siteName,
      '图片': values.image,
      '双拼': values.shuangpin,
      '目录': values.directory,
      '句子': values.sentence,
      '地区': values.region,
      '版本': values.version,
      '自定义': values.custom,
      '自定义1': values.custom1,
      '自定义2': values.custom2,
      '自定义3': values.custom3,
      '文章标题': values.articleTitle,
      '文章内容': values.articleContent,
      '当前url': values.currentUrl,
      '当前网址': values.origin + '/',
      '网站地址': values.origin + '/',
      '当前链接': identity.path,
      '当前域名': values.host,
      '域名': values.host,
      '主域名': values.rootDomain,
      '根域名': values.rootDomain,
      '当前时间': values.now,
      '时间': values.now,
      '发布时间': values.now,
      '年月日': values.date,
      '日期': values.date.replace(/-/g, ''),
      '时间戳': String(values.timestamp),
    };
    const randomPoolTags = {
      '随机关键词': 'keyword', '随机关键词1': 'keyword1', '随机关键词2': 'keyword2',
      '随机关键词3': 'keyword3', '随机关键词4': 'keyword4', '随机标题': 'title',
      '随机描述': 'description', '随机关键词格式': 'guanjianci', '随机外链': 'links',
      '随机友链': 'links', '随机句子': 'juzi', '随机地区': 'diqu', '随机人名': 'name',
      '随机表情': 'biaoqing', '随机图片': 'imglink', '随机双拼': 'shuangpin',
      '随机目录': 'mulu', '随机版本': 'banben', '随机自定义': 'zidingyi',
      '随机自定义1': 'zidingyi1', '随机自定义2': 'zidingyi2', '随机自定义3': 'zidingyi3',
      '随机文章标题': 'gptTitles', '随机链接': 'url',
    };

    for (let pass = 0; pass < 5; pass++) {
      const before = output;
      output = output.replace(/\{([^{}]+)\}/g, (all, tag) => {
        occurrence++;
        if (Object.prototype.hasOwnProperty.call(fixed, tag)) return fixed[tag];
        if (Object.prototype.hasOwnProperty.call(randomPoolTags, tag)) {
          const pool = pools[randomPoolTags[tag]] || [];
          return stablePick(pool, renderSeed, saltPrefix + '-' + tag + '-' + occurrence, '');
        }

        let match = tag.match(/^(?:随机)?数字(\d+)(?:-(\d+))?$/);
        if (!match) match = tag.match(/^随机(\d+)数字$/);
        if (match) {
          const min = Math.min(64, Math.max(1, Number(match[1])));
          const max = Math.min(64, Math.max(min, Number(match[2] || match[1])));
          return this.deterministicCharacters(renderSeed, saltPrefix + '-' + occurrence, min, max, '0123456789');
        }
        match = tag.match(/^(?:随机)?(字符|数字字母|数字大小写字母|字母|小写字母|大写字母|数字小写字母|数字大写字母)(\d+)(?:-(\d+))?$/);
        if (match) {
          const min = Math.min(64, Math.max(1, Number(match[2])));
          const max = Math.min(64, Math.max(min, Number(match[3] || match[2])));
          let alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          if (match[1] === '字母') alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
          if (match[1] === '小写字母') alphabet = 'abcdefghijklmnopqrstuvwxyz';
          if (match[1] === '大写字母') alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          if (match[1] === '数字小写字母') alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
          if (match[1] === '数字大写字母') alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          return this.deterministicCharacters(renderSeed, saltPrefix + '-' + occurrence, min, max, alphabet);
        }
        return all;
      });
      if (output === before) break;
    }
    return output;
  }

  rootDomain(host) {
    const cleanHost = String(host || '').replace(/:\d+$/, '').replace(/^www\./i, '');
    const parts = cleanHost.split('.').filter(Boolean);
    return parts.length > 2 ? parts.slice(-2).join('.') : cleanHost;
  }

  isGlobalHomeRequest(ctx, globalRoute) {
    if (!globalRoute) return false;
    const pathname = String(ctx && ctx.path || '/').toLowerCase();
    return pathname === '/' || pathname === '/index.html';
  }

  homeTemplate(host) {
    const domain = String(host || '').replace(/:\d+$/, '').toLowerCase();
    return stablePick(HOME_TEMPLATES, sha256(domain), 'home-template', HOME_TEMPLATES[0]);
  }

  async buildPage(ctx, options) {
    const routeDirectory = safeRouteDirectory(options && options.routeDirectory);
    const globalRoute = Boolean(options && options.globalRoute);
    const isMoviePage = !globalRoute && (ctx.path === MOVIE_ROUTE_PREFIX || String(ctx.path || '').indexOf(MOVIE_ROUTE_PREFIX + '/') === 0);
    const isHomePage = this.isGlobalHomeRequest(ctx, globalRoute);
    const routeBasePath = isMoviePage ? MOVIE_ROUTE_PREFIX : globalRoute ? '' : '/' + routeDirectory;
    if (!this.app.fanmuluArticleRuntimeReady || this.app.fanmuluArticlePreloadPromise) {
      await this.preloadRuntimeData(false);
    }
    const settings = await this.getSettings();
    const manifest = await this.getTemplateManifest();
    const enabledIds = settings.enabledTemplates || [];
    // app/view/template/fanmulu_article* 仅供默认 /Article/* 路由使用，
    // 全局泛目录模式继续使用原有模板，避免改变全站路由的页面风格。
    // fanmulu_article5 保留 /Article/download5/* 的固定路由，同时允许参与全局泛目录随机模板。
    const routeTemplates = globalRoute
      ? manifest.filter(item => !item.defaultOnly || item.id === 'fanmulu_article5')
      : manifest;
    let templates = routeTemplates.filter(item => !enabledIds.length || enabledIds.indexOf(item.id) !== -1);
    if (isMoviePage) templates = [ MOVIE_TEMPLATE ];
    if (!settings.enabled || !templates.length) return null;

    const host = cleanText(ctx.host || ctx.get('Host') || 'localhost', 255);
    const portalTemplate = templates.find(item => item.id === 'download_portal');
    // Keep the existing three-home mapping for other domains; assign the new
    // family independently, so its home and every article use the same theme.
    const portalFamily = globalRoute && portalTemplate && (templates.length === 1
      || stableIndex(sha256(host.replace(/:\d+$/, '').toLowerCase()), 'download-portal-domain', 4) === 0);
    if (globalRoute && portalTemplate) {
      templates = portalFamily ? [ portalTemplate ] : templates.filter(item => item.id !== 'download_portal');
    }
    if (!globalRoute && /^\/Article\/download5\//.test(ctx.path || '')) {
      const familyTemplate = templates.find(item => item.id === 'fanmulu_article5');
      if (familyTemplate) templates = [ familyTemplate ];
    }

    const identity = this.pageIdentity(
      isHomePage ? '/' : ctx.originalUrl || ctx.url || ctx.path || routeBasePath + '/index.html',
      routeDirectory,
      globalRoute
    );
    const state = await this.getPageState(identity, templates);
    let selectedTemplate = templates.find(item => item.id === state.templateId && item.file === state.templateFile);
    if (!selectedTemplate) selectedTemplate = stablePick(templates, identity.hash, 'template-current', templates[0]);

    const categoryNames = Object.keys(CATEGORY_LABELS).filter(name => name !== 'gpt');
    const loaded = await Promise.all(categoryNames.map(name => this.getPool(name)));
    const pools = {};
    categoryNames.forEach((name, index) => { pools[name] = loaded[index]; });
    const gptFiles = await this.categoryFiles('gpt');
    pools.gptTitles = gptFiles.map(name => path.basename(name, '.txt').replace(/-[a-f0-9]{8}$/i, ''));

    const source = await this.getArticleSource(state.articleFile, identity);
    const nowDate = new Date();
    const protocol = ctx.protocol === 'https' ? 'https' : 'http';
    const origin = protocol + '://' + host;
    const currentUrl = origin + identity.path;
    const selectedHomeTemplate = isHomePage ? (portalFamily
      ? { name: '首页·大型应用下载站', file: 'home/home_download_portal.html' }
      : this.homeTemplate(host)) : null;
    const isSpider = SPIDER_UA.test(String(ctx.get('User-Agent') || ''));
    const mainKeywordPool = isMoviePage ? await this.getMovieTitlePool(identity)
      : settings.spiderStrongEnabled && isSpider && pools.zh.length ? pools.zh : pools.keyword;
    const articleTitle = isMoviePage ? stablePick(mainKeywordPool, identity.hash, 'movie-title', '电影详情')
      : cleanText(source.title, 300) || stablePick(mainKeywordPool, identity.hash, 'article-title', '本地资讯详情');
    const baseValues = {
      articleTitle,
      articleContent: source.content,
      titleFormat: isMoviePage ? '{文章标题}' : stablePick(pools.biaoti, identity.hash, 'title-format', '{文章标题}'),
      descriptionFormat: stablePick(pools.miaoshu, identity.hash, 'description-format', '{描述}'),
      keywordFormat: stablePick(pools.guanjianci, identity.hash, 'keyword-format', '{关键词}'),
      linkFormat: stablePick(pools.url, identity.hash, 'link-format', identity.path),
      keyword: isMoviePage ? articleTitle : stablePick(mainKeywordPool, identity.hash, 'keyword', articleTitle),
      keyword1: stablePick(pools.keyword1, identity.hash, 'keyword1', articleTitle),
      keyword2: stablePick(pools.keyword2, identity.hash, 'keyword2', articleTitle),
      keyword3: stablePick(pools.keyword3, identity.hash, 'keyword3', articleTitle),
      keyword4: stablePick(pools.keyword4, identity.hash, 'keyword4', articleTitle),
      shortTitle: isMoviePage ? articleTitle : stablePick(pools.title, identity.hash, 'short-title', articleTitle),
      shortDescription: stablePick(pools.description, identity.hash, 'short-description', articleTitle),
      emoji: stablePick(pools.biaoqing, identity.hash, 'emoji', ''),
      personName: stablePick(pools.name, identity.hash, 'name', '网站编辑'),
      siteName: stablePick(pools.sitename, identity.hash, 'site-name', this.rootDomain(host) || '资讯中心'),
      image: stablePick(pools.imglink, identity.hash, 'image', ''),
      shuangpin: stablePick(pools.shuangpin, identity.hash, 'shuangpin', ''),
      directory: stablePick(pools.mulu, identity.hash, 'directory', routeDirectory),
      sentence: stablePick(pools.juzi, identity.hash, 'sentence', ''),
      region: stablePick(pools.diqu, identity.hash, 'region', ''),
      version: stablePick(pools.banben, identity.hash, 'version', 'v1.0.0'),
      custom: stablePick(pools.zidingyi, identity.hash, 'custom', ''),
      custom1: stablePick(pools.zidingyi1, identity.hash, 'custom1', ''),
      custom2: stablePick(pools.zidingyi2, identity.hash, 'custom2', ''),
      custom3: stablePick(pools.zidingyi3, identity.hash, 'custom3', ''),
      host,
      rootDomain: this.rootDomain(host),
      origin,
      currentUrl,
      now: formatShanghai(nowDate, true),
      date: formatShanghai(nowDate, false),
      timestamp: Math.floor(nowDate.getTime() / 1000),
    };

    let title = isMoviePage ? articleTitle : this.renderLibraryText(baseValues.titleFormat, baseValues, pools, identity, 'page-title');
    if (!stripHtml(title) || title === baseValues.titleFormat) title = articleTitle;
    baseValues.title = title;
    let description = this.renderLibraryText(baseValues.descriptionFormat, baseValues, pools, identity, 'page-description');
    if (!stripHtml(description) || description === baseValues.descriptionFormat) description = baseValues.shortDescription || articleTitle;
    description = stripHtml(description).slice(0, 260);
    let keywords = this.renderLibraryText(baseValues.keywordFormat, baseValues, pools, identity, 'page-keywords');
    keywords = stripHtml(keywords || baseValues.keyword).slice(0, 260);
    const rawContent = this.renderLibraryText(source.content || baseValues.sentence, baseValues, pools, identity, 'article-content');
    let contentHtml = this.formatArticleContent(rawContent, description);
    if (isMoviePage) contentHtml = movieContentLinks(contentHtml, currentUrl);

    const related = [];
    const relatedTitlePool = isMoviePage ? mainKeywordPool : pools.gptTitles.length ? pools.gptTitles : mainKeywordPool;
    for (let i = 0; i < (isMoviePage ? 30 : 12); i++) {
      const relatedTitle = stablePick(relatedTitlePool, identity.hash, 'related-title-' + i, articleTitle);
      const relatedHash = sha256(identity.path + '|related|' + i);
      related.push({
        title: escapeHtml(relatedTitle),
        url: routeBasePath + '/' + relatedHash.slice(0, 16) + '-' + (i + 1) + '.html',
        description: escapeHtml(description),
      });
    }

    const recommendations = [];
    for (let i = 0; i < (isMoviePage ? 108 : 18); i++) {
      const recommendationTitle = stablePick(mainKeywordPool, identity.hash, 'recommendation-title-' + i, articleTitle);
      const recommendationHash = sha256(identity.path + '|recommendation|' + i);
      recommendations.push({
        title: escapeHtml(recommendationTitle),
        url: routeBasePath + '/' + recommendationHash.slice(0, 16) + '-r' + (i + 1) + '.html',
        description: escapeHtml(description),
      });
    }

    const backupDomains = buildBackupDomains({
      patterns: pools.fan || [],
      origin,
      render: (pattern, salt) => this.renderLibraryText(pattern, baseValues, pools, identity, salt),
    });

    const images = [];
    for (let i = 0; i < 6; i++) {
      const image = stablePick(pools.imglink, identity.hash, 'image-' + i, '');
      if (image && /^https?:\/\//i.test(image)) {
        images.push(escapeHtml(image));
      }
    }
    const requestLinkSeed = crypto.randomBytes(16).toString('hex');
    const logoUrl = (isMoviePage ? routeBasePath : '/Article') + '/' + parseInt(requestLinkSeed.slice(0, 12), 16) + '.html';
    const urlLinks = [];
    for (let i = 0; i < 10; i++) {
      const raw = stablePick(pools.url, identity.hash, 'article-url-link-' + i, '');
      const rendered = this.renderLibraryText(raw, baseValues, pools, identity, 'article-url-link-' + i, requestLinkSeed).trim();
      if (isArticleLink(rendered)) {
        urlLinks.push({
          title: '',
          url: escapeHtml(rendered),
          source: 'url',
        });
      }
    }

    const friendLinks = this.renderFriendLinks(pools, baseValues, identity, requestLinkSeed, settings.friendLinksEnabled);

    const libraryLinks = [];
    urlLinks.concat(friendLinks).forEach(item => {
      const key = String(item.url || '');
      if (key) libraryLinks.push(item);
    });
    libraryLinks.forEach((item, index) => {
      item.title = escapeHtml(baseValues.siteName + (index + 1));
      if (isMoviePage) item.url = movieArticleLink(item.url, currentUrl);
    });
    if (isMoviePage) backupDomains.forEach(item => { item.url = movieArticleLink(item.url, currentUrl); });

    const version = this.renderLibraryText(baseValues.version, baseValues, pools, identity, 'version');
    const dailyOffset = stableIndex(identity.hash, baseValues.date, 3000);
    const page = {
      title: isMoviePage ? escapeHtml(title) : escapeHtml(stripHtml(title).slice(0, 300)),
      description: escapeHtml(description),
      keywords: escapeHtml(keywords),
      articleTitle: escapeHtml(articleTitle),
      contentHtml,
      siteName: escapeHtml(baseValues.siteName),
      canonical: escapeHtml(currentUrl),
      currentUrl: escapeHtml(currentUrl),
      requestPath: escapeHtml(identity.path),
      host: escapeHtml(host),
      rootDomain: escapeHtml(baseValues.rootDomain),
      author: escapeHtml(baseValues.personName),
      region: escapeHtml(baseValues.region),
      now: baseValues.now,
      date: baseValues.date,
      year: baseValues.date.slice(0, 4),
      version: escapeHtml(version),
      fileSize: (8 + stableIndex(identity.hash, 'file-size', 180)) + '.' + stableIndex(identity.hash, 'file-size-decimal', 10) + ' MB',
      viewCount: 1000 + identity.urlNumber % 90000 + dailyOffset,
      urlNumber: identity.urlNumber,
      hash: identity.hash,
      related,
      recommendations,
      backupDomains,
      images,
      friendLinks,
      libraryLinks,
      logoUrl,
      isSpider,
      isHomePage,
      templateName: selectedHomeTemplate ? selectedHomeTemplate.name : selectedTemplate.name,
      routeBasePath: escapeHtml(routeBasePath),
    };
    if (isMoviePage) page.movieVideoUrl = escapeHtml(await this.getMoviePlayUrl(identity));
    if (isHomePage) {
      const homeKeyword = stablePick(pools.keyword_home, currentUrl, 'home-browser-title', '');
      const replacedHomeKeyword = replaceHomeTitleTokens(stripHtml(homeKeyword), currentUrl);
      const homeTitle = replacedHomeKeyword.slice(0, 300);
      page.browserTitle = escapeHtml(homeTitle) || page.title;
      page.title = escapeHtml(homeTitle) || page.title;
      page.keywords = escapeHtml(replaceHomeTitleTokens(stripHtml(page.keywords), currentUrl + '|home-keywords').slice(0, 260));
      page.description = escapeHtml(replaceHomeTitleTokens(stripHtml(page.description), currentUrl + '|home-description').slice(0, 260));
    }
    if (portalFamily || [ 'download_portal', 'fanmulu_article5' ].indexOf(selectedTemplate.id) !== -1) {
      const portalSiteName = stablePick(pools.sitename, sha256(host.toLowerCase()), 'download-site-name', page.siteName);
      page.downloadPortal = this.downloadPortal(Object.assign({}, page, { words: mainKeywordPool, siteName: portalSiteName }), { pools, values: baseValues, identity });
    }
    return {
      template: selectedHomeTemplate ? selectedHomeTemplate.file : selectedTemplate.file,
      data: page,
    };
  }

  async listLibraryFiles() {
    await this.ensureDirectories();
    const entries = await fse.readdir(this.roots.data, { withFileTypes: true });
    const categories = [];
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].isDirectory()) continue;
      const category = safeCategory(entries[i].name);
      if (!category) continue;
      const files = await this.categoryFiles(category, true);
      const rows = [];
      let totalBytes = 0;
      for (let j = 0; j < files.length; j++) {
        const info = await fse.stat(path.join(this.roots.data, category, files[j]));
        totalBytes += info.size;
        rows.push({ name: files[j], size: info.size, updatedAt: info.mtime.toISOString() });
      }
      categories.push({
        name: category,
        label: CATEGORY_LABELS[category] || category,
        count: rows.length,
        size: totalBytes,
        files: rows,
      });
    }
    categories.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
    return categories;
  }

  libraryFilePath(category, fileName) {
    const safeDirectory = safeCategory(category);
    const safeName = safeFileName(fileName);
    if (!safeDirectory || !safeName) throw new Error('词库目录或文件名不合法');
    const candidate = path.join(this.roots.data, safeDirectory, safeName);
    if (!isInside(this.roots.data, candidate)) throw new Error('词库路径不合法');
    return { category: safeDirectory, fileName: safeName, fullPath: candidate };
  }

  async adminSummary() {
    const results = await Promise.all([
      this.listLibraryFiles(),
      this.getSettings(true),
      this.getTemplateManifest(true),
    ]);
    const categories = results[0];
    return {
      categories,
      settings: results[1],
      templates: results[2],
      totals: {
        categories: categories.length,
        files: categories.reduce((total, item) => total + item.count, 0),
        bytes: categories.reduce((total, item) => total + item.size, 0),
      },
      cache: {
        path: this.roots.cache,
        note: '按哈希前两位分成 256 个目录，每目录最多 500 个 JSON；队列最多1000条，每10秒批量处理10条，每 Worker 每分钟最多写入60个。',
        queue: {
          pending: this.app.fanmuluArticlePageStateQueue ? this.app.fanmuluArticlePageStateQueue.size : 0,
          dropped: Number(this.app.fanmuluArticlePageStateQueueDropped) || 0,
          processing: Boolean(this.app.fanmuluArticlePageStateQueueProcessing),
        },
      },
    };
  }

  async adminRead(params) {
    await this.ensureDirectories();
    const target = this.libraryFilePath(params.category, params.fileName);
    return {
      category: target.category,
      fileName: target.fileName,
      content: await this.readTextFile(target.fullPath, true),
    };
  }

  async adminSave(params) {
    await this.ensureDirectories();
    const target = this.libraryFilePath(params.category, params.fileName);
    const content = String(params.content === undefined || params.content === null ? '' : params.content);
    if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) throw new Error('词库文件不能超过 5MB');
    await fse.ensureDir(path.dirname(target.fullPath));
    await fse.outputFile(target.fullPath, content.replace(/\r\n/g, '\n'), 'utf8');
    await this.refreshRuntimeData('library-save');
    return { category: target.category, fileName: target.fileName, bytes: Buffer.byteLength(content, 'utf8') };
  }

  async adminCreate(params) {
    await this.ensureDirectories();
    const target = this.libraryFilePath(params.category, params.fileName);
    if (await fse.pathExists(target.fullPath)) throw new Error('同名词库文件已经存在');
    await fse.ensureDir(path.dirname(target.fullPath));
    await fse.outputFile(target.fullPath, '', { encoding: 'utf8', flag: 'wx' });
    await this.refreshRuntimeData('library-create');
    return { category: target.category, fileName: target.fileName };
  }

  async adminRemove(params) {
    await this.ensureDirectories();
    const target = this.libraryFilePath(params.category, params.fileName);
    if (!await fse.pathExists(target.fullPath)) throw new Error('词库文件不存在');
    await fse.unlink(target.fullPath);
    await this.refreshRuntimeData('library-remove');
    return { category: target.category, fileName: target.fileName };
  }

  async adminSaveSettings(params) {
    const manifest = await this.getTemplateManifest(true);
    const validIds = manifest.map(item => item.id);
    const inputTemplates = Array.isArray(params.enabledTemplates) ? params.enabledTemplates : [];
    const value = {
      enabled: params.enabled !== false,
      friendLinksEnabled: params.friendLinksEnabled !== false,
      spiderStrongEnabled: params.spiderStrongEnabled === true,
      enabledTemplates: inputTemplates.map(item => cleanText(item, 80)).filter(id => validIds.indexOf(id) !== -1),
    };
    await this.atomicJson(this.roots.settings, value);
    await this.refreshRuntimeData('settings-save');
    return value;
  }

  async adminClearCache() {
    await this.ensureDirectories();
    this.invalidateMemory();
    await fse.emptyDir(this.roots.cache);
    await this.preloadRuntimeData(true);
    if (this.app.messenger && typeof this.app.messenger.sendToApp === 'function') {
      this.app.messenger.sendToApp('fanmulu-article-data-updated', {
        sourcePid: process.pid,
        reason: 'cache-clear',
      });
    }
    return { cleared: true, path: this.roots.cache };
  }
}

module.exports = FanmuluArticleService;
