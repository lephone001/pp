'use strict';

const { shouldHandleAsSelectedRoute } = require('./requestPolicy');

module.exports = app => {
  app.logger.info('[route-loader] fanmulu route file selected');

  const { router, controller } = app;

  // 这些页面依赖各自的控制器准备数据，必须放在全局泛目录兜底路由之前。
  // 控制器会根据 domain.tname 加载对应模板目录；当模板名称为
  // fanmulu_article4 时，将分别渲染该目录下的页面文件。
  router.get('selected-fanmulu-gogogo', '/gogogo', controller.page.link.gogogo);
  router.get('selected-fanmulu-gogogo-id', '/gogogo/:id', controller.page.link.gogogo);

  // 工厂目录生成文件，继续由原控制器返回 detail.html。
  router.get('selected-fanmulu-article-vn', '/v-n/*', controller.page.articleComapmy.articlevn);

  router.get('selected-fanmulu-article-cbd-list', '/v-nl/list.html', controller.page.articleCbd.articleList);
  router.get('selected-fanmulu-article-cbd-detail-index', '/v-nd/:id/index.html', controller.page.articleCbd.articleDetail);
  router.get('selected-fanmulu-article-cbd-detail', '/v-nd/:id', controller.page.articleCbd.articleDetail);
  router.get('selected-fanmulu-article-cbd-detail-rest', '/v-nd/:id:*', controller.page.articleCbd.articleDetail);

  router.get('selected-fanmulu-x-app', '/x-app/*', controller.page.appDownload.appDownloadDetail);

  // 必须在 app/router.js 原有路由之前注册，所选模式才会接管全部前台 HTML 链接。
  router.get('selected-fanmulu-route', '/*', async (ctx, next) => {
    if (!shouldHandleAsSelectedRoute(ctx)) {
      await next();
      return;
    }

    try {
      const page = await ctx.service.fanmuluArticle.buildPage(ctx, {
        globalRoute: true,
      });
      if (!page) {
        ctx.status = 503;
        ctx.type = 'text/plain; charset=utf-8';
        ctx.body = '静态文章页面暂未启用';
        return;
      }

      ctx.status = 200;
      ctx.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      ctx.type = 'text/html; charset=utf-8';
      await ctx.render(page.template, page.data);
    } catch (error) {
      ctx.logger.error('[fanmulu-route] render failed: %s', error && error.stack || error);
      ctx.status = 500;
      ctx.type = 'text/plain; charset=utf-8';
      ctx.body = '本地文章页面生成失败';
    }
  });
};
