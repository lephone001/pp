'use strict';

const loadSelectedRoute = require('./router/loader');

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller, middleware } = app;
  // 在路由文件统一注册 Host 校验，先于路由分发执行；POST 请求跳过。
  app.use(middleware.domainHostGuard());
  // EggJS 在启动时固定路由表。这里根据本地配置优先加载对应路由文件；
  // 后台/API/资源请求仍继续使用本文件中的原有路由。
  // uplink 页面预览及接口属于全局路由，必须先于泛目录/静态兜底注册。
  require('./router/uplink')(app);
  require('./router/wenzhang')(app);
  // Article 的跳转判断必须先于泛目录/静态模式的 /* 兜底执行。
  router.get('/Article/Movie/*', middleware.jump(), controller.page.fanmuluArticle.article);
  router.get("/Article/*", middleware.jump(),controller.page.fanmuluArticle.article);
  const renderErrorTemplate = (templateName, statusCode) => async ctx => {
    const { domain } = await ctx.service.utils.getSiteInfo();
    ctx.status = statusCode;
    await ctx.render(templateName, { domain, detail: {} });
  };
  const errorPageAliases = [
    ['/404', '404.html', 404], ['/404.html', '404.html', 404],
    ['/404a', '404a.html', 404], ['/404a.html', '404a.html', 404],
    ['/404b', '404b.html', 404], ['/404b.html', '404b.html', 404],
    ['/404c', '404c.html', 404], ['/404c.html', '404c.html', 404],
    ['/404v', '404v.html', 404], ['/404v.html', '404v.html', 404],
    ['/error', 'error.html', 500], ['/error.html', 'error.html', 500],
    ['/new404', 'new404.html', 404], ['/new404.html', 'new404.html', 404],
    ['/notfind', 'notfind.html', 404], ['/notfind.html', 'notfind.html', 404],
  ];
  errorPageAliases.forEach(([route, templateName, statusCode]) => {
    router.get(route, renderErrorTemplate(templateName, statusCode));
  });
  loadSelectedRoute(app);
  // router.get("/xnxx", controller.page.index.xnxx);

 
  // 添加泛词库
  router.get("/api/fanPiCreate", controller.fan.fanPiCreate);
  router.get("/api/biyingRandomImage", controller.utils.biyingRandomImage)
  router.post('/api/statistics/overview', middleware.isLogin(app), controller.stats.overview);
  router.post('/api/statistics/settings', middleware.isLogin(app), middleware.isAdmin(app), controller.stats.settings);
  router.post('/api/statistics/dashboard', middleware.isLogin(app), controller.stats.dashboard);
  router.post('/api/statistics/sites', middleware.isLogin(app), controller.stats.sites);
  // 访问统计接口当前只要求登录；IP 也由动态路由提供 kind=ip，避免固定路由丢失参数。
  router.post('/api/statistics/:kind', middleware.isLogin(app), controller.stats.list);
  // socket.io
  // 站点地图 
  router.get("/sitemap.xml", controller.page.index.sitemap);
  router.get("/sitemap_index.xml", controller.page.index.sitemap);
  router.get("/sitemap/:id.xml", controller.page.index.sitemap);
  router.get("/sitemap.txt", controller.page.index.sitemap);
  router.get("/sitemap/:id.txt", controller.page.index.sitemap);
  router.get("/sitemap.html", controller.page.index.sitemap);
  router.get("/sitemap/:id.html", controller.page.index.sitemap);
  router.get("/robots.txt", controller.page.index.robots);
  router.get("/article.xml", controller.page.index.articleSitemap);

  // 页面部分
  router.get("/",  controller.page.index.indexPage);
  router.get("/index.html",  controller.page.index.indexPage);
  router.get("/index.htm",  controller.page.index.indexPage);
  router.get("/index",  controller.page.index.indexPage);

  // router.get("/c",  controller.page.index.indexPageCache);
  router.get("/update/agentlink/:id",controller.page.other.updateAgentLink)
  // router.get("/other/:name", controller.page.index.other);
  router.get("/domain",  controller.page.index.domain);
  // router.get("/getArticleData/:id", controller.article.getArticleData)//-------------------更新数据
  // router.get("/gogogo", controller.page.link.gogogo)
  // router.get("/gogogo/:id", controller.page.link.gogogo)

  // router.get("/vdetail/:id/index.html",controller.page.video.vdetail);
  // router.get("/hls-proxy", controller.hlsProxy.index);
  // router.get("/vcategory.html", controller.page.video.vcategoryIndex);
  // router.get("/vcategory/:cid/",controller.page.video.vcategory);
  // router.get("/vsearchlist/:value",controller.page.video.vsearchlist);
  // // router.get("/play",controller.page.video.play);
  // router.get("/video_book.html", controller.page.video.videoBookPage);
  // router.get("/video_image.html", controller.page.video.videoImagePage);

  // // 电影站点（siteType=11），与现有 video 路由完全分离
  // router.get("/movie", controller.page.movie.index);
  // router.get("/movie/index.html", controller.page.movie.index);
  // router.get("/movie/category/:id", controller.page.movie.category);
  // router.get("/movie/category/:id/index.html", controller.page.movie.category);
  // router.get("/movie/search/:value", controller.page.movie.search);
  // router.get("/movie/search", controller.page.movie.search);
  // router.get("/movie/detail/:id", controller.page.movie.detail);
  // router.get("/movie/detail/:id/index.html", controller.page.movie.detail);
  // router.get("/movie/play/:id", controller.page.movie.play);
  // router.get("/movie/play/:id/index.html", controller.page.movie.play);

  // // 美女图片站点（siteType=12），与原有文章/视频/电影页面分离
  // router.get("/miss", controller.page.miss.index);
  // router.get("/miss/index.html", controller.page.miss.index);
  // router.get("/miss/category/:id", controller.page.miss.category);
  // router.get("/miss/category/:id/index.html", controller.page.miss.category);
  // router.get("/miss/detail/:id", controller.page.miss.detail);
  // router.get("/miss/detail/:id/index.html", controller.page.miss.detail);
  // router.get("/miss/leader", controller.page.miss.leaders);
  // router.get("/miss/leader/index.html", controller.page.miss.leaders);
  // router.get("/miss/leader/:id", controller.page.miss.leader);
  // router.get("/miss/leader/:id/index.html", controller.page.miss.leader);
  // router.get("/uploads/miss/:filename", controller.missUpload.file);
  // router.get("/uploads/miss/*", controller.missUpload.file);
 
  // router.get("/disclaimers", controller.page.other.disclaimers);
  // router.get("/aboutus", controller.page.other.aboutus);
  // router.get("/business", controller.page.other.business);

  // router.get("/so/:id", controller.page.so.so);
  // router.get("/so.html", controller.page.so.so);
  // router.get("/so", controller.page.so.so);
  // router.get("/301", controller.page.link.jump301);
  // router.get("/app123/:id", controller.page.link.app123);
  // router.get("/bc123/:id", controller.page.link.bc123);
  
  // router.get("/url/:id", middleware.isBot(app), controller.page.link.url);
  // router.get("/url.html", middleware.isBot(app), controller.page.link.url);
  // router.get("/url", middleware.isBot(app), controller.page.link.url);
  // router.get("/wurl/:id", middleware.isBot(app), controller.page.link.wurl);
  // router.get("/wurl.html", middleware.isBot(app), controller.page.link.wurl);
  // router.get("/wurl", middleware.isBot(app), controller.page.link.wurl);
  // router.get("/n/:id", middleware.isBot(app), controller.page.link.n);
  // router.get("/n.html", middleware.isBot(app), controller.page.link.n);
  // router.get("/n", middleware.isBot(app), controller.page.link.n);
  // router.get("/l/:id", middleware.isBot(app), controller.page.link.l);
  // router.get("/l.html", middleware.isBot(app), controller.page.link.l);
  // router.get("/l", middleware.isBot(app), controller.page.link.l);
  // router.get("/w/:id", middleware.isBot(app), controller.page.link.w);
  // router.get("/w.html", middleware.isBot(app), controller.page.link.w);
  // router.get("/w", middleware.isBot(app), controller.page.link.w);
 

  router.get("/article.html", middleware.jump(),controller.page.other.articleList);
  router.get("/articlecategory/:id", middleware.jump(),controller.page.other.articleCategory);

  router.get("/detail/:id", controller.page.index.detail);
  router.get("/detail/:id:*", controller.page.index.detail);
  router.get("/detail/:id/index.html", controller.page.index.detail);

  // router.get("/options/:id", controller.page.jingtai.detail);

  // router.get("/apps/:id", controller.page.app.apps);
  // router.get("/apps/:id:*", controller.page.app.apps);
  // router.get("/apps/:id/index.html", controller.page.app.apps);

  // router.get("/nd/:id/index.html", controller.page.nav.detail);
  // router.get("/nd/:id", controller.page.nav.detail);
  // router.get("/addnav.html",middleware.jump(), controller.page.nav.addnav);
  // router.get("/navarticle.html",controller.page.nav.navarticle);
  // router.get("/nac/:id/index.html",middleware.jump(), controller.page.nav.navarticlecategory);
  // router.get("/nav/index.html",middleware.jump(), controller.page.nav.navhomepage);

  // router.get("/nc/:id/index.html",middleware.jump(), controller.page.nav.navcategory);
  // router.get("/allcategory/index.html", controller.page.nav.allcategory);

  // router.get("/xcategory/:id", middleware.jump(),controller.page.index.articleList);
  // router.get("/xcategory/:id/:aid/:bid", middleware.jump(),controller.page.index.articleList);
  // router.get("/xcategory/:id/index.html",middleware.jump(), controller.page.index.articleList);
  // router.get("/xcategory/:id.html",middleware.jump(), controller.page.index.articleList);
  // router.get("/xcategory/:id:*",middleware.jump(), controller.page.index.articleList);

  // 随机一张图片
  // router.get("/picturs/randomPicturs", controller.utils.randomPicturs);
  // // 网站首页图 一个站点配5张
  // router.get("/image_site/:type/:id/:num.jpg", controller.utils.getCommonImage);
  // router.get("/image_article/:type/:id/:num.jpg", controller.utils.getCommonImage);
  // router.get("/image_mulu/:type/:id/:num.jpg", controller.utils.getCommonImage);
  // router.get("/favicon.ico", controller.page.link.favicon);

  // 测试api
  router.get("/proxy/ip", controller.utils.proxyip);
  // 域名
  // router.get(
  //   '/api/domainCounterSet',
  //   controller.domain.domainCounterSet
  // );

  router.get('/api/captcha', controller.user.captcha); // 验证码
  // router.get("/api/ufzy/feixiaohao", controller.ufzy.feixiaohao);
  // router.get("/api/ufzy/getFeixiaohaoData", controller.ufzy.getFeixiaohaoData);
  router.get("/api/cleatAllCacheFlushall/:link", controller.utils.cleatAllCacheFlushall);
  // router.get("/se/index.html", controller.page.link.staticPageIndex);
  
  // router.get("/api/navStarAndBadAdd", controller.nav.navStarAndBadAdd);
  // router.get("/api/navStarAndBadAddRequest", controller.nav.navStarAndBadAddRequest);
  // router.get("/api/video/playstatus", controller.video.playstatus);
  // router.get("/ml/*", controller.page.link.mulu);

