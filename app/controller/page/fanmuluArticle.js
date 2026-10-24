'use strict';

const Controller = require('egg').Controller;

class FanmuluArticleController extends Controller {
  async article() {
    const { ctx } = this;
    try {
      const page = await ctx.service.fanmuluArticle.buildPage(ctx);
      if (!page) {
        ctx.status = 503;
        ctx.type = 'text/plain; charset=utf-8';
        ctx.body = '静态文章页面暂未启用';
        return;
      }
      let domain = ctx.state && ctx.state.articlePageDomain;
      if (!domain) {
        const info = await ctx.service.utils.getSiteInfo();
        domain = info && info.domain || {};
      }
      page.data.footerDomain = domain;
      if (page.template === 'movie/new_moviex.html') {
        page.data.domain = domain;
      }
      ctx.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      ctx.type = 'text/html; charset=utf-8';
      await ctx.render(page.template, page.data);
    } catch (error) {
      ctx.logger.error('[fanmulu-article] render failed: %s', error && error.stack || error);
      ctx.status = 500;
      ctx.type = 'text/plain; charset=utf-8';
      ctx.body = '本地文章页面生成失败';
    }
  }
}

module.exports = FanmuluArticleController;

