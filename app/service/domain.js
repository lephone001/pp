"use strict";
const Service = require("egg").Service;
// const { IndexHints } = require("sequelize");
const fs = require("fs");
const path = require("path");
const dns = require('dns');
var moment = require('moment')
moment.locale('zh-CN');
const axios = require('axios').default
const crypto = require('crypto')
const COMMONDATA = require('../confi/index')
const cityCompanyName = require("./datajson/citycompanyname").cityCompanyName ;
const domainTriggerTasks = new Set();
const domainPushTasks = new Set();
const wordLibrarySyncTasks = new Set();
const contentSyncTasks = new Set();
const contentPushTasks = new Set();
const { updateDomainListFile } = require('../utils/domainListFile');

class Domain extends Service {
  async updateAllDomainList() {
    try {
      const count = await updateDomainListFile(this.ctx.model.Domain, this.ctx.app.baseDir || process.cwd());
      if (this.ctx.app.messenger && typeof this.ctx.app.messenger.sendToApp === 'function') {
        this.ctx.app.messenger.sendToApp('all-domain-list-updated', { sourcePid: process.pid });
      }
      return { code: 200, message: `更新成功，共 ${count} 个域名`, data: { count } };
    } catch (error) {
      this.ctx.logger.error('[all-domain-list] update failed: %s', error && error.stack || error);
      return { code: -1, message: '域名清单更新失败，请查看服务端日志' };
    }
  }

  domainCheckCachePath() {
    const dataRoot = this.ctx.app.config.localDataDir
      || path.join(this.ctx.app.baseDir || process.cwd(), 'app', 'local_data');
    return path.join(dataRoot, 'site_domain');
  }

  domainCheckAbnormalPath() {
    return this.domainCheckCachePath() + '_abnormal.ndjson';
  }

  domainCheckLockPath() {
    return this.domainCheckCachePath() + '.lock';
  }

  ensureDomainCheckDirectory() {
    const cacheDir = path.dirname(this.domainCheckCachePath());
    return new Promise((resolve, reject) => {
      fs.mkdir(cacheDir, { recursive: true }, error => {
        if (error && error.code !== 'EEXIST') return reject(error);
        resolve();
      });
    });
  }

