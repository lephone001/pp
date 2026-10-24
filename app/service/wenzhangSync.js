'use strict';

const Service = require('egg').Service;

const MAX_LIMIT = 1000000;
const SYNC_TYPES = {
  wenzhang: { settingsFile: 'wenzhang_sync', label: '采集文章和分类' },
  articleCbd: { settingsFile: 'article_cbd_sync', label: 'CBD文章' },
  video: { settingsFile: 'video_sync', label: '视频、分类和平台' },
  app: { settingsFile: 'app_sync', label: 'APP文章和分类' },
  article: { settingsFile: 'article_sync', label: '旧文章和分类' },
};

function cleanUrl(value) {
  const text = String(value || '').trim().replace(/\/+$/, '');
  if (!text) return '';
  try {
    const parsed = new URL(text);
    return [ 'http:', 'https:' ].includes(parsed.protocol) ? text : '';
  } catch (error) {
    return '';
  }
}

class WenzhangSyncService extends Service {
  typeConfig(type) {
    const config = SYNC_TYPES[String(type || 'wenzhang')];
    if (!config) throw new Error('不支持的定时同步类型');
    return config;
  }

  defaults() {
    return {
      enabled: false,
      serverUrl: '',
      receiveUrl: '',
      password: '',
      limit: 1000,
      lastRunAt: '',
      lastResult: '',
      lastSuccess: null,
      updatedAt: '',
    };
  }

  normalize(value = {}) {
    const limit = Number(value.limit);
    return {
      enabled: value.enabled === true,
      serverUrl: cleanUrl(value.serverUrl),
      receiveUrl: cleanUrl(value.receiveUrl),
      password: String(value.password || '').slice(0, 500),
      limit: Number.isInteger(limit) && limit >= 1 && limit <= MAX_LIMIT ? limit : 1000,
      lastRunAt: String(value.lastRunAt || ''),
      lastResult: String(value.lastResult || '').slice(0, 1000),
      lastSuccess: typeof value.lastSuccess === 'boolean' ? value.lastSuccess : null,
      updatedAt: String(value.updatedAt || ''),
    };
  }

  async settings(type = 'wenzhang') {
    const config = this.typeConfig(type);
    const stored = await this.ctx.service.localData.readJson(config.settingsFile, this.defaults());
    return this.normalize(stored);
  }

  publicValue(settings) {
    const result = { ...settings, passwordConfigured: Boolean(settings.password) };
    delete result.password;
    return result;
  }

  async publicSettings(type = 'wenzhang') {
    return this.publicValue(await this.settings(type));
  }

  validateEnabled(settings) {
    if (!settings.enabled) return;
    if (!settings.serverUrl) throw new Error('请填写有效的远程源服务器地址');
    if (!settings.receiveUrl) throw new Error('请填写有效的当前服务器接收地址');
    if (!settings.password) throw new Error('请填写同步密码');
  }

  async save(type = 'wenzhang', input = {}) {
    const config = this.typeConfig(type);
    const current = await this.settings(type);
    const next = this.normalize({
      ...current,
      enabled: input.enabled === true,
      serverUrl: input.serverUrl,
      receiveUrl: input.receiveUrl,
      password: String(input.password || '') ? input.password : current.password,
      limit: input.limit,
      updatedAt: new Date().toISOString(),
    });
    this.validateEnabled(next);
    await this.ctx.service.localData.writeJson(config.settingsFile, next);
    return this.publicValue(next);
  }

  async saveRunResult(type, success, message) {
    const config = this.typeConfig(type);
    const current = await this.settings(type);
    const next = this.normalize({
      ...current,
      lastRunAt: new Date().toISOString(),
      lastResult: message,
      lastSuccess: success === true,
    });
    await this.ctx.service.localData.writeJson(config.settingsFile, next);
    return next;
  }

  async run(type = 'wenzhang') {
    const settings = await this.settings(type);
    if (!settings.enabled) return { skipped: true, message: '定时同步已关闭' };
    try {
      this.validateEnabled(settings);
      const result = await this.ctx.service.domain.tongbuScheduledContentSync({ ...settings, type, all: false });
      if (!result || result.code !== 200) {
        throw new Error(result && result.message ? result.message : '定时同步任务提交失败');
      }
      await this.saveRunResult(type, true, result.message);
      return result;
    } catch (error) {
      await this.saveRunResult(type, false, String(error.message || error));
      throw error;
    }
  }
}

module.exports = WenzhangSyncService;
