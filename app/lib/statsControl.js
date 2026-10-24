'use strict';
const fs = require('fs');
const path = require('path');

function enabled(app) {
  return (!app.config.stats || app.config.stats.enabled !== false) && app.statsRuntimeEnabled !== false;
}

function apply(app, value) {
  app.statsRuntimeEnabled = value;
  if (!enabled(app) && app.statsCollectorState) {
    const state = app.statsCollectorState;
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
    state.queue = [];
    state.summary = Object.create(null);
    state.dropped = 0;
  }
}

function reload(app) {
  const file = path.join(app.config.localDataDir || path.join(app.baseDir, 'app', 'local_data'), 'stats_control.json');
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (typeof data.enabled !== 'boolean') throw new Error('Invalid statistics control');
    apply(app, data.enabled);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      app.logger.error('[stats] control load failed: %s', error.message);
      apply(app, false);
    }
  }
}
module.exports = { enabled, apply, reload };
