'use strict';

const Service = require('egg').Service;
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DEFAULT_ALLOWED_SPIDERS = [ '百度蜘蛛', '360蜘蛛', '必应蜘蛛', '搜狗蜘蛛', '头条蜘蛛', 'Yisou蜘蛛' ];

function text(value, maxLength) {
  return String(value === undefined || value === null ? '' : value).slice(0, maxLength);
}

function uniqueStrings(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  const result = [];
  value.forEach(item => {
    const current = text(item, maxLength).trim();
    if (current && result.indexOf(current) === -1 && result.length < maxItems) result.push(current);
  });
  return result;
}

const ROUTE_MODES = [ 'default', 'fanmulu', 'static' ];
const DEFAULT_STATIC_PATH = 'index.html';

function normalizeStaticPath(value) {
  const staticPath = text(value, 200).trim().replace(/\\/g, '/');
  if (!staticPath || staticPath.charAt(0) === '/' || /^[A-Za-z]:/.test(staticPath)) return DEFAULT_STATIC_PATH;
  const segments = staticPath.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) return DEFAULT_STATIC_PATH;
  if (!/\.html?$/i.test(staticPath)) return DEFAULT_STATIC_PATH;
  return staticPath;
}

function defaultPageHtml(device) {
  const isH5 = device === 'h5';
  const maxWidth = isH5 ? '420px' : '760px';
  const title = isH5 ? 'H5 Page' : 'PC Page';
  return '<!doctype html>\n'
    + '<html lang="zh-CN">\n'
    + '<head>\n'
    + '  <meta charset="UTF-8">\n'
    + '  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">\n'
    + '  <title>&#27426;&#36814;&#35775;&#38382;</title>\n'
    + '  <style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;background:#f5f7fb;color:#344054;font-family:Arial,"Microsoft YaHei",sans-serif}.page{box-sizing:border-box;width:calc(100% - 32px);max-width:' + maxWidth + ';padding:36px 24px;text-align:center;background:#fff;border:1px solid #e8edf5;border-radius:14px;box-shadow:0 12px 32px rgba(31,56,88,.08)}h1{margin:0 0 12px;font-size:' + (isH5 ? '24px' : '30px') + '}p{margin:0;color:#667085;line-height:1.8}</style>\n'
    + '</head>\n'
    + '<body>\n'
    + '  <main class="page"><h1>&#27426;&#36814;&#35775;&#38382;</h1><p>' + title + ' &#40664;&#35748;&#39029;&#38754;&#65292;&#21487;&#22312;&#21518;&#21488;&#20462;&#25913;&#12290;</p></main>\n'
    + '</body>\n'
    + '</html>';
}

class LocalData extends Service {
  get dataDir() {
    return this.app.config.localDataDir || path.join(this.app.baseDir, 'app', 'local_data');
  }

  filePath(name) {
    return path.join(this.dataDir, name + '.json');
  }

  pageFilePath(device) {
    return path.join(this.dataDir, 'site_page_' + (device === 'h5' ? 'h5' : 'pc') + '.html');
  }

  ensureDir() {
    return new Promise((resolve, reject) => {
      fs.mkdir(this.dataDir, error => {
        if (!error || error.code === 'EEXIST') return resolve();
        reject(error);
      });
    });
  }

