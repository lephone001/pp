'use strict';
module.exports = app => {
  const { router, controller, middleware } = app;
  router.get('/WenZhang', middleware.jump(),controller.page.wenzhang.index);
  router.get('/WenZhang/*', middleware.jump(),controller.page.wenzhang.index);
  router.get('/WenZhangMuLu',middleware.jump(), controller.page.wenzhang.index);
  router.get('/WenZhangMuLu/*',middleware.jump(), controller.page.wenzhang.index);
  router.post('/api/wenzhang/:action', middleware.isLogin(app), middleware.isAdmin(app), controller.wenzhang.manage);
};
