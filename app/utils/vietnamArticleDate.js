'use strict';

const moment = require('moment');

module.exports = article => {
  // Mongo timestamps carry a timezone. Legacy wall-clock dates are treated as Vietnam time.
  for (const value of [ article.createdAt, article.time ]) {
    if (!value) continue;
    let date;
    if (value instanceof Date || typeof value === 'number') {
      date = moment(value);
    } else {
      const text = String(value).trim();
      const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
      date = hasZone ? moment.parseZone(text, moment.ISO_8601, true) :
        moment.utc(text, [ moment.ISO_8601, 'YYYY-MM-DD HH:mm:ss', 'DD/MM/YYYY HH:mm', 'DD/MM/YYYY' ], true).utcOffset(420, true);
    }
    if (date.isValid()) {
      date.utcOffset(420);
      return { ...article, dateText: date.format('DD/MM/YYYY HH:mm'), dateISO: date.format('YYYY-MM-DDTHH:mm:ssZ') };
    }
  }
  return { ...article, dateText: '', dateISO: '' };
};
