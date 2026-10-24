'use strict';

// 默认模式的完整路由继续保存在 app/router.js。
// 此文件作为启动选择器的明确入口，便于以后将默认路由继续拆分。
module.exports = app => {
  app.logger.info('[route-loader] default route file selected');
};
