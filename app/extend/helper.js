// app/extend/helper.js
'use strict';
const moment = require('moment');
moment.locale('zh'); // en

module.exports = {
  downloadPortal(input = {}) {
    const ctx = this.ctx;
    return ctx.service.fanmuluArticle.downloadPortal(Object.assign({}, input, {
      seed: String(ctx.host || '') + String(ctx.path || '/'),
    }));
  },
  /**
   * Formats a given time value into a readable string.
   * @param {Date|number|string} time The time to format.
   * @param {string} format The moment.js format string (e.g., 'YYYY-MM-DD hh:mm:ss a').
   */
  formatTime(time, format = 'YYYY-MM-DD hh:mm:ss') {
    if (!time) return '';
    return moment(time).format(format);
  },

  /**
   * Formats a given time to a relative time string (e.g., "3 days ago").
   * @param {Date|number|string} time The time to format.
   */
  relativeTime(time) {
    if (!time) return '';
    return moment(time).fromNow();
  },
};