//文章工厂逻辑
  router.get("/v-n/*", controller.page.articleComapmy.articlevn);//工厂目录生成文件直接返回detail.html

  //articleCBD 数据库获取
  router.get("/v-nl/list.html", controller.page.articleCbd.articleList);
  router.get("/v-nd/:id", controller.page.articleCbd.articleDetail);
  router.get("/v-nd/:id:*", controller.page.articleCbd.articleDetail);
  router.get("/v-nd/:id/index.html", controller.page.articleCbd.articleDetail);

  //导航页面下载详情页
  // router.get("/x-app/*", controller.page.appDownload.appDownloadDetail);
  
  // router.get("/html/appjs", controller.page.link.appjs);
  router.get("/*", controller.page.link.allPage);

  
  router.post("/api/updateAdvLinks",controller.page.link.updateAdvLinks)
  router.post("/api/updateBCAdvLinks",controller.page.link.updateBCAdvLinks)

  router.post("/api/copyNewSite",  middleware.isLogin(app),controller.site.copyNewSite)
  router.post("/api/createSeoJingtai",  middleware.isLogin(app),controller.site.createSeoJingtai)

  router.post("/api/pushSubmit",  middleware.isLogin(app),controller.utils.pushSubmit)

  router.post("/api/pushSubmit",  middleware.isLogin(app),controller.utils.pushSubmit)
  
  router.post("/api/uploadbaiduverify",  middleware.isLogin(app),controller.upload.uploadbaiduverify)

  router.post("/api/timertServerOpen",  controller.site.timertServerOpen)

  // router.get('/api/sportLive360IsPlayList',controller.getSportLive.sportLive360IsPlayList)
  // router.get('/api/sportLive360ListALL',controller.getSportLive.sportLive360ListALL)
  // router.post('/api/sportTianYuGa', controller.getSportLive.sportTianYuGa)
  router.post("/api/baiduSubmit",  middleware.isLogin(app),controller.page.link.baiduSubmit)
  // router.post('/api/getGaLiveRoomNowOnlineList', controller.getSportLive.getGaLiveRoomNowOnlineList)
  router.post('/api/multipleSiteCreate', middleware.isLogin(app), controller.site.multipleSiteCreate)
  router.post('/api/multipleDomainCreate', middleware.isLogin(app), controller.site.multipleDomainCreate)
  router.post('/api/multipleArticleCreate', controller.site.multipleArticleCreate)
  router.post('/api/multipleAppCreate', controller.site.multipleAppCreate)
  router.post('/api/uploadArticleCreate', controller.site.uploadArticleCreate)

  router.post('/api/createArticleJs', controller.site.createArticleJs)


  router.post("/api/testapi", middleware.isLogin(app), controller.utils.testapi);
  // 更新的api 如果不是管理员 需要更新主数据库 
  router.post("/api/gettitle", middleware.isLogin(app), controller.site.gettitle);

  // router.post("/api/viewNavAddOne",controller.nav.viewNavAddOne);
  router.post("/api/adminConfigInfo", middleware.isLogin(app), controller.utils.adminConfigInfo);

  // 免费代理
  // 代理线管理
  router.post("/api/userAgentList", middleware.isLogin(app), controller.userAgent.userAgentList);
  router.post("/api/userAgentCreate", middleware.isLogin(app), controller.userAgent.userAgentCreate);
  router.post("/api/userAgentDelete", middleware.isLogin(app), controller.userAgent.userAgentDelete);
  router.post("/api/userAgentUpdate", middleware.isLogin(app), controller.userAgent.userAgentUpdate);
  router.post("/api/userAgentGetOne", controller.userAgent.userAgentGetOne);
  // 文章列表
  // router.post(
  //   '/api/articleList',
  //   controller.article.articleList
  // );
  // router.post(
  //   '/api/articlehyList',
  //   controller.article.articlehyList
  // );
  // 文章分类
  router.post(
    '/api/articleCategoryList',
    middleware.isLogin(app),
    controller.article.articleCategoryList
  );
  router.post(
    '/api/updateArticleCategory',
    middleware.isLogin(app),
    controller.article.updateArticleCategory
  );
  router.post(
    '/api/createArticleCategory',
    middleware.isLogin(app),
    controller.article.createArticleCategory
  );
  router.post(
    '/api/delArticleCategory',
    middleware.isLogin(app),
    controller.article.delArticleCategory
  );
  // 查找一篇文章
  // router.post('/api/findArticle', controller.article.findArticle)
  // router.post('/api/findhyArticle', controller.article.findhyArticle)
  router.post(
    '/api/updateArticle',
    middleware.isLogin(app),
    controller.article.updateArticle
  );
  router.post(
    '/api/updateArticleCacheList',
    middleware.isLogin(app),
    controller.article.updateArticleCacheList
  );
  router.post("/api/getArticleList", middleware.isLogin(app), controller.article.getArticleList)
  router.post('/api/createArticle', controller.article.createArticle)
  router.post('/api/aiArticleGenerate', middleware.isLogin(app), controller.aiArticle.generate);
  router.post(
    '/api/delArticle',
    middleware.isLogin(app),
    controller.article.delArticle
  );

  // 文章工厂
  router.post('/api/articleComapanyList', middleware.isLogin(app), controller.articleComapany.articleComapanyList);
  router.post('/api/articleComapanyCreate', middleware.isLogin(app), controller.articleComapany.articleComapanyCreate);
  router.post('/api/articleComapanyGetOne', middleware.isLogin(app), controller.articleComapany.articleComapanyGetOne);
  router.post('/api/articleComapanyUpdate', middleware.isLogin(app), controller.articleComapany.articleComapanyUpdate);
  router.post('/api/articleComapanyDelete', middleware.isLogin(app), controller.articleComapany.articleComapanyDelete);
  router.post('/api/articleComapanyStatus', middleware.isLogin(app), controller.articleComapany.articleComapanyStatus);
  router.post('/api/articleComapanyClearFolder', middleware.isLogin(app), controller.articleComapany.articleComapanyClearFolder);
  router.post('/api/articleComapanyDeleteCbdContent', middleware.isLogin(app), controller.articleComapany.articleComapanyDeleteCbdContent);
  router.post('/api/articleComapanyGenerate', middleware.isLogin(app), controller.articleComapany.articleComapanyGenerate);
  router.post('/api/articleComapanyImportCbd', middleware.isLogin(app), controller.articleComapany.articleComapanyImportCbd);

  // 文章CBD
  router.post('/api/articleCbdList', middleware.isLogin(app), controller.articleCbd.articleCbdList);
  router.post('/api/articleCbdCreate', middleware.isLogin(app), controller.articleCbd.articleCbdCreate);
  router.post('/api/articleCbdGetOne', middleware.isLogin(app), controller.articleCbd.articleCbdGetOne);
  router.post('/api/articleCbdUpdate', middleware.isLogin(app), controller.articleCbd.articleCbdUpdate);
  router.post('/api/articleCbdDelete', middleware.isLogin(app), controller.articleCbd.articleCbdDelete);
  router.post('/api/articleCbdRefreshCache', middleware.isLogin(app), controller.articleCbd.articleCbdRefreshCache);

  // APP下载管理
  router.post('/api/appDownloadList', middleware.isLogin(app), controller.appDownload.appDownloadList);
  router.post('/api/appDownloadCreate', middleware.isLogin(app), controller.appDownload.appDownloadCreate);
  router.post('/api/appDownloadGetOne', middleware.isLogin(app), controller.appDownload.appDownloadGetOne);
  router.post('/api/appDownloadUpdate', middleware.isLogin(app), controller.appDownload.appDownloadUpdate);
  router.post('/api/appDownloadDelete', middleware.isLogin(app), controller.appDownload.appDownloadDelete);
  router.post('/api/appDownloadStatus', middleware.isLogin(app), controller.appDownload.appDownloadStatus);
  router.post('/api/addDownloadList', middleware.isLogin(app), controller.appDownload.addDownloadList);
  router.post('/api/addDownloadCreate', middleware.isLogin(app), controller.appDownload.addDownloadCreate);
  router.post('/api/addDownloadGetOne', middleware.isLogin(app), controller.appDownload.addDownloadGetOne);
  router.post('/api/addDownloadUpdate', middleware.isLogin(app), controller.appDownload.addDownloadUpdate);
  router.post('/api/addDownloadDelete', middleware.isLogin(app), controller.appDownload.addDownloadDelete);
  router.post('/api/addDownloadStatus', middleware.isLogin(app), controller.appDownload.addDownloadStatus);

  //静态数据获取
  router.post(
    '/api/getJingTaiTodayNum',
    controller.articlejt.getJingTaiTodayNum
  )
  router.post(
    '/api/getArticlejthtml',
    middleware.isLogin(app),
    controller.articlejt.getArticlejthtml
  )
  
  router.post(
    '/api/multipleArticlejtCreate',
    middleware.isLogin(app),
    controller.site.multipleArticlejtCreate
  );
  router.post(
    '/api/updateArticlejt',
    middleware.isLogin(app),
    controller.articlejt.updateArticlejt
  );
  router.post(
    '/api/getArticlejtList',
    middleware.isLogin(app),
    controller.articlejt.getArticlejtList
  );
  router.post(
    '/api/delArticlejt',
    middleware.isLogin(app),
    controller.articlejt.delArticlejt
  );
  router.post(
    '/api/postArticlejt',
    middleware.isLogin(app),
    controller.articlejt.postArticlejt
  );
  
  

  // router.post('/api/clearCatch', controller.article.clearCatch)
  //视频
  // 上传图片  
  // router.post(
  //   '/api/uploadImage',
  //   controller.utils.uploadImage
  // );
  // 上传
  // router.post(
  //   '/api/upload',
  //   middleware.isLogin(app),
  //   controller.upload.upload
  // );
  // 用户部分
  router.post('/api/registseo', controller.user.regist);
  router.post('/api/loginseo', controller.user.login);
  router.post('/api/logout', controller.user.logout);
  router.post(
    '/api/userInfo',
    middleware.isLogin(app),
    controller.user.userInfo
  );
  router.post(
    '/api/userList',
    middleware.isLogin(app),
    middleware.isAdmin(),
    controller.user.userList
  );
  router.post(
    '/api/createUser',
    middleware.isLogin(app),
    middleware.isAdmin(),
    controller.user.createUser
  );
  router.post(
    '/api/findUser',
    middleware.isLogin(app),
    middleware.isAdmin(),
    controller.user.findUser
  );
  router.post(
    '/api/disableUser',
    middleware.isLogin(app),
    middleware.isAdmin(),
    controller.user.disableUser
  );
  router.post(
    '/api/updateUser',
    middleware.isLogin(app),
    middleware.isEditer(),
    controller.user.updateUser
  );
  // 站点
  router.post(
    '/api/siteList',
    middleware.isLogin(app),
    controller.site.siteList
  );
  router.post(
    '/api/createSite',
    middleware.isLogin(app),
    controller.site.createSite
  );
  router.post(
    '/api/findSite',
    // middleware.isLogin(app),
    controller.site.findSite
  );
  router.post(
    '/api/delSite',
    middleware.isLogin(app),
    middleware.isEditer(),
    controller.site.delSite
  );
  router.post(
    '/api/updateSite',
    middleware.isLogin(app),
    middleware.isEditer(),
    controller.site.updateSite
  );
  router.post(
    '/api/disableSite',
    middleware.isLogin(app),
    controller.site.disableSite
  );
  //验证分类名称
  router.post(
    '/api/findNavCategoryName',
    middleware.isLogin(app),
    controller.nav.findNavCategoryName
  );
  // 验证导航标题
  router.post(
    '/api/navtitleget',
    middleware.isLogin(app),
    controller.nav.navtitleget
  );  
  router.post(
    '/api/navCollectPreview',
    middleware.isLogin(app),
    controller.nav.navCollectPreview
  );
  router.post(
    '/api/navCollectItems',
    middleware.isLogin(app),
    controller.nav.navCollectItems
  );
  router.post(
    '/api/navCollectDelete',
    middleware.isLogin(app),
    controller.nav.navCollectDelete
  );
  router.post(
    '/api/navCollectSave',
    middleware.isLogin(app),
    controller.nav.navCollectSave
  );
  router.post('/api/navRefushNum',middleware.isLogin(app),controller.nav.navRefushNum)
  

  // // 导航分类
  router.post(
    '/api/navCategoryList',
    middleware.isLogin(app),
    controller.nav.navCategoryList
  );
  router.post(
    '/api/createNavCategory',
    middleware.isLogin(app),
    controller.nav.createNavCategory
  );
  router.post(
    '/api/findNavCategory',
    middleware.isLogin(app),
    controller.nav.findNavCategory
  );
  router.post(
    '/api/delNavCategory',
    middleware.isLogin(app),
    controller.nav.delNavCategory
  );
  router.post(
    '/api/updateNavCategory',
    middleware.isLogin(app),
    controller.nav.updateNavCategory
  );
  // 导航
  router.post(
    '/api/navList',
    middleware.isLogin(app),
    controller.nav.navList
  );
  router.post(
    '/api/nav/commonCreateNav',
    controller.nav.commonCreateNav
  );
  router.post('/api/commonCreateNavRequest',controller.nav.commonCreateNavRequest)
  
  router.post(
    '/api/createNav',
    middleware.isLogin(app),
    controller.nav.createNav
  );
  router.post(
    '/api/findNav',
    middleware.isLogin(app),
    controller.nav.findNav
  );

  router.post(
    '/api/viewNav',
    controller.nav.viewNav
  );
  router.post(
    '/api/delNav',
    middleware.isLogin(app),
    middleware.isEditer(),
    controller.nav.delNav
  );
  router.post(
    '/api/updateNav',
    middleware.isLogin(app),
    controller.nav.updateNav
  );
  router.post(
    '/api/nav/imagesUploads',
    controller.nav.imagesUploads
  )


  //app
  
  router.post(
    '/api/findAppCategoryName',
    middleware.isLogin(app),
    controller.app.findAppCategoryName
  );
  router.post(
    '/api/apptitleget',
    middleware.isLogin(app),
    controller.app.apptitleget
  );  
  router.post('/api/appRefushNum',middleware.isLogin(app),controller.app.appRefushNum)
  

  router.post(
    '/api/appCategoryList',
    middleware.isLogin(app),
    controller.app.appCategoryList
  );
  router.post(
    '/api/createAppCategory',
    middleware.isLogin(app),
    controller.app.createAppCategory
  );
  router.post(
    '/api/findAppCategory',
    middleware.isLogin(app),
    controller.app.findAppCategory
  );
  router.post(
    '/api/delAppCategory',
    middleware.isLogin(app),
    controller.app.delAppCategory
  );
  router.post(
    '/api/updateAppCategory',
    middleware.isLogin(app),
    controller.app.updateAppCategory
  );
  router.post(
    '/api/appList',
    middleware.isLogin(app),
    controller.app.appList
  );
  router.post(
    '/api/app/commonCreateApp',
    controller.app.commonCreateApp
  );

  
  router.post(
    '/api/app/getDataCenter',
    controller.app.getDataCenter
  );
  router.post('/api/commonCreateAppRequest',controller.app.commonCreateAppRequest)
  
  router.post(
    '/api/createApp',
    // middleware.isLogin(app),
    controller.app.createApp
  );
  router.post(
    '/api/findApp',
    middleware.isLogin(app),
    controller.app.findApp
  );

  router.post(
    '/api/viewApp',
    controller.app.viewApp
  );
  router.post(
    '/api/delApp',
    middleware.isLogin(app),
    middleware.isEditer(),
    controller.app.delApp
  );
  router.post(
    '/api/updateApp',
    middleware.isLogin(app),
    controller.app.updateApp
  );
  router.post(
    '/api/app/imagesUploads',
    controller.app.imagesUploads
  )

  // 动态获取数据
  router.post(
    '/api/getAppDataList',
    controller.app.getAppDataList
  )
  
  router.post(
    '/api/getArticleDataList',
    controller.article.getArticleDataList
  )
  

  //app jieshu
  // // 评论
  // router.post(
  //   '/api/commentList',
  //   middleware.isLogin(app),
  //   controller.articleComments.articleCommentsList
  // );
  // router.post(
  //   '/api/createComment',
  //   middleware.isLogin(app),
  //   middleware.isAdmin(),
  //   controller.articleComments.createArticleComments
  // );
  // router.post(
  //   '/api/findComment',
  //   middleware.isLogin(app),
  //   middleware.isAdmin(),
  //   controller.articleComments.findArticleComments
  // );
  // router.post(
  //   '/api/delComment',
  //   middleware.isLogin(app),
  //   middleware.isEditer(),
  //   controller.articleComments.delArticleComments
  // );
  // router.post(
  //   '/api/updateComment',
  //   middleware.isLogin(app),
  //   middleware.isEditer(),
  //   controller.articleComments.updateArticleComments
  // );
  // // 建议
  // router.post(
  //   '/api/adviceList',
  //   middleware.isLogin(app),
  //   controller.advice.adviceList
  // );
  // router.post('/api/createAdvice', controller.advice.createAdvice);
  // // router.post('/api/findAdvice', middleware.isLogin(app), middleware.isAdmin(), controller.advice.findAdvice)
  // router.post(
  //   '/api/delAdvice',
  //   middleware.isLogin(app),
  //   middleware.isEditer(),
  //   controller.advice.delAdvice
  // );
  // // router.post('/api/updateAdvice', middleware.isLogin(app), middleware.isAdmin(), controller.advice.updateAdvice)
  // // outlink
  // router.post(
  //   '/api/outlinkList',
  //   middleware.isLogin(app),
  //   controller.outlink.outlinkList
  // );
  // router.post(
  //   '/api/createOutlink',
  //   middleware.isLogin(app),
  //   middleware.isAdmin(),
  //   controller.outlink.createOutlink
  // );
  // router.post(
  //   '/api/findOutlink',
  //   middleware.isLogin(app),
  //   middleware.isAdmin(),
  //   controller.outlink.findOutlink
  // );
  // router.post(
  //   '/api/delOutlink',
  //   middleware.isLogin(app),
  //   middleware.isAdmin(),
  //   controller.outlink.delOutlink
  // );
  // router.post(
  //   '/api/updateOutlink',
  //   middleware.isLogin(app),
  //   middleware.isAdmin(),
  //   controller.outlink.updateOutlink
  // );
  // 获取后台首页数据

  router.post(
    '/api/domainList',
    middleware.isLogin(app),
    controller.domain.domainList
  );
  router.post('/api/updateDomainIP', middleware.isLogin(app), controller.domain.updateDomainIP)
  router.post(
    '/api/delDomainList',
    middleware.isLogin(app),
    controller.domain.delDomainList
  );
  router.post(
    '/api/domainListAll',
    middleware.isLogin(app),
    controller.domain.domainListAll
  );
  router.post('/api/tongbuDomainList', controller.domain.tongbuDomainList);
  router.post('/api/tongbuDomainPush', controller.domain.tongbuDomainPush);
  router.post('/api/tongbuDomainReceive', controller.domain.tongbuDomainReceive);
  router.post('/api/tongbuDomainSync', middleware.isLogin(app), controller.domain.tongbuDomainSync);
  router.post('/api/tongbuFanList', controller.domain.tongbuFanList);
  router.post('/api/tongbuFanSync', middleware.isLogin(app), controller.domain.tongbuFanSync);
  router.post('/api/tongbuMuluList', controller.domain.tongbuMuluList);
  router.post('/api/tongbuMuluSync', middleware.isLogin(app), controller.domain.tongbuMuluSync);
  router.post('/api/tongbuContentList', controller.domain.tongbuContentList);
  router.post('/api/tongbuContentPush', controller.domain.tongbuContentPush);
  router.post('/api/tongbuContentReceive', controller.domain.tongbuContentReceive);
  router.post('/api/tongbuContentSync', middleware.isLogin(app), controller.domain.tongbuContentSync);
  router.post('/api/contentSyncScheduleSettings', middleware.isLogin(app), middleware.isAdmin(app), controller.domain.contentSyncScheduleSettings);
  router.post('/api/saveContentSyncScheduleSettings', middleware.isLogin(app), middleware.isAdmin(app), controller.domain.saveContentSyncScheduleSettings);
  router.post('/api/clearAllCache/:link', middleware.isLogin(app), controller.utils.clearAllCache);
  router.post(
    '/api/createDomain',
    middleware.isLogin(app),
    controller.domain.createDomain
  );
  router.post('/api/clearRedisKeyList', middleware.isLogin(app), middleware.isEditer(), controller.utils.clearRedisKeyList);
  router.post("/api/mutUpdateDomain", middleware.isLogin(app), controller.domain.mutUpdateDomain)
  router.post("/api/mutUpdateReplaceDomain", middleware.isLogin(app), controller.domain.mutUpdateReplaceDomain)
  router.post("/api/mutUpdateReplaceFanWords", middleware.isLogin(app), controller.fan.mutUpdateReplaceFanWords)
  router.post("/api/mutUpdateReplaceMuluWords", middleware.isLogin(app), controller.mulu.mutUpdateReplaceMuluWords)

  router.post("/api/domainCategoryList", controller.domain.domainCategoryList)
  router.post("/api/addDomainCategory", controller.domain.addDomainCategory)
  router.post("/api/deleteDomainCategory", controller.domain.deleteDomainCategory)
  
  router.post("/api/testAllDomain", middleware.isLogin(app), controller.domain.testAllDomain)
  router.post('/api/updateAllDomainList', middleware.isLogin(app), controller.domain.updateAllDomainList)
  router.post("/api/domainCheckStatus", middleware.isLogin(app), controller.domain.domainCheckStatus)
  router.post("/api/siteServerInfo", middleware.isLogin(app), controller.localData.siteServerInfo)
  router.post("/api/saveSiteServerInfo", middleware.isLogin(app), controller.localData.saveSiteServerInfo)

  // 模板管理：查询和模板选项需要登录，写操作仅允许管理员。
  router.post('/api/templateOptions', middleware.isLogin(app), controller.template.options)
  router.post('/api/templateList', middleware.isLogin(app), controller.template.list)
  router.post('/api/templateCreate', middleware.isLogin(app), middleware.isAdmin(), controller.template.create)
  router.post('/api/templateUpdate', middleware.isLogin(app), middleware.isAdmin(), controller.template.update)
  router.post('/api/templateDelete', middleware.isLogin(app), middleware.isAdmin(), controller.template.remove)
  router.post('/api/templateImport', middleware.isLogin(app), middleware.isAdmin(), controller.template.importRows)
  router.post('/api/templateExport', middleware.isLogin(app), controller.template.exportRows)

  // 静态本地词库：读取仅需登录，写入、删除、设置和清缓存仅限管理员。
  router.post('/api/fanmuluArticle/summary', middleware.isLogin(app), controller.fanmuluArticle.summary);
  router.post('/api/fanmuluArticle/read', middleware.isLogin(app), controller.fanmuluArticle.read);
  router.post('/api/fanmuluArticle/save', middleware.isLogin(app), middleware.isAdmin(), controller.fanmuluArticle.save);
  router.post('/api/fanmuluArticle/create', middleware.isLogin(app), middleware.isAdmin(), controller.fanmuluArticle.create);
  router.post('/api/fanmuluArticle/delete', middleware.isLogin(app), middleware.isAdmin(), controller.fanmuluArticle.remove);
  router.post('/api/fanmuluArticle/settings', middleware.isLogin(app), middleware.isAdmin(), controller.fanmuluArticle.settings);
  router.post('/api/fanmuluArticle/cache/clear', middleware.isLogin(app), middleware.isAdmin(), controller.fanmuluArticle.clearCache);


  // 泛站设置
  router.post(
    '/api/fanList',
    middleware.isLogin(app),
    controller.fan.fanList
  );
  router.post(
    '/api/createFanList',
    middleware.isLogin(app),
    controller.fan.createFanList
  );
  router.post(
    '/api/refushFanCategory',
    middleware.isLogin(app),
    controller.fan.refushFanCategory
  );
  router.post(
    '/api/mutDelFan',
    middleware.isLogin(app),
    controller.fan.mutDelFan
  );
  router.post(
    '/api/fanListAll',
    middleware.isLogin(app),
    controller.fan.fanListAll
  );
  router.post(
    '/api/createFanCategoryList',
    middleware.isLogin(app),
    controller.fan.createFanCategoryList
  );
  router.post(
    '/api/fanCategoryList',
    middleware.isLogin(app),
    controller.fan.fanCategoryList
  );
  router.post(
    '/api/updateFanCategoryList',
    middleware.isLogin(app),
    controller.fan.updateFanCategoryList
  );
  router.post(
    '/api/delFanCategory',
    middleware.isLogin(app),
    controller.fan.delFanCategory
  );
