'use strict';

const { loadRouteConfig } = require('./config');

const ROUTE_FILES = {
  default: require('./default'),
  fanmulu: require('./fanmulu'),
  static: require('./static'),
};

module.exports = app => {
  const active = loadRouteConfig(app.baseDir, app.logger);
  const register = ROUTE_FILES[active.mode] || ROUTE_FILES.default;

  app.activeRouteConfig = Object.freeze(Object.assign({}, active));
  register(app, app.activeRouteConfig);
  app.logger.info('[route-loader] active mode=%s, config changes require restart', app.activeRouteConfig.mode);
  return app.activeRouteConfig;
};
