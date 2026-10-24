'use strict';

const fs = require('fs');
const path = require('path');
const { getDomainHostList, reloadDomainHostList } = require('./app/lib/domainHostCache');

class AppBootHook {
  constructor(app) {
    this.app = app;
    // 未注册的 POST 要先进入兜底，避免 multipart 在路由匹配前解析恶意文件。
    const parserIndex = app.config.coreMiddleware.findIndex(name => name === 'bodyParser' || name === 'multipart');
    app.config.coreMiddleware.splice(parserIndex === -1 ? app.config.coreMiddleware.length : parserIndex, 0, 'postRouteGuard');
    const statsControl = require('./app/lib/statsControl');
    statsControl.reload(app);
    app.messenger.on('stats-control-updated', () => statsControl.reload(app));
    app.messenger.on('all-domain-list-updated', async data => {
      if (data && Number(data.sourcePid) === process.pid) return;
      await reloadDomainHostList(app.baseDir || process.cwd(), app.logger);
    });
    app.messenger.on('site-server-info-updated', async () => {
      try {
        const ctx = app.createAnonymousContext();
        await ctx.service.localData.loadRuntimeState();
      } catch (error) {
        app.logger.error('[local-data] reload after save failed: ' + String(error && error.stack || error));
      }
    });
    app.messenger.on('fanmulu-article-data-updated', async data => {
      if (data && Number(data.sourcePid) === process.pid) return;
      try {
        const ctx = app.createAnonymousContext();
        ctx.service.fanmuluArticle.invalidateMemory();
        await ctx.service.fanmuluArticle.preloadRuntimeData(true);
      } catch (error) {
        app.logger.error('[fanmulu-article] reload after update failed: ' + String(error && error.stack || error));
      }
    });
  }

  async willReady() {
    const baseDir = this.app.baseDir || process.cwd();
    const domainListFile = path.join(baseDir, 'app', 'local_data', 'allDomainList.txt');
    if (this.app.config.env === 'prod' && !fs.existsSync(domainListFile)) {
      const ctx = this.app.createAnonymousContext();
      await ctx.service.domain.updateAllDomainList();
    }
    await getDomainHostList(baseDir, this.app.logger);
  }

  async didReady() {
    try {
      const ctx = this.app.createAnonymousContext();
      await ctx.service.localData.initialize();
    } catch (error) {
      this.app.logger.error('[local-data] initialize failed: ' + String(error && error.stack || error));
    }
    try {
      const ctx = this.app.createAnonymousContext();
      await ctx.service.fanmuluArticle.preloadRuntimeData(true);
    } catch (error) {
      this.app.logger.error('[fanmulu-article] preload failed: ' + String(error && error.stack || error));
    }
  }
}

module.exports = AppBootHook;