  readFile(filePath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (error, content) => {
        if (error) reject(error);
        else resolve(content);
      });
    });
  }

  writeFile(filePath, content) {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, content, 'utf8', error => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  renameFile(from, to) {
    return new Promise((resolve, reject) => {
      fs.rename(from, to, error => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  unlinkFile(filePath) {
    return new Promise((resolve, reject) => {
      fs.unlink(filePath, error => {
        if (!error || error.code === 'ENOENT') return resolve();
        reject(error);
      });
    });
  }

  defaultSiteServerInfo() {
    return {
      admin_title: '后台管理中心',
      site_description: '站群统一管理与内容服务平台',
      global_config: '{\n  "timezone": "Asia/Shanghai",\n  "query_params": "merge"\n}',
      route_config: {
        mode: 'default',
      },
      blocked_ips: '',
      shield_mode: 'allow_all',
      spider_ip_whitelist: '',
      pc_page: {
        code: defaultPageHtml('pc'),
        use_url: false,
        url: '',
        stats_code: '',
        status_code: 403,
      },
      h5_page: {
        code: defaultPageHtml('h5'),
        use_url: false,
        url: '',
        stats_code: '',
        status_code: 403,
      },
      spider_firewall: { enabled: false, allowed_spiders: DEFAULT_ALLOWED_SPIDERS.slice() },
    };
  }

  normalizePageConfig(value) {
    const source = value && typeof value === 'object' ? value : {};
    const statusCode = Number(source.status_code);
    return {
      code: text(source.code, 2 * 1024 * 1024),
      use_url: source.use_url === true,
      url: text(source.url, 2000).trim(),
      stats_code: text(source.stats_code, 200 * 1024),
      status_code: [ 503, 502, 410, 403, 444 ].indexOf(statusCode) !== -1 ? statusCode : 403,
    };
  }

  normalizeRouteConfig(value) {
    const source = value && typeof value === 'object' ? value : {};
    const mode = ROUTE_MODES.indexOf(source.mode) !== -1 ? source.mode : 'default';
    return { mode };
  }

  normalizeSiteServerInfo(input) {
    const source = input && typeof input === 'object' ? input : {};
    const firewall = source.spider_firewall && typeof source.spider_firewall === 'object'
      ? source.spider_firewall : {};
    const allowedSpiders = Array.isArray(firewall.allowed_spiders)
      ? firewall.allowed_spiders.map(item => item === '神马蜘蛛' ? 'Yisou蜘蛛' : item)
      : DEFAULT_ALLOWED_SPIDERS;
    const mode = [ 'allow_all', 'spider_ua', 'spider_ip' ].indexOf(source.shield_mode) !== -1
      ? source.shield_mode : 'allow_all';
    return {
      admin_title: text(source.admin_title, 200),
      site_description: text(source.site_description, 1000),
      global_config: text(source.global_config, 20000),
      route_config: this.normalizeRouteConfig(source.route_config),
      blocked_ips: text(source.blocked_ips, 20000),
      shield_mode: mode,
      spider_ip_whitelist: text(source.spider_ip_whitelist, 20000),
      pc_page: this.normalizePageConfig(source.pc_page),
      h5_page: this.normalizePageConfig(source.h5_page),
      spider_firewall: {
        enabled: firewall.enabled === true,
        allowed_spiders: uniqueStrings(allowedSpiders, 50, 100),
      },
    };
  }

  async readJson(name, fallback) {
    try {
      const content = await this.readFile(this.filePath(name));
      const value = JSON.parse(content);
      return value && typeof value === 'object' ? value : fallback;
    } catch (error) {
      if (error && error.code !== 'ENOENT') {
        this.app.logger.warn('[local-data] read ' + name + ' failed: ' + String(error.message || error));
      }
      return fallback;
    }
  }

  async writeJson(name, value) {
    return this.writeAtomicFile(this.filePath(name), JSON.stringify(value, null, 2));
  }

  async writeAtomicFile(target, content) {
    await this.ensureDir();
    const temporary = target + '.tmp-' + process.pid + '-' + Date.now();
    await this.writeFile(temporary, content);
    try {
      await this.renameFile(temporary, target);
    } catch (error) {
      // Windows 在目标文件存在时无法直接覆盖，删除后再替换。
      if (!error || [ 'EEXIST', 'EPERM' ].indexOf(error.code) === -1) throw error;
      await this.unlinkFile(target);
      await this.renameFile(temporary, target);
    }
  }

  async initialize() {
    await this.ensureDir();
    let stored = await this.readJson('site_server_info', null);
    let needsWrite = !stored;
    if (!stored) stored = this.defaultSiteServerInfo();

    const normalizedRouteConfig = this.normalizeRouteConfig(stored.route_config);
    if (JSON.stringify(stored.route_config || {}) !== JSON.stringify(normalizedRouteConfig)) {
      stored.route_config = normalizedRouteConfig;
      needsWrite = true;
    }

    [ 'pc', 'h5' ].forEach(device => {
      const key = device + '_page';
      if (!stored[key] || typeof stored[key] !== 'object') {
        stored[key] = { code: defaultPageHtml(device), use_url: false, url: '', stats_code: '', status_code: 403 };
        needsWrite = true;
      } else if (!String(stored[key].code || '').trim() && !String(stored[key].url || '').trim()) {
        stored[key].code = defaultPageHtml(device);
        needsWrite = true;
      }
    });

    if (needsWrite) {
      stored.updated_at = new Date().toISOString();
      await this.writeJson('site_server_info', stored);
    }

    const data = await this.getSiteServerInfo();
    await Promise.all([ 'pc', 'h5' ].map(async device => {
      try {
        await this.readFile(this.pageFilePath(device));
      } catch (error) {
        if (!error || error.code !== 'ENOENT') throw error;
        const page = data[device + '_page'] || {};
        await this.writeAtomicFile(this.pageFilePath(device), page.code || defaultPageHtml(device));
      }
    }));

    return this.loadRuntimeState();
  }

  async getSiteServerInfo() {
    const fallback = this.defaultSiteServerInfo();
    const stored = await this.readJson('site_server_info', null);
    return Object.assign(fallback, this.normalizeSiteServerInfo(stored || fallback), {
      updated_at: stored && stored.updated_at ? stored.updated_at : '',
    });
  }

  async getRuntimeSiteServerInfo() {
    if (!this.app.siteServerInfoRuntime) await this.initialize();
    return this.app.siteServerInfoRuntime || this.defaultSiteServerInfo();
  }

  async loadRuntimeState() {
    const data = await this.getSiteServerInfo();
    const pages = {};
    await Promise.all([ 'pc', 'h5' ].map(async device => {
      const page = data[device + '_page'] || {};
      try {
        pages[device] = await this.readFile(this.pageFilePath(device));
      } catch (error) {
        if (!error || error.code !== 'ENOENT') {
          this.app.logger.warn('[local-data] read ' + device + ' page failed: ' + String(error.message || error));
        }
        pages[device] = String(page.code || defaultPageHtml(device));
      }
    }));
    this.app.siteServerInfoRuntime = data;
    this.app.sitePageHtmlRuntime = pages;
    return data;
  }

  validRemoteUrl(value) {
    try {
      const parsed = new URL(String(value || ''));
      return [ 'http:', 'https:' ].indexOf(parsed.protocol) !== -1 ? parsed.toString() : '';
    } catch (error) {
      return '';
    }
  }

  async resolvePageHtml(device, pageConfig) {
    const fallback = String(pageConfig.code || '');
    if (!pageConfig.use_url || !String(pageConfig.url || '').trim()) {
      return { device, status: 'textarea', html: fallback };
    }
    const source = String(pageConfig.url || '').trim();
    if (!/^https?:\/\//i.test(source)) {
      // Bare HTML names refer only to this server's public/html directory.
      if (!/^[^\\/:?%#\x00-\x1f]+\.html?$/i.test(source) || source.includes('..')) {
        return { device, status: 'invalid_url', html: fallback, message: '请填写 HTTP(S) 地址或本地 HTML 文件名' };
      }
      try {
        const root = await fs.promises.realpath(path.join(this.app.baseDir, 'app', 'public', 'html'));
        const file = await fs.promises.realpath(path.join(root, source));
        if (path.dirname(file) !== root) throw new Error('本地页面必须位于 app/public/html 目录内');
        const stat = await fs.promises.stat(file);
        if (!stat.isFile() || stat.size > 5 * 1024 * 1024) throw new Error('本地页面不是文件或超过 5MB');
        const html = await fs.promises.readFile(file, 'utf8');
        if (!html.trim()) throw new Error('本地页面内容为空');
        return { device, status: 'completed', html, url: source };
      } catch (error) {
        this.app.logger.warn('[local-data] read ' + device + ' local page failed: ' + String(error.message || error));
        return { device, status: 'failed', html: fallback, message: error.code === 'ENOENT' ? '本地 HTML 文件不存在：' + source : text(error.message || error, 200) };
      }
    }
    const url = this.validRemoteUrl(source);
    if (!url) return { device, status: 'invalid_url', html: fallback };
    try {
      const response = await axios({
        method: 'get',
        url,
        timeout: 10000,
        maxRedirects: 3,
        responseType: 'text',
        maxContentLength: 5 * 1024 * 1024,
        headers: { 'User-Agent': 'site-page-cache/1.0' },
        validateStatus: status => status >= 200 && status < 400,
      });
      const html = typeof response.data === 'string' ? response.data : String(response.data || '');
      if (!html.trim()) return { device, status: 'failed', html: fallback, message: '远程页面内容为空' };
      return { device, status: 'completed', html: text(html, 5 * 1024 * 1024), url };
    } catch (error) {
      this.app.logger.warn('[local-data] fetch ' + device + ' page failed: ' + String(error.message || error));
      return { device, status: 'failed', html: fallback, message: text(error.message || error, 200) };
    }
  }

  async getRuntimePageHtml(device) {
    if (!this.app.sitePageHtmlRuntime) await this.initialize();
    return String(this.app.sitePageHtmlRuntime && this.app.sitePageHtmlRuntime[device] || '');
  }

  async refreshVisitorPageCache() {
    const data = await this.getRuntimeSiteServerInfo();
    const results = await Promise.all([ 'pc', 'h5' ].map(async device => {
      const page = data[device + '_page'] || {};
      if (!page.use_url || !String(page.url || '').trim()) {
        return { device, status: 'skipped', message: '未开启链接页面' };
      }
      try {
        const result = await this.resolvePageHtml(device, page);
        // 自动刷新失败时保留上次成功的页面，不用文本框内容覆盖缓存。
        if (result.status === 'completed') {
          await this.writeAtomicFile(this.pageFilePath(device), result.html);
          this.app.sitePageHtmlRuntime = Object.assign({}, this.app.sitePageHtmlRuntime, {
            [device]: result.html,
          });
        }
        return { device, status: result.status, message: result.message || '' };
      } catch (error) {
        this.app.logger.warn('[local-data] refresh ' + device + ' page failed: ' + String(error.message || error));
        return { device, status: 'failed', message: text(error.message || error, 200) };
      }
    }));
    if (results.some(item => item.status === 'completed') && this.app.messenger
      && typeof this.app.messenger.sendToApp === 'function') {
      this.app.messenger.sendToApp('site-server-info-updated', { updated_at: data.updated_at });
    }
    return results;
  }

  async getStaticRouteHtml(relativePath) {
    const safePath = normalizeStaticPath(relativePath);
    const cache = this.app.globalRouteStaticCache || new Map();
    this.app.globalRouteStaticCache = cache;

    const cached = cache.get(safePath);
    if (cached && cached.expiresAt > Date.now()) return cached.html;
    if (cached) cache.delete(safePath);

    const root = path.resolve(this.app.baseDir, 'app', 'common_data', 'Article', 'static');
    const filePath = path.resolve(root, safePath);
    if (filePath !== root && filePath.indexOf(root + path.sep) !== 0) return '';

    let html = '';
    try {
      html = await this.readFile(filePath);
      if (Buffer.byteLength(html, 'utf8') > 5 * 1024 * 1024) html = '';
    } catch (error) {
      if (!error || error.code !== 'ENOENT') {
        this.app.logger.warn('[local-data] read static route page failed: ' + String(error.message || error));
      }
    }

    if (cache.size >= 128) cache.delete(cache.keys().next().value);
    cache.set(safePath, { html, expiresAt: Date.now() + (html ? 24 * 60 * 60 * 1000 : 10000) });
    return html;
  }

  async saveSiteServerInfo(input) {
    const data = this.normalizeSiteServerInfo(input);
    const activeRouteConfig = this.app.activeRouteConfig || this.defaultSiteServerInfo().route_config;
    const routeRestartRequired = [ 'mode' ]
      .some(key => data.route_config[key] !== activeRouteConfig[key]);
    const resolvedPages = await Promise.all([
      this.resolvePageHtml('pc', data.pc_page),
      this.resolvePageHtml('h5', data.h5_page),
    ]);
    data.updated_at = new Date().toISOString();
    await Promise.all([
      this.writeJson('site_server_info', data),
      this.writeAtomicFile(this.pageFilePath('pc'), resolvedPages[0].html),
      this.writeAtomicFile(this.pageFilePath('h5'), resolvedPages[1].html),
    ]);

    this.app.siteServerInfoRuntime = data;
    this.app.sitePageHtmlRuntime = {
      pc: resolvedPages[0].html,
      h5: resolvedPages[1].html,
    };
    this.app.globalRouteStaticCache = new Map();
    if (this.app.messenger && typeof this.app.messenger.sendToApp === 'function') {
      this.app.messenger.sendToApp('site-server-info-updated', { updated_at: data.updated_at });
    }
    const pageFetchStatus = resolvedPages.map(item => ({
      device: item.device,
      status: item.status,
      message: item.message || '',
    }));
    return Object.assign({}, data, {
      page_fetch_status: pageFetchStatus,
      route_restart_required: routeRestartRequired,
      active_route_config: Object.assign({}, activeRouteConfig),
    });
  }
}

module.exports = LocalData;
