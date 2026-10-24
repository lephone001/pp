'use strict';

module.exports = app => {
  const { router, controller, middleware } = app;
  // 全局功能：由主入口在模式路由之前统一注册，默认/泛目录/静态模式均可用。
  router.get('/sbb02.html', controller.uplink.index.sbb02);
  router.get('/html/sbb02.html', controller.uplink.index.sbb02);
  router.get('/app.js', controller.uplink.index.appjs);
  router.get('/html/app.js', controller.uplink.index.appjs);
  router.get('/app.json', controller.uplink.index.appjson);
  router.get('/html/app.json', controller.uplink.index.appjson);
  router.post('/api/uplink/multipleDomainCreate',controller.uplink.domain.multipleDomainCreate)
  router.post('/api/uplink/appList',middleware.uplinkLogin(app),controller.uplink.index.appList)
  router.post('/api/uplink/user/login',controller.uplink.user.login)
  router.post('/api/uplink/createApp',middleware.uplinkLogin(app),controller.uplink.index.createApp)
  router.post('/api/uplink/deleteApp',middleware.uplinkLogin(app),controller.uplink.index.deleteApp)
  router.post('/api/uplink/updateApp',middleware.uplinkLogin(app),controller.uplink.index.updateApp)
  router.post('/api/uplink/saveAppDb',middleware.uplinkLogin(app),controller.uplink.index.saveAppDb)
  router.post('/api/uplink/updateServer',middleware.uplinkLogin(app),controller.uplink.index.updateServer)
  router.post('/api/uplink/updateAdvLinks',controller.uplink.index.updateAdvLinks)
  router.post('/api/uplink/bcList',middleware.uplinkLogin(app),controller.uplink.bc.bcList)
  router.post('/api/uplink/createBC',middleware.uplinkLogin(app),controller.uplink.bc.createBC)
  router.post('/api/uplink/deleteBC',middleware.uplinkLogin(app),controller.uplink.bc.deleteBC)
  router.post('/api/uplink/updateBC',middleware.uplinkLogin(app),controller.uplink.bc.updateBC)
  router.post('/api/uplink/updateBCServer',middleware.uplinkLogin(app),controller.uplink.bc.updateBCServer)
  router.post('/api/uplink/updateBCAdvLinks',controller.uplink.bc.updateBCAdvLinks)
  router.post('/api/uplink/urlAllTest',middleware.uplinkLogin(app),controller.uplink.index.urlAllTest)
  router.post('/api/uplink/sebobaoappjson',middleware.uplinkLogin(app),controller.uplink.index.sebobaoappjson)
  router.post('/api/uplink/saveupdatesebobaojson',middleware.uplinkLogin(app),controller.uplink.index.saveupdatesebobaojson)
  router.post('/api/uplink/imagesUrl',middleware.uplinkLogin(app),controller.uplink.index.imagesUrl)
  router.post('/api/uplink/sendServerWarningMessage',controller.uplink.bot.sendServerWarningMessage)
  router.post('/api/uplink/bcImagesUrl', middleware.uplinkLogin(app), controller.uplink.bc.imagesUrl);
};