//目录设置
router.post(
  '/api/muluList',
  middleware.isLogin(app),
  controller.mulu.muluList
);
router.post(
  '/api/createMuluList',
  middleware.isLogin(app),
  controller.mulu.createMuluList
);
router.post(
  '/api/refushMuluCategory',
  middleware.isLogin(app),
  controller.mulu.refushMuluCategory
);
router.post(
  '/api/mutDelMulu',
  middleware.isLogin(app),
  controller.mulu.mutDelMulu
);
router.post(
  '/api/muluListAll',
  middleware.isLogin(app),
  controller.mulu.muluListAll
);
router.post(
  '/api/createMuluCategoryList',
  middleware.isLogin(app),
  controller.mulu.createMuluCategoryList
);
router.post(
  '/api/muluCategoryList',
  middleware.isLogin(app),
  controller.mulu.muluCategoryList
);
router.post(
  '/api/updateMuluCategoryList',
  middleware.isLogin(app),
  controller.mulu.updateMuluCategoryList
);
router.post(
  '/api/delMuluCategory',
  middleware.isLogin(app),
  controller.mulu.delMuluCategory
);

  // 更新全局配置
  router.post('/api/globalConfigUpdate', middleware.isLogin(app), controller.utils.globalConfigUpdate)

  router.post('/api/findDomain', controller.domain.findDomain);
  router.post(
    '/api/delDomain',
    middleware.isLogin(app),
    controller.domain.delDomain
  );


  router.post(
    '/api/mutDelDomain',
    middleware.isLogin(app),
    controller.domain.mutDelDomain
  );


  router.post(
    '/api/updateDomain',
    middleware.isLogin(app),
    controller.domain.updateDomain
  );
  router.post(
    '/api/refreshDomain',
    middleware.isLogin(app),
    controller.domain.refreshDomain
  );
  // // 广告
  // router.post(
  //   '/api/advList',
  //   middleware.isLogin(app),
  //   controller.adv.advList
  // );
  // router.post(
  //   '/api/createAdv',
  //   middleware.isLogin(app),
  //   controller.adv.createAdv
  // );
  // router.post(
  //   '/api/findAdv',
  //   middleware.isLogin(app),
  //   middleware.isAdmin(),
  //   controller.adv.findAdv
  // );
  // router.post(
  //   '/api/delAdv',
  //   middleware.isLogin(app),
  //   middleware.isEditer(),
  //   controller.adv.delAdv
  // );
  // router.post(
  //   '/api/updateAdv',
  //   // middleware.isEditer(app),
  //   controller.adv.updateAdv
  // );
  // router.post(
  //   '/api/viewAdv',
  //   controller.adv.viewAdv
  // );
  // // 友情链接
  
  router.post('/api/videoPlatformList', controller.videoPlatform.videoPlatformList);
  router.post('/api/createVideoPlatform',middleware.isLogin(app), controller.videoPlatform.createVideoPlatform);
  router.post('/api/findVideoPlatform', controller.videoPlatform.findVideoPlatform);
  router.post('/api/updateVideoPlatform',middleware.isLogin(app), controller.videoPlatform.updateVideoPlatform);
  router.post('/api/delVideoPlatform',middleware.isLogin(app), controller.videoPlatform.delVideoPlatform);
  
  
  router.post('/api/updateVideo',middleware.isLogin(app), controller.video.updateVideo);
  router.post('/api/batchReplaceVideoLinks',middleware.isLogin(app), controller.video.batchReplaceVideoLinks);
  router.post('/api/videoBatchDeleteSources',middleware.isLogin(app), controller.video.videoBatchDeleteSources);
  router.post('/api/videoBatchDelete',middleware.isLogin(app), controller.video.videoBatchDelete);


  router.post('/api/updateVideoCategory',middleware.isLogin(app), controller.videoCategory.updateVideoCategory);
  router.post('/api/delVideoCategory',middleware.isLogin(app), controller.videoCategory.delVideoCategory);

  router.post('/api/createVideoCategory',middleware.isLogin(app), controller.videoCategory.createVideoCategory);
  router.post('/api/videoCategoryList', middleware.isLogin(app),controller.videoCategory.videoCategoryList);

  
  router.post('/api/friendLinkList', controller.friendLink.friendLinkList);
  router.post(
    '/api/createFriendLink',
    middleware.isLogin(app),
    middleware.isAdmin(),
    controller.friendLink.createFriendLink
  );
  // router.post(
  //   '/api/findFriendLink',
  //   middleware.isLogin(app),
  //   middleware.isAdmin(),
  //   controller.friendLink.findFriendLink
  // );
  router.post(
    '/api/delFriendLink',
    middleware.isLogin(app),
    middleware.isAdmin(),
    controller.friendLink.delFriendLink
  );
  router.post(
    '/api/updateFriendLink',
    // 特殊访问不需要加权限
    // middleware.isLogin(app),
    // middleware.isAdmin(),
    controller.friendLink.updateFriendLink
  );
  router.post('/api/getTodayCountVideo', controller.video.getTodayCountVideo)
  router.post("/api/videoList",middleware.isLogin(app), controller.video.videoListJM);
  router.post(
    "/api/createVideo",
    middleware.isLogin(app),
    controller.video.createVideo
  );
  router.post(
    "/api/videoPiCreate",
    middleware.isLogin(app),
    controller.video.videoPiCreate
  );
  router.post(
    "/api/createVideoJson",
    middleware.isLogin(app),
    controller.video.createVideoJson
  );
  router.post("/api/findVideo",middleware.isLogin(app), controller.video.findVideo);
  router.post("/api/videoDetailMore/:id", controller.video.videoDetailMore);
  router.post("/api/videoUpdateAll",middleware.isLogin(app), controller.video.videoUpdateAll);
  router.post("/api/refushVideoCategory",middleware.isLogin(app), controller.video.refushVideoCategory);

  // 电影后台 API，与现有 video API 分离
  router.post('/api/movieList', middleware.isLogin(app), controller.movie.movieList);
  router.post('/api/createMovie', middleware.isLogin(app), controller.movie.createMovie);
  router.post('/api/findMovie', middleware.isLogin(app), controller.movie.findMovie);
  router.post('/api/updateMovie', middleware.isLogin(app), controller.movie.updateMovie);
  router.post('/api/delMovie', middleware.isLogin(app), controller.movie.delMovie);
  router.post('/api/movieCategoryList', middleware.isLogin(app), controller.movieCategory.movieCategoryList);
  router.post('/api/createMovieCategory', middleware.isLogin(app), controller.movieCategory.createMovieCategory);
  router.post('/api/updateMovieCategory', middleware.isLogin(app), controller.movieCategory.updateMovieCategory);
  router.post('/api/delMovieCategory', middleware.isLogin(app), controller.movieCategory.delMovieCategory);
  router.post('/api/collectSourceList', middleware.isLogin(app), controller.collectSource.collectSourceList);
  router.post('/api/tongbuVideoCollectSourceList', controller.collectSource.tongbuVideoCollectSourceList);
  router.post('/api/tongbuVideoCollectSourceSync', middleware.isLogin(app), controller.collectSource.tongbuVideoCollectSourceSync);
  router.post('/api/createCollectSource', middleware.isLogin(app), controller.collectSource.createCollectSource);
  router.post('/api/updateCollectSource', middleware.isLogin(app), controller.collectSource.updateCollectSource);
  router.post('/api/delCollectSource', middleware.isLogin(app), controller.collectSource.delCollectSource);
  router.post('/api/clearCollectSourceMovies', middleware.isLogin(app), controller.collectSource.clearCollectSourceMovies);
  router.post('/api/collectTaskList', middleware.isLogin(app), controller.collectSource.collectTaskList);
  router.post('/api/createCollectTask', middleware.isLogin(app), controller.collectSource.createCollectTask);
  router.post('/api/pauseCollectTask', middleware.isLogin(app), controller.collectSource.pauseCollectTask);
  router.post('/api/resumeCollectTask', middleware.isLogin(app), controller.collectSource.resumeCollectTask);
  router.post('/api/deleteCollectTask', middleware.isLogin(app), controller.collectSource.deleteCollectTask);
  router.post('/api/retryCollectTask', middleware.isLogin(app), controller.collectSource.retryCollectTask);
  router.post('/api/collectSourceCategoryMappings', middleware.isLogin(app), controller.collectSource.collectSourceCategoryMappings);
  router.post('/api/updateCollectSourceCategoryMappings', middleware.isLogin(app), controller.collectSource.updateCollectSourceCategoryMappings);
  router.post('/api/collectSourceRemoteCategories', middleware.isLogin(app), controller.collectSource.collectSourceRemoteCategories);

  // 美女图片后台 API（仅管理 miss / miss_category / miss_city）
  router.post('/api/missList', middleware.isLogin(app), controller.missAdmin.list);
  router.post('/api/findMissAdmin', middleware.isLogin(app), controller.missAdmin.find);
  router.post('/api/createMissAdmin', middleware.isLogin(app), controller.missAdmin.create);
  router.post('/api/updateMissAdmin', middleware.isLogin(app), controller.missAdmin.update);
  router.post('/api/delMissAdmin', middleware.isLogin(app), controller.missAdmin.remove);
  router.post('/api/missLeaderListAdmin', middleware.isLogin(app), controller.missAdmin.leaderList);
  router.post('/api/findMissLeaderAdmin', middleware.isLogin(app), controller.missAdmin.leaderFind);
  router.post('/api/createMissLeaderAdmin', middleware.isLogin(app), controller.missAdmin.leaderCreate);
  router.post('/api/updateMissLeaderAdmin', middleware.isLogin(app), controller.missAdmin.leaderUpdate);
  router.post('/api/delMissLeaderAdmin', middleware.isLogin(app), controller.missAdmin.leaderRemove);
  router.post('/api/missCategoryList', middleware.isLogin(app), controller.missAdmin.categoryList);
  router.post('/api/createMissCategory', middleware.isLogin(app), controller.missAdmin.categoryCreate);
  router.post('/api/updateMissCategory', middleware.isLogin(app), controller.missAdmin.categoryUpdate);
  router.post('/api/delMissCategory', middleware.isLogin(app), controller.missAdmin.categoryRemove);
  router.post('/api/missCityList', middleware.isLogin(app), controller.missAdmin.cityList);
  router.post('/api/exportMissCity', middleware.isLogin(app), controller.missAdmin.cityExport);
  router.post('/api/createMissCity', middleware.isLogin(app), controller.missAdmin.cityCreate);
  router.post('/api/updateMissCity', middleware.isLogin(app), controller.missAdmin.cityUpdate);
  router.post('/api/delMissCity', middleware.isLogin(app), controller.missAdmin.cityRemove);
  router.post('/api/batchCreateMissCity', middleware.isLogin(app), controller.missAdmin.cityBatchCreate);
  router.post('/api/importMissCity', middleware.isLogin(app), controller.missAdmin.cityImport);
  router.post('/api/missUpload', middleware.isLogin(app), controller.missUpload.upload);
  // 源服务器上传到当前程序；密码由 missUpload Service 统一校验。
  router.post('/api/missSourceUpload', controller.missUpload.sourceUpload);
  router.post('/api/missUploadList', middleware.isLogin(app), controller.missUpload.list);

  

  //图片
  router.post("/api/videoImageList", middleware.isLogin(app),controller.videoImage.videoImageList);
  router.post(
    "/api/createVideoImage",middleware.isLogin(app),
    controller.videoImage.createVideoImage
  );
  router.post(
    "/api/findVideoImage",middleware.isLogin(app),
    controller.videoImage.findVideoImage
  );
  router.post("/api/updateVideoImage", middleware.isLogin(app), controller.videoImage.updateVideoImage);
  router.post("/api/delVideoImage", middleware.isLogin(app), controller.videoImage.delVideoImage);
  // 新图片
  router.post("/api/imageList",middleware.isLogin(app), controller.image.imageList);
  router.post(
    "/api/findImage",middleware.isLogin(app),
    controller.image.findImage
  );

  //小说
  router.post("/api/videoBookList",middleware.isLogin(app), controller.video.videoBookList);
  router.post(
    "/api/findVideoBook",middleware.isLogin(app),
    controller.video.findVideoBook
  );
  router.post("/api/updateVideoBook", middleware.isLogin(app), controller.video.updateVideoBook);
  router.post("/api/delVideoBook", middleware.isLogin(app), controller.video.delVideoBook);
  // router.post(
  //   '/api/sebobaoAppList',
  //   controller.sebobao.sebobaoAppList
  // );
  // router.post(
  //   '/api/huahuaList',
  //   controller.video.huahuaList
  // );
  router.post("/api/noteList",middleware.isLogin(app), controller.note.noteList);
  router.post("/api/createNote",middleware.isLogin(app), controller.note.createNote);
  router.post("/api/findNote",middleware.isLogin(app), controller.note.findNote);
  router.post("/api/updateNote",middleware.isLogin(app), controller.note.updateNote);
  router.post("/api/delNote",middleware.isLogin(app), controller.note.delNote);
  // 仅兜底未匹配的 POST；命名供解析请求体前的 postRouteGuard 识别。
  router.post('allPostFallback', '/*', controller.utils.allPost);
};


