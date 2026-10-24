'use strict';

const fs = require('fs');
const path = require('path');

const ROUTE_MODES = [ 'default', 'fanmulu', 'static' ];
const DEFAULT_ROUTE_CONFIG = Object.freeze({
  mode: 'default',
});

function normalizeRouteConfig(value) {
  const source = value && typeof value === 'object' ? value : {};
  const mode = ROUTE_MODES.indexOf(source.mode) !== -1 ? source.mode : 'default';
  return { mode };
}

function loadRouteConfig(baseDir, logger) {
  const file = path.join(baseDir, 'app', 'local_data', 'site_server_info.json');
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return normalizeRouteConfig(data && data.route_config);
  } catch (error) {
    if (error && error.code !== 'ENOENT' && logger) {
      logger.warn('[route-loader] cannot read route config, use default route: ' + String(error.message || error));
    }
    return Object.assign({}, DEFAULT_ROUTE_CONFIG);
  }
}

module.exports = {
  DEFAULT_ROUTE_CONFIG,
  loadRouteConfig,
  normalizeRouteConfig,
};
