'use strict';

module.exports = app => {
  const mongoose = app.mongoose;
  const Schema = mongoose.Schema;

  const StatsDaily = new Schema({
    dimension: { type: String, required: true },
    date: { type: String, required: true },
    siteKey: { type: String, required: true },
    key: { type: String, required: true },
    statusCode: { type: Number },
    sourceDomain: { type: String, default: '' },
    landingPath: { type: String, default: '' },
    visitorType: { type: String, default: '' },
    pv: { type: Number, default: 0 },
    normalPv: { type: Number, default: 0 },
    spiderPv: { type: Number, default: 0 },
    searchPv: { type: Number, default: 0 },
    errorPv: { type: Number, default: 0 },
    pcPv: { type: Number, default: 0 },
    mobilePv: { type: Number, default: 0 },
    normalPcPv: { type: Number, default: 0 },
    normalMobilePv: { type: Number, default: 0 },
    spiderPcPv: { type: Number, default: 0 },
    spiderMobilePv: { type: Number, default: 0 },
    uniqueIp: { type: Number, default: 0 },
    uniqueUrls: { type: Number, default: 0 },
    firstAt: { type: Date },
    lastAt: { type: Date },
    lastIp: { type: String, default: '' },
    lastUa: { type: String, default: '' },
    lastUrl: { type: String, default: '' },
    expireAt: { type: Date, required: true },
  }, {
    collection: 'stats_daily',
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  });

  StatsDaily.index({ dimension: 1, date: 1, siteKey: 1, key: 1 }, { unique: true });
  StatsDaily.index({ dimension: 1, date: -1, siteKey: 1, pv: -1 });
  StatsDaily.index({ dimension: 1, date: 1, pv: -1 });
  StatsDaily.index({ dimension: 1, date: 1, siteKey: 1, lastAt: -1 });
  StatsDaily.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

  return mongoose.model('stats_daily', StatsDaily);
};