  readDomainCheckFile(filePath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (error, data) => {
        if (error) return reject(error);
        resolve(data);
      });
    });
  }

  writeDomainCheckFile(filePath, content) {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, content, 'utf8', error => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  async writeDomainCheckCache(cache) {
    const filePath = this.domainCheckCachePath();
    const content = JSON.stringify(cache);
    await this.writeDomainCheckAtomicFile(filePath, content);
  }

  async writeDomainCheckAtomicFile(filePath, content) {
    await this.ensureDomainCheckDirectory();
    const tempPath = filePath + '.tmp-' + process.pid + '-' + Date.now();
    await this.writeDomainCheckFile(tempPath, content);
    await new Promise((resolve, reject) => {
      fs.rename(tempPath, filePath, error => {
        if (!error) return resolve();
        if (error.code !== 'EEXIST' && error.code !== 'EPERM') return reject(error);
        fs.unlink(filePath, unlinkError => {
          if (unlinkError && unlinkError.code !== 'ENOENT') return reject(unlinkError);
          fs.rename(tempPath, filePath, renameError => renameError ? reject(renameError) : resolve());
        });
      });
    });
  }

  async writeAbnormalDomainCache(rows) {
    const content = (rows || []).map(item => JSON.stringify(item)).join('\n');
    await this.writeDomainCheckAtomicFile(this.domainCheckAbnormalPath(), content);
  }

  readAbnormalDomainSlice(offset, limit) {
    const filePath = this.domainCheckAbnormalPath();
    offset = Math.max(0, Number(offset) || 0);
    limit = Math.min(100, Math.max(1, Number(limit) || 20));

    return new Promise((resolve, reject) => {
      const rows = [];
      let lineNumber = 0;
      let buffer = '';
      let settled = false;
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });

      const finish = () => {
        if (settled) return;
        settled = true;
        resolve(rows);
      };
      const parseLine = line => {
        if (lineNumber++ < offset || rows.length >= limit || !line) return;
        try {
          const item = JSON.parse(line);
          if (item && typeof item === 'object') rows.push(item);
        } catch (error) {
          // 单条损坏不影响其他检测结果。
        }
      };

      stream.on('data', chunk => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (let i = 0; i < lines.length; i++) {
          parseLine(lines[i]);
          if (rows.length >= limit) {
            stream.destroy();
            finish();
            return;
          }
        }
      });
      stream.on('end', () => {
        if (buffer) parseLine(buffer);
        finish();
      });
      stream.on('close', finish);
      stream.on('error', error => {
        if (settled) return;
        if (error && error.code === 'ENOENT') return finish();
        settled = true;
        reject(error);
      });
    });
  }

  async acquireDomainCheckLock() {
    await this.ensureDomainCheckDirectory();
    const lockPath = this.domainCheckLockPath();
    const tryCreate = () => new Promise((resolve, reject) => {
      fs.open(lockPath, 'wx', (error, descriptor) => {
        if (error) return reject(error);
        fs.close(descriptor, closeError => closeError ? reject(closeError) : resolve(true));
      });
    });

    try {
      return await tryCreate();
    } catch (error) {
      if (!error || error.code !== 'EEXIST') throw error;
      try {
        const stat = await new Promise((resolve, reject) => {
          fs.stat(lockPath, (statError, value) => statError ? reject(statError) : resolve(value));
        });
        // 防止服务异常退出后永久锁死。5 万站点检测最慢可能持续数小时，锁保留 24 小时。
        if (Date.now() - stat.mtimeMs <= 24 * 60 * 60 * 1000) return false;
        await new Promise((resolve, reject) => {
          fs.unlink(lockPath, unlinkError => unlinkError && unlinkError.code !== 'ENOENT' ? reject(unlinkError) : resolve());
        });
        return await tryCreate();
      } catch (lockError) {
        if (lockError && lockError.code === 'ENOENT') return await tryCreate();
        return false;
      }
    }
  }

  releaseDomainCheckLock() {
    return new Promise(resolve => {
      fs.unlink(this.domainCheckLockPath(), () => resolve());
    });
  }
  async readDomainCheckCache() {
    try {
      const content = await this.readDomainCheckFile(this.domainCheckCachePath());
      const cache = JSON.parse(content);
      return cache && typeof cache === 'object' ? cache : null;
    } catch (error) {
      // 兼容旧版本：第一次读取时把旧 cache/site_domain 迁移到 app/local_data。
      if (error && error.code === 'ENOENT') {
        const oldRoot = this.ctx.app.config.cacheFile || path.join(process.cwd(), 'cache');
        const oldPath = path.join(oldRoot, 'site_domain');
        try {
          const oldContent = await this.readDomainCheckFile(oldPath);
          const oldCache = JSON.parse(oldContent);
          if (oldCache && typeof oldCache === 'object') {
            await this.writeDomainCheckCache(oldCache);
            return oldCache;
          }
        } catch (migrationError) {
          if (migrationError && migrationError.code !== 'ENOENT') {
            this.ctx.app.logger.warn('[domain-check] migrate cache failed: ' + String(migrationError.message || migrationError));
          }
        }
      }
      if (!error || error.code !== 'ENOENT') {
        this.ctx.app.logger.warn('[domain-check] read cache failed: ' + String(error && error.message || error));
      }
      return null;
    }
  }

  domainCheckUrl(item) {
    const link = String(item && item.link || '').trim();
    if (!link) return '';
    if (/^https?:\/\//i.test(link)) return link;
    return (item && item.isHttps ? 'https://' : 'http://') + link;
  }

  async checkOneDomain(item) {
    const link = String(item && item.link || '').trim();
    const url = this.domainCheckUrl(item);
    const checkedAt = new Date().toISOString();
    const startedAt = Date.now();

    if (!url) {
      return { link, url, status: 'connection_error', error: 'empty domain', checkedAt };
    }

    try {
      const response = await axios({
        method: 'get',
        url,
        headers: { 'user-agent': 'Mozilla/5.0 domain-health-check' },
        timeout: 5000,
        maxRedirects: 3,
        // 只需要响应状态和耗时，收到响应头后立即关闭正文流，避免下载 5 万个完整页面。
        responseType: 'stream',
        validateStatus: () => true,
      });
      if (response.data && typeof response.data.destroy === 'function') response.data.destroy();
      const isNormal = response.status >= 200 && response.status < 400;
      return {
        link,
        url,
        status: isNormal ? 'normal' : 'connection_error',
        httpStatus: response.status,
        responseTime: Date.now() - startedAt,
        checkedAt,
      };
    } catch (error) {
      const errorText = String(error && error.message || '').toLowerCase();
      const isTimeout = error && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
        || errorText.indexOf('timeout') !== -1;
      return {
        link,
        url,
        status: isTimeout ? 'timeout' : 'connection_error',
        error: String(error && (error.code || error.message) || 'request failed').slice(0, 200),
        responseTime: Date.now() - startedAt,
        checkedAt,
      };
    }
  }

  async checkDomainBatch(domains) {
    const results = new Array(domains.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < domains.length) {
        const index = cursor++;
        results[index] = await this.checkOneDomain(domains[index]);
      }
    };
    // 网络检测属于 I/O 操作；限制并发，避免占满服务器连接和文件描述符。
    const workerCount = Math.min(20, Math.max(1, domains.length));
    const workers = [];
    for (let i = 0; i < workerCount; i++) workers.push(worker());
    await Promise.all(workers);
    return results;
  }

  async runDomainCheck(total, startedAt, previousSummary) {
    const counts = { normal: 0, connectionError: 0, timeout: 0 };
    const abnormalDomains = [];
    const batchSize = 500;
    const progressStep = 5000;
    let checked = 0;
    let lastId = null;
    let nextProgress = progressStep;

    while (true) {
      const criteria = lastId ? { _id: { $gt: lastId } } : {};
      const domains = await this.ctx.model.Domain.find(criteria)
        .sort({ _id: 1 })
        .limit(batchSize)
        .select('_id link isHttps')
        .lean();
      if (!domains.length) break;
      lastId = domains[domains.length - 1]._id;

      const results = await this.checkDomainBatch(domains);
      results.forEach(item => {
        if (item.status === 'normal') counts.normal++;
        else {
          if (item.status === 'timeout') counts.timeout++;
          else counts.connectionError++;
          abnormalDomains.push(item);
        }
      });
      checked += results.length;

      // 5 万站点只在每 5000 条时落一次轻量进度，减少磁盘写入。
      if (checked >= nextProgress) {
        await this.writeDomainCheckCache(Object.assign({}, previousSummary, {
          version: 2,
          status: 'running',
          startedAt,
          updatedAt: new Date().toISOString(),
          total,
          checked,
        }));
        nextProgress += progressStep;
      }
    }

    abnormalDomains.sort((left, right) => String(right.checkedAt || '').localeCompare(String(left.checkedAt || '')));
    await this.writeAbnormalDomainCache(abnormalDomains);

    await this.writeDomainCheckCache({
      version: 2,
      status: 'completed',
      startedAt,
      updatedAt: new Date().toISOString(),
      total,
      checked,
      counts,
      abnormalTotal: abnormalDomains.length,
      latestAbnormal: abnormalDomains.slice(0, 3),
    });
  }

  async testAllDomain() {
    if (domainTriggerTasks.has('all-domain-check')) {
      return { code: 200, message: '域名检测正在进行中', data: { status: 'running' } };
    }

    const locked = await this.acquireDomainCheckLock();
    if (!locked) {
      return { code: 200, message: '域名检测正在进行中', data: { status: 'running' } };
    }

    const startedAt = new Date().toISOString();
    const emptyCounts = { normal: 0, connectionError: 0, timeout: 0 };
    let total;
    let previousSummary;
    try {
      total = await this.ctx.model.Domain.countDocuments({});
      previousSummary = await this.readDomainCheckCache() || {};
    } catch (error) {
      await this.releaseDomainCheckLock();
      throw error;
    }

    const stableSummary = {
      counts: previousSummary.counts || emptyCounts,
      abnormalTotal: Number(previousSummary.abnormalTotal || 0),
      latestAbnormal: Array.isArray(previousSummary.latestAbnormal)
        ? previousSummary.latestAbnormal.slice(0, 3)
        : [],
    };

    try {
      await this.writeDomainCheckCache(Object.assign({}, stableSummary, {
        version: 2,
        status: 'running',
        startedAt,
        updatedAt: startedAt,
        total,
        checked: 0,
      }));
    } catch (error) {
      await this.releaseDomainCheckLock();
      throw error;
    }

    domainTriggerTasks.add('all-domain-check');
    this.runDomainCheck(total, startedAt, stableSummary)
      .catch(async error => {
        this.ctx.app.logger.error('[domain-check] run failed: ' + String(error && error.stack || error));
        try {
          await this.writeDomainCheckCache(Object.assign({}, stableSummary, {
            version: 2,
            status: 'failed',
            startedAt,
            updatedAt: new Date().toISOString(),
            total,
            checked: 0,
            error: 'domain check failed',
          }));
        } catch (cacheError) {
          this.ctx.app.logger.error('[domain-check] write failure cache failed: ' + String(cacheError && cacheError.message || cacheError));
        }
      })
      .then(async () => {
        domainTriggerTasks.delete('all-domain-check');
        await this.releaseDomainCheckLock();
      });

    return {
      code: 200,
      message: 'domain check started',
      /*
      message: '域名检测已开始',
      */
      data: { status: 'running', total },
    };
  }

  async domainCheckStatus(options) {
    const input = options || {};
    const cache = await this.readDomainCheckCache();
    let data = cache || {
      version: 2,
      status: 'never',
      startedAt: '',
      updatedAt: '',
      total: 0,
      checked: 0,
      counts: { normal: 0, connectionError: 0, timeout: 0 },
      abnormalTotal: 0,
      latestAbnormal: [],
    };
    const legacyResults = Array.isArray(data.results) ? data.results : [];
    let legacyAbnormal = Array.isArray(data.abnormalDomains) && data.abnormalDomains.length
      ? data.abnormalDomains
      : legacyResults.filter(item => item && item.status !== 'normal');
    if (Number(data.version || 1) < 2 || Array.isArray(data.results) || Array.isArray(data.abnormalDomains)) {
      legacyAbnormal.sort((left, right) => String(right.checkedAt || '').localeCompare(String(left.checkedAt || '')));
      await this.writeAbnormalDomainCache(legacyAbnormal);
      data = Object.assign({}, data, {
        version: 2,
        abnormalTotal: legacyAbnormal.length,
        latestAbnormal: legacyAbnormal.slice(0, 3),
      });
      delete data.results;
      delete data.abnormalDomains;
      await this.writeDomainCheckCache(data);
    }
    if (input.skipDatabaseCount !== true) {
      // 首页刷新时才读取一次当前站点总数；异常列表分页完全使用本地缓存。
      try {
        data = Object.assign({}, data, { total: await this.ctx.model.Domain.countDocuments({}) });
      } catch (error) {
        // MongoDB 暂时不可用时继续返回本地缓存，不能让首页状态区域整体失败。
      }
    }
    if (input.includeAbnormal === true) {
      const offset = Math.max(0, Number(input.abnormalOffset) || 0);
      const limit = Math.min(100, Math.max(1, Number(input.abnormalLimit) || 20));
      let abnormalDomains;
      if (offset === 0 && limit <= 3 && Array.isArray(data.latestAbnormal)) {
        abnormalDomains = data.latestAbnormal.slice(0, limit);
      } else {
        abnormalDomains = await this.readAbnormalDomainSlice(offset, limit);
        if (!abnormalDomains.length && legacyAbnormal.length) {
          abnormalDomains = legacyAbnormal.slice(offset, offset + limit);
        }
      }
      data = Object.assign({}, data, {
        abnormalTotal: Number(data.abnormalTotal || 0),
        abnormalDomains,
      });
    } else {
      data = Object.assign({}, data);
      delete data.abnormalDomains;
    }
    delete data.latestAbnormal;
    return {
      code: 200,
      data,
    };
  }

  async updateDomainStatus(_id, updates) {
    await this.ctx.model.Domain.findOneAndUpdate({
      _id,
    }, { $set: updates }, { new: true });
  }
  async domainListAll() {
    let uname = this.ctx.service.utils.getTokenInfo('username');
    let uid = this.ctx.service.utils.getTokenInfo('id');
    let rows = await this.ctx.model.Domain.find({
      uname,
      uid
    }).sort({ "_id": -1 }).select(`link keyWords description title`).lean()
    const ResponseData = {
      code: 200,
      data: {
        data: rows,
      },
    };
    return ResponseData;
  }
  normalizeSyncDomainLink(link) {
    return String(link || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  }
  getDomainSyncKey() {
    return String(COMMONDATA.DOMAIN_SYNC_KEY || '');
  }
  isDomainSyncPasswordValid(password) {
    const syncKey = this.getDomainSyncKey();
    const input = String(password || '');
    if (!syncKey || !input) return false;
    const syncKeyBuffer = Buffer.from(syncKey);
    const inputBuffer = Buffer.from(input);
    return syncKeyBuffer.length === inputBuffer.length && crypto.timingSafeEqual(syncKeyBuffer, inputBuffer);
  }
  async tongbuDomainList({ password, links = [], allDomains = false } = {}) {
    if (!this.getDomainSyncKey()) return { code: -1, message: '远程服务器未配置 DOMAIN_SYNC_KEY！' };
    if (!this.isDomainSyncPasswordValid(password)) return { code: -1, message: '同步密码错误！' };
    const syncAllDomains = allDomains === true;

    const normalizedLinks = Array.from(new Set(
      (Array.isArray(links) ? links : []).map(link => this.normalizeSyncDomainLink(link)).filter(Boolean)
    ));
    if (!syncAllDomains && !normalizedLinks.length) return { code: -1, message: '请填写需要同步的域名！' };
    if (!syncAllDomains && normalizedLinks.length > 100000) return { code: -1, message: '单次最多获取 100000 个域名！' };

    const criteria = syncAllDomains ? {} : { link: { $in: normalizedLinks } };
    const rows = await this.ctx.model.Domain.find(criteria).lean();
    return { code: 200, message: '获取成功！', data: { data: rows } };
  }
  async createUniqueSyncDomainId(preferredId) {
    if (preferredId !== undefined && preferredId !== null) {
      const exists = await this.ctx.model.Domain.exists({ id: preferredId });
      if (!exists) return preferredId;
    }
    let id;
    let exists = true;
    while (exists) {
      id = Number(`${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`);
      exists = await this.ctx.model.Domain.exists({ id });
    }
    return id;
  }
  async tongbuDomainSync({ serverUrl, password, links = [], allDomains = false, receiveUrl } = {}) {
    const syncAllDomains = allDomains === true;
    const normalizedLinks = Array.from(new Set(
      (Array.isArray(links) ? links : []).map(link => this.normalizeSyncDomainLink(link)).filter(Boolean)
    ));
    if (
      !/^https?:\/\//i.test(String(serverUrl || '')) ||
      !/^https?:\/\//i.test(String(receiveUrl || '')) ||
      !String(password || '') ||
      (!syncAllDomains && !normalizedLinks.length)
    ) {
      return { code: -1, message: '服务器地址、接收接口、密码或域名参数错误！' };
    }
    if (!syncAllDomains && normalizedLinks.length > 100000) return { code: -1, message: '单次最多同步 100000 个域名！' };

    const sourceServer = new URL(String(serverUrl).trim()).origin.toLowerCase();
    let remoteUrl = String(serverUrl).trim().replace(/\/+$/, '');
    if (!/\/api\/tongbuDomainPush$/i.test(remoteUrl)) remoteUrl += '/api/tongbuDomainPush';
    let callbackUrl = String(receiveUrl).trim().replace(/\/+$/, '');
    if (!/\/api\/tongbuDomainReceive$/i.test(callbackUrl)) callbackUrl += '/api/tongbuDomainReceive';

    const uid = this.ctx.service.utils.getTokenInfo('id');
    const uname = this.ctx.service.utils.getTokenInfo('username');
    const taskKey = crypto.createHash('sha256')
      .update(`${uid}|${sourceServer}|${remoteUrl}|${callbackUrl}|${syncAllDomains ? 'all' : normalizedLinks.join(',')}`)
      .digest('hex');
    if (domainTriggerTasks.has(taskKey)) {
      return {
        code: 200,
        message: '相同的域名同步任务已经提交，请勿重复操作！',
        data: { taskId: taskKey, queued: true },
      };
    }

    domainTriggerTasks.add(taskKey);
    setImmediate(() => {
      this.triggerRemoteDomainPush({
        remoteUrl,
        callbackUrl,
        password,
        normalizedLinks,
        syncAllDomains,
        uid,
        uname,
        sourceServer,
        taskKey,
      }).catch(error => {
        this.app.logger.error('[domain-trigger] task=%s failed: %s', taskKey, error.stack || error.message);
      }).finally(() => {
        domainTriggerTasks.delete(taskKey);
      });
    });

    return {
      code: 200,
      message: '域名同步任务已提交，远程服务器将在后台分批推送，请稍后刷新域名列表！',
      data: { taskId: taskKey, queued: true },
    };
  }
  async triggerRemoteDomainPush({
    remoteUrl,
    callbackUrl,
    password,
    normalizedLinks,
    syncAllDomains,
    uid,
    uname,
    sourceServer,
    taskKey,
  }) {
    const remoteResponse = await axios.post(remoteUrl, {
      password,
      links: normalizedLinks,
      allDomains: syncAllDomains,
      receiveUrl: callbackUrl,
      uid,
      uname,
      sourceServer,
    }, {
        timeout: 60000,
        maxContentLength: 10 * 1024 * 1024,
    });

    const remoteBody = remoteResponse && remoteResponse.data;
    if (!remoteBody || remoteBody.code !== 200) {
      throw new Error(
        remoteBody && remoteBody.message ? `远程服务器返回：${remoteBody.message}` : '远程服务器返回的数据格式错误！'
      );
    }
    this.app.logger.info('[domain-trigger] task=%s %s', taskKey, remoteBody.message || '远程推送任务已启动');
    return remoteBody;
  }
  async tongbuDomainPush({
    password,
    links = [],
    allDomains = false,
    receiveUrl,
    uid,
    uname,
    sourceServer,
  } = {}) {
    if (!this.getDomainSyncKey()) return { code: -1, message: '远程服务器未配置 DOMAIN_SYNC_KEY！' };
    if (!this.isDomainSyncPasswordValid(password)) return { code: -1, message: '同步密码错误！' };

    const syncAllDomains = allDomains === true;
    const normalizedLinks = Array.from(new Set(
      (Array.isArray(links) ? links : []).map(link => this.normalizeSyncDomainLink(link)).filter(Boolean)
    ));
    const normalizedSourceServer = /^https?:\/\//i.test(String(sourceServer || ''))
      ? new URL(String(sourceServer).trim()).origin.toLowerCase()
      : `${this.ctx.protocol}://${this.ctx.host}`.toLowerCase();
    if (!/^https?:\/\//i.test(String(receiveUrl || '')) || !uid || !String(uname || '')) {
      return { code: -1, message: '接收接口或接收用户参数错误！' };
    }
    if (!syncAllDomains && !normalizedLinks.length) return { code: -1, message: '请填写需要同步的域名！' };
    if (!syncAllDomains && normalizedLinks.length > 100000) return { code: -1, message: '单次最多同步 100000 个域名！' };

    const criteria = syncAllDomains ? {} : { link: { $in: normalizedLinks } };
    const total = await this.ctx.model.Domain.countDocuments(criteria);
    if (!total) return { code: -1, message: '没有找到需要同步的域名！' };

    const callbackUrl = String(receiveUrl).trim().replace(/\/+$/, '');
    const taskKey = crypto.createHash('sha256')
      .update(`${uid}|${normalizedSourceServer}|${callbackUrl}|${syncAllDomains ? 'all' : normalizedLinks.join(',')}`)
      .digest('hex');
    if (domainPushTasks.has(taskKey)) {
      return {
        code: 200,
        message: '相同的域名推送任务正在后台执行，请勿重复提交！',
        data: { taskId: taskKey, queued: true, total },
      };
    }

    domainPushTasks.add(taskKey);
    setImmediate(() => {
      this.pushDomainBatches({
        password,
        criteria,
        receiveUrl: callbackUrl,
        uid,
        uname: String(uname),
        sourceServer: normalizedSourceServer,
        taskKey,
        total,
      }).catch(error => {
        this.app.logger.error('[domain-push] task=%s failed: %s', taskKey, error.stack || error.message);
      }).finally(() => {
        domainPushTasks.delete(taskKey);
      });
    });

    return {
      code: 200,
      message: `远程服务器已启动后台推送，共 ${total} 个域名，每批 1000 条！`,
      data: { taskId: taskKey, queued: true, total, batchSize: 1000 },
    };
  }
  async pushDomainBatches({ password, criteria, receiveUrl, uid, uname, sourceServer, taskKey, total }) {
    let lastId = null;
    let batchIndex = 0;
    let pushed = 0;
    let imported = 0;
    let overwritten = 0;
    let failedCount = 0;

    while (true) {
      const batchCriteria = { ...criteria };
      if (lastId) batchCriteria._id = { $gt: lastId };
      const rows = await this.ctx.model.Domain.find(batchCriteria).sort({ _id: 1 }).limit(1000).lean();
      if (!rows.length) break;

      batchIndex += 1;
      const response = await axios.post(receiveUrl, {
        password,
        taskId: taskKey,
        batchIndex,
        total,
        uid,
        uname,
        sourceServer,
        rows,
      }, {
        timeout: 300000,
        maxContentLength: 50 * 1024 * 1024,
      });
      if (!response.data || response.data.code !== 200) {
        throw new Error(response.data && response.data.message ? response.data.message : `第 ${batchIndex} 批接收失败`);
      }

      const resultData = response.data.data || {};
      const batchCreated = Array.isArray(resultData.created) ? resultData.created : [];
      const batchUpdated = Array.isArray(resultData.updated) ? resultData.updated : [];
      const batchFailed = Array.isArray(resultData.failed) ? resultData.failed : [];
      imported += batchCreated.length;
      overwritten += batchUpdated.length;
      failedCount += batchFailed.length;
      if (batchFailed.length) {
        this.app.logger.warn(
          '[domain-push] task=%s batch=%s failed=%s details=%j',
          taskKey,
          batchIndex,
          batchFailed.length,
          batchFailed
        );
      }
      pushed += rows.length;
      lastId = rows[rows.length - 1]._id;
      this.app.logger.info(
        '[domain-push] task=%s batch=%s sent=%s/%s created=%s updated=%s failed=%s',
        taskKey,
        batchIndex,
        pushed,
        total,
        imported,
        overwritten,
        failedCount
      );
      if (rows.length < 1000) break;
    }

    this.app.logger.info(
      '[domain-push] task=%s completed sent=%s/%s created=%s updated=%s failed=%s',
      taskKey,
      pushed,
      total,
      imported,
      overwritten,
      failedCount
    );
    return { pushed, total, imported, overwritten, failed: failedCount, batchIndex };
  }
  async tongbuDomainReceive({ password, rows = [], uid, uname, sourceServer } = {}) {
    if (!this.getDomainSyncKey()) return { code: -1, message: '接收服务器未配置 DOMAIN_SYNC_KEY！' };
    if (!this.isDomainSyncPasswordValid(password)) return { code: -1, message: '同步密码错误！' };
    if (!Array.isArray(rows) || !rows.length || rows.length > 1000) {
      return { code: -1, message: '每批必须包含 1 至 1000 个域名！' };
    }
    if (!uid || !String(uname || '') || !/^https?:\/\//i.test(String(sourceServer || ''))) {
      return { code: -1, message: '接收用户或来源服务器参数错误！' };
    }

    return await this.executeDomainSyncImport({
      remoteRows: rows,
      normalizedLinks: [],
      syncAllDomains: true,
      uid,
      uname: String(uname),
      sourceServer: new URL(String(sourceServer).trim()).origin.toLowerCase(),
    });
  }
  getSyncRelationId(value) {
    if (!value) return '';
    return String(value._id || value).trim();
  }
  async getSyncRelationMap(model, sourceServer, ids) {
    const sourceIds = Array.from(new Set(ids.filter(Boolean)));
    if (!sourceIds.length) return new Map();
    const rows = await model.find({
      'fromObj.server': sourceServer,
      'fromObj.id': { $in: sourceIds },
    }).select('_id fromObj').lean();
    return new Map(rows.map(item => [String(item.fromObj.id), item._id]));
  }
  async executeDomainSyncImport({ remoteRows, normalizedLinks, syncAllDomains, uid, uname, sourceServer }) {
    const remoteLinks = Array.from(new Set(
      remoteRows.map(item => this.normalizeSyncDomainLink(item.link)).filter(Boolean)
    ));
    const existingRows = await this.ctx.model.Domain.find({ link: { $in: remoteLinks } }).select('_id link id').lean();
    const existingMap = new Map(existingRows.map(item => [item.link, item]));
    const remoteFanIds = remoteRows.map(item => this.getSyncRelationId(item && item.fcid));
    const remoteMuluIds = remoteRows.map(item => this.getSyncRelationId(item && item.mcid));
    const [fanRelationMap, muluRelationMap] = await Promise.all([
      this.getSyncRelationMap(this.ctx.model.Fancategory, sourceServer, remoteFanIds),
      this.getSyncRelationMap(this.ctx.model.Mulucategory, sourceServer, remoteMuluIds),
    ]);
    const returnedLinks = new Set(remoteRows.map(item => this.normalizeSyncDomainLink(item.link)));
    const created = [];
    const updated = [];
    const failed = [];
    let domainListChanged = false;

    for (const remoteRow of remoteRows) {
      const link = this.normalizeSyncDomainLink(remoteRow.link);
      if (!link) {
        failed.push({ link: String(remoteRow.link || ''), message: '远程数据缺少有效域名' });
        continue;
      }
      try {
        const remoteId = String(remoteRow._id || '');
        const remoteFcid = this.getSyncRelationId(remoteRow.fcid);
        const remoteMcid = this.getSyncRelationId(remoteRow.mcid);
        if (remoteFcid && !fanRelationMap.has(remoteFcid)) {
          failed.push({ link, message: `未找到泛站分类映射：${remoteFcid}` });
          continue;
        }
        if (remoteMcid && !muluRelationMap.has(remoteMcid)) {
          failed.push({ link, message: `未找到目录分类映射：${remoteMcid}` });
          continue;
        }

        const payload = { ...remoteRow };
        delete payload._id;
        payload.link = link;
        payload.uid = uid;
        payload.uname = uname;
        payload.fromObj = { id: remoteId, server: sourceServer };
        if (remoteFcid) payload.fcid = fanRelationMap.get(remoteFcid);
        else delete payload.fcid;
        if (remoteMcid) payload.mcid = muluRelationMap.get(remoteMcid);
        else delete payload.mcid;

        const existing = existingMap.get(link);
        if (existing) {
          payload.id = existing.id;
          const document = new this.ctx.model.Domain({ ...payload, _id: existing._id });
          const replaceData = document.toObject({ depopulate: true, versionKey: true });
          await this.ctx.model.Domain.collection.replaceOne({ _id: existing._id }, replaceData);
          await this.refreshDomain(link);
          updated.push(link);
        } else {
          payload.id = await this.createUniqueSyncDomainId(payload.id);
          const document = new this.ctx.model.Domain(payload);
          const insertData = document.toObject({ depopulate: true, versionKey: true });
          await this.ctx.model.Domain.collection.insertOne(insertData);
          domainListChanged = true;
          await this.refreshDomain(link);
          existingMap.set(link, { _id: insertData._id, link, id: insertData.id });
          created.push(link);
        }
      } catch (error) {
        failed.push({ link, message: error.message });
      }
    }

    if (!syncAllDomains) {
      normalizedLinks.forEach(link => {
        if (!returnedLinks.has(link)) failed.push({ link, message: '远程服务器未找到该域名' });
      });
    }
    if (created.length || updated.length) await this.ctx.service.counters.set('Domain');
    if (domainListChanged) await this.updateAllDomainList();

    return {
      code: 200,
      message: `同步完成：新增 ${created.length} 个，覆盖 ${updated.length} 个，失败 ${failed.length} 个`,
      data: { created, updated, skipped: [], failed },
    };
  }
  getWordLibrarySyncConfig(type) {
    if (type === 'fan') {
      return {
        categoryModel: this.ctx.model.Fancategory,
        wordModel: this.ctx.model.Fan,
        foreignKey: 'fcid',
        remotePath: '/api/tongbuFanList',
        label: '泛站',
      };
    }
    return {
      categoryModel: this.ctx.model.Mulucategory,
      wordModel: this.ctx.model.Mulu,
      foreignKey: 'mcid',
      remotePath: '/api/tongbuMuluList',
      label: '目录',
    };
  }
  async tongbuWordLibraryList(type, { password } = {}) {
    if (!this.getDomainSyncKey()) return { code: -1, message: '远程服务器未配置 DOMAIN_SYNC_KEY！' };
    if (!this.isDomainSyncPasswordValid(password)) return { code: -1, message: '同步密码错误！' };

    const config = this.getWordLibrarySyncConfig(type);
    const wordCount = await config.wordModel.countDocuments({});
    if (wordCount > 1000000) {
      return { code: -1, message: `${config.label}词条总数 ${wordCount} 条，超过单次同步上限 1000000 条！` };
    }
    const [categories, words] = await Promise.all([
      config.categoryModel.find({}).lean(),
      config.wordModel.find({}).lean(),
    ]);
    const wordMap = new Map();
    words.forEach(word => {
      const key = String(word[config.foreignKey]);
      if (!wordMap.has(key)) wordMap.set(key, []);
      wordMap.get(key).push(word);
    });

    return {
      code: 200,
      message: '获取成功！',
      data: {
        wordCount,
        libraries: categories.map(category => ({
          category,
          words: wordMap.get(String(category._id)) || [],
        })),
      },
    };
  }
  async tongbuWordLibrarySync(type, { serverUrl, password } = {}) {
    if (!/^https?:\/\//i.test(String(serverUrl || '')) || !String(password || '')) {
      return { code: -1, message: '服务器地址或密码参数错误！' };
    }

    const config = this.getWordLibrarySyncConfig(type);
    const sourceServer = new URL(String(serverUrl).trim()).origin.toLowerCase();
    let remoteUrl = String(serverUrl).trim().replace(/\/+$/, '');
    if (!remoteUrl.toLowerCase().endsWith(config.remotePath.toLowerCase())) remoteUrl += config.remotePath;

    let remoteResponse;
    try {
      remoteResponse = await axios.post(remoteUrl, { password }, {
        timeout: 600000,
        maxContentLength: 2 * 1024 * 1024 * 1024,
      });
    } catch (error) {
      return { code: -1, message: `远程服务器连接失败：${error.message}` };
    }

    const remoteBody = remoteResponse && remoteResponse.data;
    if (!remoteBody || remoteBody.code !== 200) {
      return {
        code: -1,
        message: remoteBody && remoteBody.message ? `远程服务器返回：${remoteBody.message}` : '远程服务器返回的数据格式错误！',
      };
    }
    const libraries = remoteBody.data && Array.isArray(remoteBody.data.libraries) ? remoteBody.data.libraries : [];
    if (!libraries.length) return { code: -1, message: `远程服务器没有返回${config.label}分类数据！` };
    const remoteWordCount = Number(remoteBody.data && remoteBody.data.wordCount) || libraries.reduce((total, item) => {
      return total + (item && Array.isArray(item.words) ? item.words.length : 0);
    }, 0);
    if (remoteWordCount > 1000000) {
      return { code: -1, message: `远程服务器词条总数 ${remoteWordCount} 条，超过同步上限 1000000 条！` };
    }

    const uid = this.ctx.service.utils.getTokenInfo('id');
    const uname = this.ctx.service.utils.getTokenInfo('username');
    const taskKey = crypto.createHash('sha256')
      .update(`${type}|${uid}|${sourceServer}|${remoteUrl}`)
      .digest('hex');
    if (wordLibrarySyncTasks.has(taskKey)) {
      return {
        code: 200,
        message: `相同的${config.label}同步任务正在后台执行，请勿重复提交！`,
        data: { taskId: taskKey, queued: true, created: [], skipped: [], failed: [] },
      };
    }

    wordLibrarySyncTasks.add(taskKey);
    setImmediate(() => {
      this.executeWordLibrarySyncImport({ type, libraries, uid, uname, sourceServer }).then(result => {
        this.app.logger.info('[word-library-sync] task=%s %s', taskKey, result.message);
      }).catch(error => {
        this.app.logger.error('[word-library-sync] task=%s failed: %s', taskKey, error.stack || error.message);
      }).finally(() => {
        wordLibrarySyncTasks.delete(taskKey);
      });
    });

    return {
      code: 200,
      message: `${config.label}同步任务已提交后台处理，共接收 ${libraries.length} 个分类、${remoteWordCount} 条词，请稍后查看！`,
      data: {
        taskId: taskKey,
        queued: true,
        categoryCount: libraries.length,
        wordCount: remoteWordCount,
        created: [],
        skipped: [],
        failed: [],
      },
    };
  }
  async executeWordLibrarySyncImport({ type, libraries, uid, uname, sourceServer }) {
    const config = this.getWordLibrarySyncConfig(type);
    const existingCategories = await config.categoryModel.find({ uid }).select('_id name fromObj').lean();
    const sourceCategoryMap = new Map();
    const unclaimedNameMap = new Map();
    existingCategories.forEach(item => {
      const fromObj = item.fromObj || {};
      if (fromObj.server && fromObj.id) {
        sourceCategoryMap.set(`${fromObj.server}|${fromObj.id}`, item);
      } else {
        unclaimedNameMap.set(String(item.name || '').trim(), item);
      }
    });
    const created = [];
    const updated = [];
    const failed = [];

    for (const library of libraries) {
      const remoteCategory = library && library.category;
      const remoteCategoryId = remoteCategory && String(remoteCategory._id || '');
      const name = remoteCategory && String(remoteCategory.name || '').trim();
      if (!remoteCategory || !remoteCategoryId || !name) {
        failed.push({ categoryId: remoteCategoryId, name, wordCount: 0, message: '远程分类数据不完整' });
        continue;
      }
      const categoryFromObj = { id: remoteCategoryId, server: sourceServer };

      try {
        const sourceKey = `${sourceServer}|${remoteCategoryId}`;
        let existingCategory = sourceCategoryMap.get(sourceKey);
        if (!existingCategory && unclaimedNameMap.has(name)) {
          existingCategory = unclaimedNameMap.get(name);
          unclaimedNameMap.delete(name);
        }

        const categoryPayload = { ...remoteCategory };
        delete categoryPayload._id;
        categoryPayload.uid = uid;
        categoryPayload.uname = uname;
        categoryPayload.fromObj = categoryFromObj;
        let localCategoryId;
        let categoryWasUpdated = false;
        if (existingCategory) {
          const categoryDocument = new config.categoryModel({ ...categoryPayload, _id: existingCategory._id });
          const categoryReplaceData = categoryDocument.toObject({ depopulate: true, versionKey: true });
          await config.categoryModel.collection.replaceOne({ _id: existingCategory._id }, categoryReplaceData);
          localCategoryId = existingCategory._id;
          categoryWasUpdated = true;
        } else {
          const categoryDocument = new config.categoryModel(categoryPayload);
          const categoryInsertData = categoryDocument.toObject({ depopulate: true, versionKey: true });
          await config.categoryModel.collection.insertOne(categoryInsertData);
          localCategoryId = categoryInsertData._id;
        }
        sourceCategoryMap.set(sourceKey, { _id: localCategoryId, name, fromObj: categoryFromObj });

        const words = Array.isArray(library.words) ? library.words : [];
        let wordCreated = 0;
        let wordUpdated = 0;
        if (words.length) {
          const remoteWordIds = words.map(item => String(item && item._id || '')).filter(Boolean);
          const existingWords = await config.wordModel.find({
            uid,
            'fromObj.server': sourceServer,
            'fromObj.id': { $in: remoteWordIds },
          }).select('_id fromObj').lean();
          const existingWordMap = new Map(
            existingWords.map(item => [String(item.fromObj.id), item])
          );
          const operations = words.map(remoteWord => {
            const remoteWordId = String(remoteWord._id || '');
            const wordPayload = { ...remoteWord };
            delete wordPayload._id;
            wordPayload.uid = uid;
            wordPayload.uname = uname;
            wordPayload.fromObj = { id: remoteWordId, server: sourceServer };
            wordPayload[config.foreignKey] = localCategoryId;
            const existingWord = existingWordMap.get(remoteWordId);
            if (existingWord) {
              wordUpdated += 1;
              const wordDocument = new config.wordModel({ ...wordPayload, _id: existingWord._id });
              return {
                replaceOne: {
                  filter: { _id: existingWord._id },
                  replacement: wordDocument.toObject({ depopulate: true, versionKey: true }),
                },
              };
            }
            wordCreated += 1;
            const wordDocument = new config.wordModel(wordPayload);
            return {
              insertOne: {
                document: wordDocument.toObject({ depopulate: true, versionKey: true }),
              },
            };
          });
          await config.wordModel.collection.bulkWrite(operations, { ordered: false });
        }
        const resultItem = {
          categoryId: remoteCategoryId,
          name,
          wordCount: words.length,
          wordCreated,
          wordUpdated,
        };
        if (categoryWasUpdated) updated.push(resultItem);
        else created.push(resultItem);
      } catch (error) {
        failed.push({ categoryId: remoteCategoryId, name, wordCount: 0, message: error.message });
      }
    }

    return {
      code: 200,
      message: `${config.label}同步完成：新增 ${created.length} 个，覆盖 ${updated.length} 个，失败 ${failed.length} 个`,
      data: { created, updated, skipped: [], failed },
    };
  }
  getContentSyncConfig(type) {
    const configs = {
      wenzhang: {
        label: '采集文章和分类', itemModel: this.ctx.model.Wenzhang,
        batchSize: 50,
        categoryModel: this.ctx.model.WenzhangCate, categoryField: 'categoryId',
      },
      article: {
        label: '旧文章', itemModel: this.ctx.model.Article,
        categoryModel: this.ctx.model.ArticleCategory, categoryField: 'cid',
      },
      // CBD 正文体积较大，缩小单批数量以限制 JSON、Axios 和 MongoDB 写入的瞬时内存。
      articleCbd: { label: 'CBD文章', itemModel: this.ctx.model.ArticleCbd, batchSize: 100 },
      articleCompany: {
        label: '文章工厂',
        itemModel: this.ctx.model.ArticleComapany || this.ctx.model.ArticleCompany || this.ctx.model.articleCompany,
      },
      app: {
        label: 'APP文章', itemModel: this.ctx.model.App,
        categoryModel: this.ctx.model.AppCategory, categoryField: 'ncids',
      },
      nav: {
        label: '导航', itemModel: this.ctx.model.Nav,
        categoryModel: this.ctx.model.NavCategory, categoryField: 'ncids', uniqueField: 'link',
      },
      video: {
        label: '视频', itemModel: this.ctx.model.Video,
        categoryModel: this.ctx.model.VideoCategory, categoryField: 'cid',
        platformModel: this.ctx.model.VideoPlatform,
      },
    };
    return configs[type];
  }
  normalizeContentSyncLimit(limit, syncAll) {
    if (syncAll) return 0;
    const value = Number(limit);
    return Number.isInteger(value) && value >= 1 && value <= 1000000 ? value : -1;
  }
  async tongbuContentList({ password, type, limit = 1000, all = false } = {}) {
    if (!this.getDomainSyncKey()) return { code: -1, message: '远程服务器未配置 DOMAIN_SYNC_KEY！' };
    if (!this.isDomainSyncPasswordValid(password)) return { code: -1, message: '同步密码错误！' };
    const config = this.getContentSyncConfig(type);
    if (!config) return { code: -1, message: '不支持的同步类型！' };
    const syncAll = all === true;
    const syncLimit = this.normalizeContentSyncLimit(limit, syncAll);
    if (syncLimit < 0) return { code: -1, message: '同步数量必须是 1 到 1000000 之间的整数！' };
    let query = config.itemModel.find({}).sort({ _id: -1 });
    if (!syncAll) query = query.limit(syncLimit);
    const items = await query.lean();
    let categories = [];
    if (config.categoryModel) {
      categories = await config.categoryModel.find({}).lean();
    }
    const platforms = config.platformModel ? await config.platformModel.find({}).lean() : [];
    return { code: 200, message: '获取成功！', data: { type, count: items.length, categories, platforms, items } };
  }
  async tongbuContentSync({ serverUrl, password, type, limit = 1000, all = false, receiveUrl } = {}) {
    if (!/^https?:\/\//i.test(String(serverUrl || '')) || !/^https?:\/\//i.test(String(receiveUrl || '')) || !String(password || '')) {
      return { code: -1, message: '服务器地址、接收接口或密码参数错误！' };
    }
    const config = this.getContentSyncConfig(type);
    if (!config || !config.itemModel) return { code: -1, message: '不支持的同步类型！' };
    const syncAll = all === true;
    const syncLimit = this.normalizeContentSyncLimit(limit, syncAll);
    if (syncLimit < 0) return { code: -1, message: '同步数量必须是 1 到 1000000 之间的整数！' };
    const sourceServer = new URL(String(serverUrl).trim()).origin.toLowerCase();
    let remoteUrl = String(serverUrl).trim().replace(/\/+$/, '');
    if (!/\/api\/tongbuContentPush$/i.test(remoteUrl)) remoteUrl += '/api/tongbuContentPush';
    let callbackUrl = String(receiveUrl).trim().replace(/\/+$/, '');
    if (!/\/api\/tongbuContentReceive$/i.test(callbackUrl)) callbackUrl += '/api/tongbuContentReceive';
    const uid = this.ctx.service.utils.getTokenInfo('id');
    const uname = this.ctx.service.utils.getTokenInfo('username');
    const taskKey = crypto.createHash('sha256').update(`${type}|${uid}|${sourceServer}|${syncAll ? 'all' : syncLimit}`).digest('hex');
    if (contentSyncTasks.has(taskKey)) {
      return { code: 200, message: `相同的${config.label}同步任务已经提交，请勿重复操作！`, data: { taskId: taskKey, queued: true } };
    }
    contentSyncTasks.add(taskKey);
    const batchSize = config.batchSize || 1000;
    setImmediate(() => {
      this.triggerRemoteContentPush({ remoteUrl, callbackUrl, password, type, syncLimit, syncAll, uid, uname, sourceServer, taskKey })
        .catch(error => this.app.logger.error('[content-trigger] task=%s failed: %s', taskKey, error.stack || error.message))
        .finally(() => contentSyncTasks.delete(taskKey));
    });
    return { code: 200, message: `${config.label}同步任务已提交，源服务器将在后台每批推送 ${batchSize} 条！`, data: { taskId: taskKey, queued: true, batchSize } };
  }
  async triggerRemoteContentPush({ remoteUrl, callbackUrl, password, type, syncLimit, syncAll, uid, uname, sourceServer, taskKey }) {
    const response = await axios.post(remoteUrl, {
      password, type, limit: syncLimit, all: syncAll, receiveUrl: callbackUrl, uid, uname, sourceServer,
    }, { timeout: 60000, maxContentLength: 10 * 1024 * 1024, maxBodyLength: 10 * 1024 * 1024 });
    if (!response.data || response.data.code !== 200) {
      throw new Error(response.data && response.data.message ? response.data.message : '源服务器启动推送失败！');
    }
    this.app.logger.info('[content-trigger] task=%s %s', taskKey, response.data.message);
  }
  async tongbuScheduledContentSync({ type, serverUrl, receiveUrl, password, limit = 1000 } = {}) {
    if (!/^https?:\/\//i.test(String(serverUrl || '')) || !/^https?:\/\//i.test(String(receiveUrl || '')) || !String(password || '')) {
      return { code: -1, message: '定时同步的服务器地址、接收地址或密码配置不完整！' };
    }
    const config = this.getContentSyncConfig(type);
    if (!config || !config.itemModel || ![ 'wenzhang', 'articleCbd', 'video', 'app', 'article' ].includes(type)) {
      return { code: -1, message: '该内容不支持定时同步！' };
    }
    // 定时同步始终只取设置数量的最新记录，绝不执行全量同步。
    const syncAll = false;
    const syncLimit = this.normalizeContentSyncLimit(limit, false);
    if (syncLimit < 0) return { code: -1, message: '同步数量必须是 1 到 1000000 之间的整数！' };
    const sourceServer = new URL(String(serverUrl).trim()).origin.toLowerCase();
    let remoteUrl = String(serverUrl).trim().replace(/\/+$/, '');
    if (!/\/api\/tongbuContentPush$/i.test(remoteUrl)) remoteUrl += '/api/tongbuContentPush';
    let callbackUrl = String(receiveUrl).trim().replace(/\/+$/, '');
    if (!/\/api\/tongbuContentReceive$/i.test(callbackUrl)) callbackUrl += '/api/tongbuContentReceive';
    const uid = `${type}-schedule`;
    const uname = `${config.label}定时同步`;
    const taskKey = crypto.createHash('sha256')
      .update(`${type}|schedule|${sourceServer}|${syncAll ? 'all' : syncLimit}`)
      .digest('hex');
    if (contentSyncTasks.has(taskKey)) {
      return { code: 200, message: `${config.label}定时同步任务正在执行！`, data: { taskId: taskKey, queued: true } };
    }
    contentSyncTasks.add(taskKey);
    try {
      await this.triggerRemoteContentPush({
        remoteUrl, callbackUrl, password, type, syncLimit, syncAll,
        uid, uname, sourceServer, taskKey,
      });
      return {
        code: 200,
        message: `${config.label}定时同步任务已提交，将获取最新 ${syncLimit} 条！`,
        data: { taskId: taskKey, queued: true, batchSize: config.batchSize || 1000 },
      };
    } finally {
      contentSyncTasks.delete(taskKey);
    }
  }
  async tongbuScheduledWenzhangSync(settings = {}) {
    return this.tongbuScheduledContentSync({ ...settings, type: 'wenzhang' });
  }
  async tongbuContentPush({ password, type, limit = 1000, all = false, receiveUrl, uid, uname, sourceServer } = {}) {
    if (!this.getDomainSyncKey()) return { code: -1, message: '源服务器未配置 DOMAIN_SYNC_KEY！' };
    if (!this.isDomainSyncPasswordValid(password)) return { code: -1, message: '同步密码错误！' };
    const config = this.getContentSyncConfig(type);
    if (!config || !config.itemModel) return { code: -1, message: '不支持的同步类型！' };
    if (!/^https?:\/\//i.test(String(receiveUrl || '')) || !uid || !String(uname || '')) return { code: -1, message: '接收接口或接收用户参数错误！' };
    const syncAll = all === true;
    const syncLimit = this.normalizeContentSyncLimit(limit, syncAll);
    if (syncLimit < 0) return { code: -1, message: '同步数量必须是 1 到 1000000 之间的整数！' };
    const databaseTotal = await config.itemModel.countDocuments({});
    const total = syncAll ? databaseTotal : Math.min(databaseTotal, syncLimit);
    if (!total) return { code: -1, message: `没有找到需要同步的${config.label}！` };
    const normalizedSourceServer = /^https?:\/\//i.test(String(sourceServer || ''))
      ? new URL(String(sourceServer).trim()).origin.toLowerCase() : `${this.ctx.protocol}://${this.ctx.host}`.toLowerCase();
    const callbackUrl = String(receiveUrl).trim().replace(/\/+$/, '');
    const taskKey = crypto.createHash('sha256').update(`${type}|${uid}|${normalizedSourceServer}|${callbackUrl}|${total}`).digest('hex');
    if (contentPushTasks.has(taskKey)) {
      return { code: 200, message: `相同的${config.label}推送任务正在后台执行！`, data: { taskId: taskKey, queued: true, total } };
    }
    contentPushTasks.add(taskKey);
    setImmediate(() => {
      this.pushContentBatches({ password, type, receiveUrl: callbackUrl, uid, uname: String(uname), sourceServer: normalizedSourceServer, taskKey, total })
        .catch(error => this.app.logger.error('[content-push] task=%s failed: %s', taskKey, error.stack || error.message))
        .finally(() => contentPushTasks.delete(taskKey));
    });
    const batchSize = config.batchSize || 1000;
    return { code: 200, message: `源服务器已启动${config.label}后台推送，共 ${total} 条，每批 ${batchSize} 条！`, data: { taskId: taskKey, queued: true, total, batchSize } };
  }
  async pushContentBatches({ password, type, receiveUrl, uid, uname, sourceServer, taskKey, total }) {
    const config = this.getContentSyncConfig(type);
    const categories = config.categoryModel ? await config.categoryModel.find({}).lean() : [];
    const platforms = config.platformModel ? await config.platformModel.find({}).lean() : [];
    let response = await axios.post(receiveUrl, {
      password, type, phase: 'relations', taskId: taskKey, uid, uname, sourceServer, categories, platforms,
    }, { timeout: 300000, maxContentLength: 100 * 1024 * 1024, maxBodyLength: 100 * 1024 * 1024 });
    if (!response.data || response.data.code !== 200) throw new Error(response.data && response.data.message ? response.data.message : '关联数据接收失败');
    let lastId = null;
    let pushed = 0;
    let batchIndex = 0;
    while (pushed < total) {
      const criteria = lastId ? { _id: { $lt: lastId } } : {};
      const batchLimit = Math.min(config.batchSize || 1000, total - pushed);
      const rows = await config.itemModel.find(criteria).sort({ _id: -1 }).limit(batchLimit).lean();
      if (!rows.length) break;
      batchIndex += 1;
      response = await axios.post(receiveUrl, {
        password, type, phase: 'items', taskId: taskKey, batchIndex, total, uid, uname, sourceServer, rows,
      }, { timeout: 300000, maxContentLength: 200 * 1024 * 1024, maxBodyLength: 200 * 1024 * 1024 });
      if (!response.data || response.data.code !== 200) throw new Error(response.data && response.data.message ? response.data.message : `第 ${batchIndex} 批接收失败`);
      pushed += rows.length;
      lastId = rows[rows.length - 1]._id;
      this.app.logger.info('[content-push] task=%s type=%s batch=%s sent=%s/%s', taskKey, type, batchIndex, pushed, total);
      if (rows.length < batchLimit) break;
    }
    response = await axios.post(receiveUrl, {
      password, type, phase: 'finalize', taskId: taskKey, uid, uname, sourceServer, categories,
    }, { timeout: 300000, maxContentLength: 100 * 1024 * 1024, maxBodyLength: 100 * 1024 * 1024 });
    if (!response.data || response.data.code !== 200) throw new Error(response.data && response.data.message ? response.data.message : '同步收尾失败');
    this.app.logger.info('[content-push] task=%s type=%s completed sent=%s/%s batches=%s', taskKey, type, pushed, total, batchIndex);
  }
  async tongbuContentReceive({ password, type, phase, rows = [], categories = [], platforms = [], uid, uname, sourceServer } = {}) {
    if (!this.getDomainSyncKey()) return { code: -1, message: '接收服务器未配置 DOMAIN_SYNC_KEY！' };
    if (!this.isDomainSyncPasswordValid(password)) return { code: -1, message: '同步密码错误！' };
    if (!uid || !String(uname || '') || !/^https?:\/\//i.test(String(sourceServer || ''))) return { code: -1, message: '接收用户或来源服务器参数错误！' };
    const config = this.getContentSyncConfig(type);
    if (!config || !config.itemModel) return { code: -1, message: '不支持的同步类型！' };
    const normalizedSourceServer = new URL(String(sourceServer).trim()).origin.toLowerCase();
    if (phase === 'relations') {
      return await this.executeContentSyncImport({ type, items: [], categories, platforms, uid, uname: String(uname), sourceServer: normalizedSourceServer });
    }
    if (phase === 'items') {
      if (!Array.isArray(rows) || !rows.length || rows.length > 1000) return { code: -1, message: '每批必须包含 1 至 1000 条数据！' };
      return await this.executeContentSyncImport({ type, items: rows, categories: [], platforms: [], uid, uname: String(uname), sourceServer: normalizedSourceServer });
    }
    if (phase === 'finalize') {
      await this.finalizeContentCategoryRelations({ type, categories, sourceServer: normalizedSourceServer });
      return { code: 200, message: `${config.label}关联关系整理完成！` };
    }
    return { code: -1, message: '同步阶段参数错误！' };
  }
  async executeContentSyncImport({ type, items, categories, platforms = [], uid, uname, sourceServer }) {
    if (type === 'wenzhang') return this.ctx.service.wenzhang.importRemote({ items, categories, sourceServer });
    const config = this.getContentSyncConfig(type);
    const categoryIdMap = new Map();
    const platformIdMap = new Map();
    if (config.platformModel && platforms.length) {
      const remotePlatformIds = platforms.map(item => String(item._id || '')).filter(Boolean);
      const existingPlatforms = await config.platformModel.find({
        'fromObj.server': sourceServer, 'fromObj.id': { $in: remotePlatformIds },
      }).select('_id fromObj').lean();
      const existingPlatformMap = new Map(existingPlatforms.map(item => [String(item.fromObj.id), item._id]));
      for (const remotePlatform of platforms) {
        const remoteId = String(remotePlatform._id || '');
        if (!remoteId) continue;
        const payload = { ...remotePlatform };
        delete payload._id;
        payload.fromObj = { id: remoteId, server: sourceServer };
        const existingId = existingPlatformMap.get(remoteId);
        const document = new config.platformModel(existingId ? { ...payload, _id: existingId } : payload);
        const replacement = document.toObject({ depopulate: true, versionKey: true });
        if (existingId) await config.platformModel.collection.replaceOne({ _id: existingId }, replacement);
        else await config.platformModel.collection.insertOne(replacement);
        platformIdMap.set(remoteId, replacement._id);
      }
    }
    if (config.categoryModel && categories.length) {
      const remoteIds = categories.map(item => String(item._id || '')).filter(Boolean);
      const existing = await config.categoryModel.find({
        'fromObj.server': sourceServer, 'fromObj.id': { $in: remoteIds },
      }).select('_id fromObj').lean();
      const existingMap = new Map(existing.map(item => [String(item.fromObj.id), item._id]));
      for (const remoteCategory of categories) {
        const remoteId = String(remoteCategory._id || '');
        if (!remoteId) continue;
        const payload = { ...remoteCategory };
        delete payload._id;
        payload.uid = uid;
        if (Object.prototype.hasOwnProperty.call(payload, 'uname')) payload.uname = uname;
        payload.fromObj = { id: remoteId, server: sourceServer };
        if (type === 'video' && payload.pid) payload.pid = platformIdMap.get(String(payload.pid)) || payload.pid;
        const existingId = existingMap.get(remoteId);
        const document = new config.categoryModel(existingId ? { ...payload, _id: existingId } : payload);
        const replacement = document.toObject({ depopulate: true, versionKey: true });
        if (existingId) await config.categoryModel.collection.replaceOne({ _id: existingId }, replacement);
        else await config.categoryModel.collection.insertOne(replacement);
        categoryIdMap.set(remoteId, replacement._id);
      }
    }
    if (config.categoryModel && items.length) {
      const relationIds = [];
      items.forEach(item => {
        const value = item && item[config.categoryField];
        (Array.isArray(value) ? value : [value]).filter(Boolean).forEach(id => relationIds.push(String(id)));
      });
      const savedCategoryMap = await this.getSyncRelationMap(config.categoryModel, sourceServer, relationIds);
      savedCategoryMap.forEach((value, key) => categoryIdMap.set(key, value));
    }
    if (config.platformModel && items.length) {
      const platformIds = items.map(item => item && item.pid ? String(item.pid) : '').filter(Boolean);
      const savedPlatformMap = await this.getSyncRelationMap(config.platformModel, sourceServer, platformIds);
      savedPlatformMap.forEach((value, key) => platformIdMap.set(key, value));
    }
    const remoteIds = items.map(item => String(item._id || '')).filter(Boolean);
    const existing = await config.itemModel.find({
      'fromObj.server': sourceServer, 'fromObj.id': { $in: remoteIds },
    }).select('_id fromObj').lean();
    const existingMap = new Map(existing.map(item => [String(item.fromObj.id), item._id]));
    const existingUniqueMap = new Map();
    if (config.uniqueField) {
      const uniqueValues = items.map(item => item && item[config.uniqueField]).filter(Boolean);
      if (uniqueValues.length) {
        const uniqueItems = await config.itemModel.find({ [config.uniqueField]: { $in: uniqueValues } }).select(`_id ${config.uniqueField}`).lean();
        uniqueItems.forEach(item => existingUniqueMap.set(String(item[config.uniqueField]), item._id));
      }
    }
    const itemIdMap = new Map();
    const articleCompanyIdMap = new Map();
    if (type === 'articleCbd') {
      const companyIds = Array.from(new Set(items.map(item => String(item.articleCompany || '')).filter(Boolean)));
      if (companyIds.length) {
        const ArticleCompanyModel = this.ctx.model.ArticleComapany || this.ctx.model.ArticleCompany || this.ctx.model.articleCompany;
        const companies = ArticleCompanyModel ? await ArticleCompanyModel.find({
          'fromObj.server': sourceServer, 'fromObj.id': { $in: companyIds },
        }).select('_id fromObj').lean() : [];
        companies.forEach(item => articleCompanyIdMap.set(String(item.fromObj.id), item._id));
      }
    }
    let created = 0;
    let updated = 0;
    let failed = 0;
    for (let start = 0; start < items.length; start += 500) {
      const operations = [];
      for (const remoteItem of items.slice(start, start + 500)) {
        try {
          const remoteId = String(remoteItem._id || '');
          if (!remoteId) { failed += 1; continue; }
          const payload = { ...remoteItem };
          delete payload._id;
          if (Object.prototype.hasOwnProperty.call(payload, 'uid')) payload.uid = uid;
          if (Object.prototype.hasOwnProperty.call(payload, 'uname')) payload.uname = uname;
          payload.fromObj = { id: remoteId, server: sourceServer };
          if (type === 'article' && payload.cid) payload.cid = categoryIdMap.get(String(payload.cid)) || payload.cid;
          if (type === 'articleCbd' && payload.articleCompany) {
            payload.articleCompany = articleCompanyIdMap.get(String(payload.articleCompany)) || payload.articleCompany;
          }
          if (type === 'app' && Array.isArray(payload.ncids)) payload.ncids = payload.ncids.map(id => categoryIdMap.get(String(id))).filter(Boolean);
          if (type === 'nav' && Array.isArray(payload.ncids)) payload.ncids = payload.ncids.map(id => categoryIdMap.get(String(id))).filter(Boolean);
          if (type === 'video') {
            if (payload.cid) payload.cid = categoryIdMap.get(String(payload.cid)) || payload.cid;
            if (payload.pid) payload.pid = platformIdMap.get(String(payload.pid)) || payload.pid;
          }
          const existingId = (config.uniqueField && existingUniqueMap.get(String(payload[config.uniqueField]))) || existingMap.get(remoteId);
          const document = new config.itemModel(existingId ? { ...payload, _id: existingId } : payload);
          const data = document.toObject({ depopulate: true, versionKey: true });
          itemIdMap.set(remoteId, data._id);
          if (existingId) {
            updated += 1;
            operations.push({ replaceOne: { filter: { _id: existingId }, replacement: data } });
          } else {
            created += 1;
            operations.push({ insertOne: { document: data } });
          }
        } catch (error) { failed += 1; }
      }
      if (operations.length) await config.itemModel.collection.bulkWrite(operations, { ordered: false });
    }
    if (config.categoryModel && categories.length) {
      const categoryOperations = categories.map(remoteCategory => {
        const localId = categoryIdMap.get(String(remoteCategory._id || ''));
        if (!localId) return null;
        const updates = {};
        if (Array.isArray(remoteCategory.childrens)) {
          updates.childrens = remoteCategory.childrens.map(id => categoryIdMap.get(String(id))).filter(Boolean);
        }
        if (Array.isArray(remoteCategory.details)) {
          updates.details = remoteCategory.details.map(id => itemIdMap.get(String(id)) || id);
        }
        return Object.keys(updates).length ? { updateOne: { filter: { _id: localId }, update: { $set: updates } } } : null;
      }).filter(Boolean);
      if (categoryOperations.length) await config.categoryModel.collection.bulkWrite(categoryOperations, { ordered: false });
    }
    return {
      code: 200,
      message: `${config.label}同步完成：新增 ${created} 条，覆盖 ${updated} 条，失败 ${failed} 条`,
      data: { created, updated, failed },
    };
  }
  async finalizeContentCategoryRelations({ type, categories, sourceServer }) {
    if (type === 'wenzhang') return;
    const config = this.getContentSyncConfig(type);
    if (!config || !config.categoryModel || !Array.isArray(categories) || !categories.length) return;
    const categoryIds = categories.map(item => String(item._id || '')).filter(Boolean);
    const detailIds = [];
    categories.forEach(item => {
      if (Array.isArray(item.details)) item.details.filter(Boolean).forEach(id => detailIds.push(String(id)));
    });
    const [categoryMap, itemMap] = await Promise.all([
      this.getSyncRelationMap(config.categoryModel, sourceServer, categoryIds),
      this.getSyncRelationMap(config.itemModel, sourceServer, detailIds),
    ]);
    const operations = categories.map(remoteCategory => {
      const localId = categoryMap.get(String(remoteCategory._id || ''));
      if (!localId) return null;
      const updates = {};
      if (Array.isArray(remoteCategory.childrens)) {
        updates.childrens = remoteCategory.childrens.map(id => categoryMap.get(String(id))).filter(Boolean);
      }
      if (Array.isArray(remoteCategory.details)) {
        updates.details = remoteCategory.details.map(id => itemMap.get(String(id)) || id);
      }
      return Object.keys(updates).length ? { updateOne: { filter: { _id: localId }, update: { $set: updates } } } : null;
    }).filter(Boolean);
    if (operations.length) await config.categoryModel.collection.bulkWrite(operations, { ordered: false });
  }
  async delDomainList({
    offset = 0,
    sid,
    link,
    links,
    sTime,
    limit = 20,
    eTime,
    siteType,
    isOpenModal,
    isOpenUrl,
    agentid,
    fcid
  }) {
    const criteria = {};
    // 把cont的数量存起来
    criteria.uname = this.ctx.service.utils.getTokenInfo('username');
    if (sid) criteria.sid = sid;
    if (link) criteria.link = eval('/' + link + '/i');
    if (siteType !== undefined) criteria.siteType = siteType
    if (isOpenModal !== undefined) criteria.isOpenModal = isOpenModal
    if (isOpenUrl !== undefined) criteria.isOpenUrl = isOpenUrl
    if (agentid) criteria.agentid = agentid
    if (fcid) criteria.fcid = fcid
    if (links && links.length > 1) criteria.link = { $in: links }
    if (sTime && eTime) {
      criteria.createdAt = {
        $gte: new Date(sTime),
        $lt: new Date(eTime),
      }
    }
    let count = await this.ctx.model.DelDomain.countDocuments(criteria, (err, c) => c);
    let rows = await this.ctx.model.DelDomain.find(criteria).sort({ "_id": -1 }).skip(offset).limit(limit).select(`headDom ispcpage isWordRandom fcid mcid favicon isOpenModal openUrlPage logo version link id sid tdkEncode status isHttps view fromNum isOpenUrl isFan uid uname description agentid keyWords title tname tid myOpenDomain isOpenAdv isOpenFriendLink beiAnNumber themeColor connect version logo favicon isStaticPage isRandomImage commonHtmlDom siteType createdAt updatedAt`).lean()
    const ResponseData = {
      code: 200,
      data: {
        data: rows,
        count,
        limit,
        offset,
      },
    };
    this.ctx.service.counters.set('Domain');
    return ResponseData;
  }
  async domainJSONListCerate(){
    let domainList = await this.ctx.model.Domain.find({status:1}).sort({ "_id": -1 }).limit(30).select(`link title titleText beiAnName themeColor`);
    // 生成文件到json 文件
    if(domainList&&domainList.length>0){
        let ARdomainList = encodeURIComponent(JSON.stringify(domainList));
        let ADdomainlist = JSON.stringify(domainList)
        let nowDatec = moment().format('YYYY-MM-DD HH:mm:ss')
        let strJsItem = `/*${nowDatec}*/var NOWDATE_C="${nowDatec}";var DOMAINLIST = "${ARdomainList}";window.mDomainListc = JSON.parse(decodeURIComponent(DOMAINLIST))`
        fs.writeFile(process.cwd() + '/app/public/json/seonav.json', ADdomainlist, null, function (err) { });
        fs.writeFile(process.cwd() + '/app/public/json/seonav.js', strJsItem, null, function (err) { });
        return {
          code:200,
          message:"JS数据更新成功"
      }
    }
  }
  async domainList({
    offset = 0,
    sid,
    link,
    links,
    sTime,
    limit = 20,
    eTime,
    status,
    siteType,
    isOpenModal,
    isOpenUrl,
    title,
    tname,
    agentid,
    isFan,
    fcid,
    mcid,
    typeList,
    isSo,
    browserType,
    pageType,
    pageTypeId,
    beiAnName,
  }) {
    const criteria = {};
    let uname = this.ctx.service.utils.getTokenInfo('username');
    // 把cont的数量存起来
    criteria.uname = uname
    if (sid) criteria.sid = sid;
    if (link) criteria.link = eval('/' + link + '/i');
    if (title) criteria.title = eval('/' + title + '/i');
    if (typeList) criteria.typeList = { $in: typeList }
    if (isFan >= 0) criteria.isFan = isFan;
    if (status >= 0) criteria.status = status;
    if (browserType) criteria.browserType = browserType;
    if (tname) criteria.tname = tname;
    if (beiAnName) criteria.beiAnName = beiAnName;
    if (siteType !== undefined) criteria.siteType = siteType
    if (isOpenModal !== undefined) criteria.isOpenModal = isOpenModal
    if (isOpenUrl !== undefined) criteria.isOpenUrl = isOpenUrl
    if (isSo !== undefined) criteria.isSo = isSo
    if (agentid) criteria.agentid = agentid
    if (fcid) criteria.fcid = fcid
    if (mcid) criteria.mcid = mcid
    if (links && links.length > 0) criteria.link = { $in: links }
    if (sTime && eTime) {
      criteria.createdAt = {
        $gte: new Date(sTime),
        $lt: new Date(eTime),
      }
    }
    let count = await this.ctx.model.Domain.countDocuments(criteria, (err, c) => c);
    // let notDomainCount = this.ctx.model.Domain.find({status:{$nin: [1,0]}}).select(`link title typeList`).lean();
    let notDomainCount = await this.ctx.model.Domain.countDocuments({uname,status:{$nin: [1,0]}}, (err, c) => c);
    let skipId = -1
    if (pageType && pageTypeId) {
      if (pageType == 'next') {
        criteria['_id'] = { "$lt": pageTypeId }
      } else if (pageType == 'prve') {
        criteria['_id'] = { "$gt": pageTypeId }
        skipId = 1
      } else if (pageType == 'firstPage') {
        skipId = -1
      } else if (pageType == 'lastPage') {
        skipId = 1
      }
    }

    let rows = await this.ctx.model.Domain.find(criteria)
      .populate({ path: 'cids', select: 'name id' })
      .populate({ path: 'navcids', select: 'name id' })
      .populate({ path:'articleCompany',select:'name id tdkNums fileName'})
      .sort({ "_id": skipId })
      .skip(offset)
      .limit(limit)
      .select(`isArticleCompany openUrlStatusCode pushSiteDay titleType pushSiteType pushSiteStatus pushSiteNum pushSiteTokenName pushSiteToken imgTypeName isJingXiang jingXiangUrl beiAnName headDom isSo navsDom ispcpage  titleText titleText2 iscache isOutFriendLink modalDom browserType friendLinkDom isWordRandom typeList isMuLu fcid mcid favicon isOpenModal openUrlPage logo version link id sid tdkEncode status cids isHttps view fromNum isOpenUrl isFan uid uname description agentid keyWords title tname tid myOpenDomain isOpenAdv advDom isOpenFriendLink beiAnNumber themeColor connect version logo favicon isStaticPage isRandomImage anip commonHtmlDom siteType createdAt updatedAt`).lean()
    if (pageType == 'prve' || pageType == 'lastPage') {
      rows = rows.reverse()
    }
    let rowsc = this.ctx.service.utils.jiamiFn(rows);
    const ResponseData = {
      code: 200,
      data: {
        data: rowsc,
        count,
        limit,
        offset,
        notDomainCount
      },
    };
    return ResponseData;
  }
  // 更新域名总数
  async domainCounterSet() {
    const countName = 'Domain';
    this.ctx.model.Domain.countDocuments({}, async (err, c) => {
      let domain = await this.ctx.model.Counters.findOne({ id: countName })
      if (!domain) {
        this.ctx.model.Counters.create({
          id: countName,
          seq: c
        })
      } else {
        // 查询到的总数和当前的不一致更新总数
        await this.ctx.model.Counters.findOneAndUpdate({
          id: countName,
        }, { $set: { seq: c } });
      }
    });
  }
  //更新 一个domain 缓存json
  async refushDomainLinksc(){
    let dPageFilePath = this.ctx.app.config.cacheFile + 'domains/'
    let isHaveDeFile = fs.existsSync(dPageFilePath)
    // let isHaveDJson = fs.existsSync(dPageFilePath + '/index.json')
    if(!isHaveDeFile){
      fs.mkdirSync(this.ctx.app.config.cacheFile + 'domains/');
    }
    let rows = await this.ctx.model.Domain.find()
      .sort({ "_id": -1 }).limit(500)
      .select(`link`)
    if(rows&&rows.length>0){
      fs.writeFile(dPageFilePath+'alldomain.json', JSON.stringify(rows), null, function (err) {});
    }
    return rows
  }
  //域名添加
  async createDomain(o) {
    // 先检查域名链接是否存在
    let link = o.link.toLowerCase()
    if (link.indexOf('.') == -1) return { code: -2, message: '域名错误!' }
    let is_domain = await this.ctx.model.Domain.findOne({ link })
    if (is_domain) return { code: -2, message: '该域名已被创建！' }
    let uid = this.ctx.service.utils.getTokenInfo('id')
    let uname = this.ctx.service.utils.getTokenInfo('username')
    this.ctx.service.counters.set('Domain');
    await this.ctx.model.Domain.create({
      sid: o.sid,
      link,
      status: o.status,
      isHttps: false,
      view: 0,
      fromNum: 0,
      isOpenUrl: o.isOpenUrl,
      // openUrlPc: o.openUrlPc,
      // openUrlH5: o.openUrlH5,
      // openUrlAPP: o.openUrlAPP,
      isFan: o.isFan,
      typeList: o.typeList,
      uname,
      uid,
      titleType: o.titleType,
      description: o.description,
      keyWords: o.keyWords,
      title: o.title,
      tname: o.tname,
      imgTypeName:o.imgTypeName,
      tid: 2,
      ispcpage: o.ispcpage,
      cids: o.cids,
      tdkEncode: o.tdkEncode,
      isOpenAdv: 0,
      isOpenFriendLink: 1,
      beiAnNumber: o.beiAnNumber,
      isOpenModal: o.isOpenModal,
      themeColor: '#' + (Math.random() * 0xffffff << 0).toString(16),
      connect: '',
      version: '1.0.0',
      siteType: o.siteType || 4,
      agentid: o.agentid,
      openUrlPage: o.openUrlPage,
      headDom: o.headDom,
      browserType: o.browserType,
      advDom: '',
    }).then(() => {
      return {
        message: "创建成功！",
        code: 200,
      };
    })
    this.ctx.service.counters.set('Domain');
    await this.updateAllDomainList();

  }
async findDomain(host) {
  const { ctx } = this;

  if (!host || typeof host !== 'string') {
    return {
      code: -1,
      message: '域名不能为空！',
      host: host || '',
    };
  }

  // Redis 域名缓存沿用旧方式：缓存键中不包含请求端口。
  // host = host.toLowerCase().replace(/:\d+$/, '');

  // console.log(host)
  const redisKey = `AA-${host}`;

  // 1. 优先读取 Redis
  try {
    // console.log(8888,redisKey)
    const redisDomain = await ctx.service.cache.get(redisKey);
    // console.log(3333,redisDomain)
    if (redisDomain) {
      return redisDomain;
    }
  } catch (err) {
    ctx.logger.warn(
      `[findDomain] Redis 读取失败，继续读取文件，host=${host}`,
      err
    );
  }

  let domain;

  try {
    domain = await ctx.model.Domain.findOne({
      link: host,
    })
      .populate({
        path: 'cids',
        select: 'id name num description themeColor',
      })
      .populate({
        path: 'fcid',
        select: 'name num',
      })
      .populate({
        path: 'mcid',
        select: 'name num',
      })
      .populate({
        path: 'articleCompany',
        select: 'name id tdkNums fileName',
      })
      .lean();
  } catch (err) {
    ctx.logger.error(
      `[findDomain] MongoDB 查询失败，host=${host}`,
      err
    );

    return {
      code: -1,
      message: '查询域名数据失败！',
      host,
    };
  }

  if (!domain) {
    return {
      code: -1,
      message: '站点域名数据找不到！',
      host,
    };
  }

  // 4. 查询站群友情链接
  if (domain.isOutFriendLink) {
    const friendLinkFields =
      'link title keyWords beiAnName';

    const [previousLinks, nextLinks] =
      await Promise.all([
        ctx.model.Domain.find({
          _id: { $lt: domain._id },
          isOutFriendLink: true,
          uid: domain.uid,
        })
          .sort({ _id: -1 })
          .limit(3)
          .select(friendLinkFields)
          .lean(),

        ctx.model.Domain.find({
          _id: { $gt: domain._id },
          isOutFriendLink: true,
          uid: domain.uid,
        })
          .sort({ _id: 1 })
          .limit(3)
          .select(friendLinkFields)
          .lean(),
      ]);

    domain.outFriendLinks = [
      ...previousLinks,
      ...nextLinks,
    ];
  } else {
    domain.outFriendLinks = [];
  }

  const result = {
    code: 200,
    data: {
      domain,
      site: {},
    },
  };

  // 缓存只保存 MongoDB 查询并 populate 后的原始域名数据。
  // getSiteInfo 会继续修改返回的 result，因此缓存必须使用独立快照，
  // 避免 fullDomain、agentLink、动态标题等请求数据写入缓存。
  const cacheResult = JSON.parse(JSON.stringify(result));

  // MongoDB 查询成功后写入 Redis
  await ctx.service.cache
    .set(redisKey, cacheResult)
    .catch(err => {
      ctx.logger.warn(
        `[findDomain] Redis 写入失败，host=${host}`,
        err
      );
    });

  return result;
}
  async refreshDomain(link) {
    // let domain = await this.ctx.model.Domain.findOne({ link }).populate({ path: 'cids', select: 'id name num description themeColor' })
    // .populate({ path: 'fcid', select: 'name num' });
    let redisDomainName = 'AA-' + link;
    // let site = {};
    // if(domain.isOutFriendLink){
    //   let [linka_a, linka_b] = await Promise.all([
    //     await this.ctx.model.Domain.find({ _id: { "$lt": domain._id }, isOutFriendLink: true, uid: domain['uid'] }).limit(2).select('link title'),
    //     await this.ctx.model.Domain.find({ _id: { "$gt": domain._id }, isOutFriendLink: true, uid: domain['uid'] }).limit(2).select('link title')
    //   ])
    //   domain['outFriendLinks'] = [...linka_a, ...linka_b]
    // }
    // let returnRes = {
    //   code: 200,
    //   data: {
    //     domain,
    //     site
    //   },
    // };
    // console.log(returnRes.data.domain.outFriendLinks)

    try {
      await this.ctx.service.cache.del(redisDomainName)
    } catch (err) {
      this.ctx.logger.warn(`[refreshDomain] Redis 缓存删除失败，link=${link}`, err)
    }
    

    let domainFileName = link.replace(':', '##')
    let homePageFilePath = this.ctx.app.config.cacheFile + 'home/' + domainFileName
    let isHaveHomeFile = fs.existsSync(homePageFilePath)

    if (isHaveHomeFile) {
      this.ctx.service.utils.delDir(homePageFilePath)
    }
  }

  async updateDomain(id, updates) {
    let message = { code: -2, message: '修改失败!' }
    let uname = this.ctx.service.utils.getTokenInfo('username')
    let uid = this.ctx.service.utils.getTokenInfo('id')
    const criteria = {
      _id: id,
      uname,
      uid
    }
    const oldDomain = await this.ctx.model.Domain.findOne(criteria).select('link').lean()
    let domain = await this.ctx.model.Domain.findOneAndUpdate(criteria, { $set: updates }, { new: true })
    .populate({ path: 'cids', select: 'id name num description themeColor' })
    .populate({ path: 'fcid', select: 'name num' })
    .populate({ path: 'mcid', select: 'name num' });
    if (!domain) return message
    if (!oldDomain || oldDomain.link !== domain.link) await this.updateAllDomainList();
    const linksToRefresh = new Set([oldDomain && oldDomain.link, domain.link].filter(Boolean))
    for (const link of linksToRefresh) {
      await this.ctx.service.domain.refreshDomain(link)
    }
    let domainjm = this.ctx.service.utils.jiamiFn(domain)
    return { code: 200, data: domainjm, message: "修改成功！" };
  }
  async updateDomainIP({ domains }) {
    let uname = this.ctx.service.utils.getTokenInfo('username')
    let uid = this.ctx.service.utils.getTokenInfo('id')
    if (domains && domains.length > 0) {
      for (let item of domains) {
        await this.ctx.model.Domain.findOneAndUpdate({
          link: item.link,
          uname,
          uid
        }, { $set: { anip: item.anip } }, { new: true })
        await this.ctx.service.domain.refreshDomain(item.link);
      }
    }
    return { code: 200, message: "修改成功！" };
  }
  async updateFuBiaoTi(){
    //修改全部副标题
    let domains = await this.ctx.model.Domain.find().select('titleText')
    let cityList = ['北京','天津','山东','河北','山西','内蒙古','辽宁','黑龙江','吉林','上海市','江苏','浙江','福建','河南','湖北','安徽','湖南','江西','广东','广西','海南','重庆市','四川','云南','贵州','陕西','甘肃','新疆','宁夏','青海','西藏','海外','南岸','万州','沙坪坝','常熟市','昆山市','凉山','甘孜','雅安','眉山','阿坝','青岛','威海','烟台','聊城','济宁','莱芜','泰安','塘沽','天津','济南','海淀','东城','西城','通州','崇文','朝阳','宣武','长寿','石景山','丰台','朔州','大同','太原','晋城','长治','阳泉','沧州','保定','廊坊','唐山','邯郸','邢台','衡水','承德','张家口','石家庄','枣庄','秦皇岛','淄博','德州','临沂','菏泽','滨州','东营','潍坊','日照','沈阳','阜新','朝阳','阿拉善','锡林郭勒','鄂尔多斯','乌兰察布','巴彦淖尔','通辽','赤峰','乌海','包头','兴安盟','呼伦贝尔','运城','临汾','晋中','忻州','呼和浩特','吕梁','双鸭山','伊春','牡丹江','大兴安岭','黑河','齐齐哈尔','哈尔滨','佳木斯','鹤岗','大庆','葫芦岛','锦州','盘锦','营口','鞍山','辽阳','本溪','铁岭','抚顺','大连','丹东','长宁','静安','普陀','徐汇','卢湾','黄浦','闵行','浦东','杨浦','闸北','宝山','虹口','四平','吉林','松原','白城','白山','通化','辽源','绥化','七台河','鸡西','延边','长春','台州','温州','丽水','衢州','舟山','嘉兴','湖州','宁波','杭州','绍兴','金华','淮安','苏州','无锡','常州','扬州','宿迁','连云港','徐州','南京','南通','镇江','盐城','泰州','开封','漯河','许昌','商丘','安阳','鹤壁','新乡','洛阳','焦作','濮阳','宁德','龙岩','三明','三门峡','郑州','厦门','南平','莆田','福州','漳州','泉州','神农架','仙桃','天门','潜江','随州','宜昌','荆州','咸宁','恩施','黄冈','鄂州','孝感','荆门','襄樊','武汉','十堰','黄石','周口','信阳','南阳','平顶山','济源','驻马店','张家界','长沙','岳阳','益阳','常德','淮南','宣城','宿州','铜陵','阜阳','滁州','池州','巢湖','马鞍山','六安','淮北','安庆','黄山','芜湖','合肥','亳州','蚌埠','清远','广州','新余','河源','韶关','萍乡','宜春','鹰潭','上饶','抚州','吉安','赣州','南昌','娄底','湘西','景德镇','九江','郴州','衡阳','湘潭','株洲','怀化','邵阳','永州','梧州','北海','钦州','防城港','河池','柳州','南宁','湛江','茂名','玉林','百色','桂林','佛山','江门','中山','珠海','阳江','云浮','肇庆','汕尾','揭阳','汕头','梅州','潮州','深圳','惠州','东莞','宜宾','泸州','巴中','攀枝花','遂宁','广安','南充','德阳','自贡','乐山','内江','重庆','绵阳','广元','成都','贵港','崇左','贺州','来宾','海口','三亚','达州','资阳','渝北','北碚','九龙坡','江北','大渡口','渝中','昆明','曲靖','玉溪','丽江','普洱','临沧','德宏','怒江','迪庆','楚雄','昭通','大理','红河','保山','文山','西双版纳','贵阳','六盘水','遵义','安顺','毕节','黔东南','黔南','黔西南','铜仁','西安','咸阳','渭南','延安','宝鸡','汉中','铜川','榆林','商洛','安康','兰州','酒泉','嘉峪关','张掖','天水','白银','定西','甘南','金昌','临夏','陇南','平凉','庆阳','武威','乌鲁木齐','昌吉','克拉玛依','吐鲁番','哈密','石河子','伊犁','巴音郭楞','和田','阿勒泰','塔城','阿克苏','博尔塔拉','克孜勒苏','喀什','图木舒克','阿拉尔','五家渠','银川','石嘴山','固原','中卫','吴忠','西宁','果洛','海北','海东','海南','海西','黄南','玉树','拉萨','阿里','昌都','林芝','日喀则','山南','那曲','香港','澳门','台湾','海外','门头沟','房山','顺义','昌平','大兴','怀柔','和平','河东','河西','南开','河北','红桥','塘沽','大港','东丽','西青','津南','北辰','武清','宝坻','宁河','嘉定','松江','奉贤','金山']
    const randomOneW = function (arr) {
      return arr[Math.round(Math.random() * (arr.length - 1)) + 0];
    }
    for (let item of domains) {
      let titleName = randomOneW(cityList)+'影院'
      await this.ctx.model.Domain.updateOne({ "_id": item._id }, { "$set": {titleText:titleName} }).then(() => { }).catch(() => { });
    }
  }
  async updateBeiAnName(){
    let domains = await this.ctx.model.Domain.find().select('titleText')
    for (let item of domains) {
      let titleName = cityCompanyName()
      // console.log(titleName)
      await this.ctx.model.Domain.updateOne({ "_id": item._id }, { "$set": {beiAnName:titleName} }).then(() => { }).catch(() => { });
    }
  }
  async delDomain(id) {
    // 检测删除权限
    let uname = this.ctx.service.utils.getTokenInfo('username')
    let uid = this.ctx.service.utils.getTokenInfo('id')
    let domain = await this.ctx.model.Domain.findByIdAndDelete({
      _id: id,
      uid,
      uname
    });
    if (uid == domain.uid && uname == domain.uname) {
      let cdomain = {}
      for (let key in domain) {
        if (key !== '_id') {
          cdomain[key] = domain[key]
        }
      }
      this.ctx.model.DelDomain.create(cdomain)
      this.ctx.service.counters.set('Domain');
      await this.updateAllDomainList();
      return { code: 200, message: domain.link + '-' + domain.title + "-删除成功！" };
    } else {
      return { code: -2, message: "无删除权限！" };
    }
  }
  async mutUpdateDomain({
    links,
    updates,
    isAll
  }) {
    let uname = this.ctx.service.utils.getTokenInfo('username');
    let uid = this.ctx.service.utils.getTokenInfo('id');
    let options = {
      uname,
      uid,
    }
    if (!isAll) {
      options.link = { $in: links }
    }
    await this.ctx.model.Domain.updateMany(options, {
      $set: updates
    })
    if (Object.prototype.hasOwnProperty.call(updates, 'link')) await this.updateAllDomainList();

    for (let item of links) {
      await this.ctx.service.domain.refreshDomain(item);
    }
    return {
      code: 200,
      message: '修改成功!'
    }
  }

  async mutUpdateReplaceDomain({
    links,
    updates,
    type,
    isAll
  }) {
    let uname = this.ctx.service.utils.getTokenInfo('username');
    let uid = this.ctx.service.utils.getTokenInfo('id');
    let options = {
      uname,
      uid
    }
    if (!isAll) {
      options.link = {
        $in: links
      }
    }
    let domains = await this.ctx.model.Domain.find(options).select('title link keyWords logo beiAnNumber description')
    let domainLinksChanged = false;
    // 如果是替换  updates = [{key，bval，aval}]
    // upObj.key  字段名称
    // upObj.bval 修改前
    // upObj.aval 修改后
    if (type === 'replace') {
      for (let item of domains) {
        for (let upObj of updates) {
          let opcitem = {}
          let bzz = eval('/' + upObj.bval + '/g')
          if (upObj.key && upObj.bval) {
            opcitem[upObj.key] = item[upObj.key].replace(bzz, upObj.aval);
            await this.ctx.model.Domain.update({ "_id": item._id }, { "$set": opcitem }).then(() => {
              if (upObj.key === 'link') domainLinksChanged = true;
            }).catch(() => { });
          }
        }
      }
    } else {
      // 如果是批量修改 updates = [{link,update:{title,keyWords,description}}]
      for (let item of domains) {
        let opt = updates.find(itemcsc => itemcsc.link == item.link)
        await this.ctx.model.Domain.update({ "_id": item._id }, { "$set": opt.update }).then(() => {
          if (Object.prototype.hasOwnProperty.call(opt.update, 'link')) domainLinksChanged = true;
        }).catch(() => { });;
      }
    }
    if (domainLinksChanged) await this.updateAllDomainList();
    for (let item of domains) {
      await this.ctx.service.domain.refreshDomain(item.link);
    }
  }

  async mutDelDomain(dataList) {
    let result = {
      success: [],
      filed: []
    }
    let uname = this.ctx.service.utils.getTokenInfo('username');
    let uid = this.ctx.service.utils.getTokenInfo('id');
    let domain = {}
    for (let item of dataList) {
      domain = await this.ctx.model.Domain.findOneAndDelete({
        link: item,
        uid,
        uname
      }).then((res) => {
        if (res) {
          result.success.push(item)
          delete domain._id
          this.ctx.model.DelDomain.create(domain)
        } else {
          result.filed.push({
            link: item,
            message: '域名不存在！'
          })
        }
      }).catch(() => {
        result.filed.push({
          link: item,
          message: '无删除权限！'
        })
      });
    }
    let cdomain = {}
    for (let key in domain) {
      if (key !== '_id') {
        cdomain[key] = domain[key]
      }
    }
    this.ctx.service.counters.set('Domain');
    if (result.success.length) await this.updateAllDomainList();
    return { code: 200, data: result };
  }
  async domainCategoryList({ domainId, categoryId, type, typeId, offset = 0, limit = 30 }) {
    let criteria = {}
    // let countCriteria = {}
    if (domainId) criteria.did = domainId
    if (categoryId) criteria.cid = categoryId
    // if (status !== null && status !== undefined) {
    //   criteria.status = status
    //   countCriteria.status = status
    // }

    // let uid = this.ctx.service.utils.getTokenInfo('id')
    let skip = 0
    let skipId = -1
    if (type && typeId) {
      if (type == 'next') {
        criteria['_id'] = { "$lt": typeId }
      } else {
        criteria['_id'] = { "$gt": typeId }
        // skip = limit
        skipId = 1
      }
    }
    // criteria.uid = uid
    let count = 0;//await this.ctx.model.Ndcid.countDocuments(countCriteria, (err, c) => c);
    let rows = await this.ctx.model.Ndcid.find(criteria).populate({ path: 'did', select: 'link title' }).populate({ path: 'cid', select: 'name' }).populate({ path: 'pcid', select: 'name' }).limit(limit).sort({ "_id": skipId }).skip(skip).lean()
    if (type == 'prve') {
      rows = rows.reverse()
    }
    const ResponseData = {
      code: 200,
      data: {
        data: rows,
        count,
        limit,
        offset,
      },
    };
    return ResponseData;
  }
  async deleteDomainCategory(id) {
    await this.ctx.model.Ndcid.findByIdAndDelete({
      _id: id,
    });
    return {
      message: '删除成功！',
      code: 200,
    }
  }
  async addDomainCategory(itemList) {
    //{ did,cid,pcid}
    // console.log(itemList)
    for (let item of itemList) {
      let isHave = await this.ctx.model.Ndcid.findOne({
        did: item.did,
        cid: item.cid,
        pcid: item.pcid || null
      })
      if (!isHave) {
        await this.ctx.model.Ndcid.create(item)
      }
    }
    return {
      message: '创建成功！',
      code: 200
    }
  }
}

module.exports = Domain;

