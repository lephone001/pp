'use strict';

const Service = require('egg').Service;
const control = require('../lib/statsControl');

const MOBILE_UA = /(mobile|android|iphone|ipad|ipod|windows phone|blackberry|opera mini|webos|mobi|tablet)/i;

function today() {
  const date = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
}

function dateRange(body) {
  const input = body || {};
  let from = validDate(input.dateFrom);
  let to = validDate(input.dateTo);
  if (!from || !to) {
    const range = String(input.range || '30');
    const days = range === 'today' ? 1 : Math.min(30, Math.max(1, Number(range) || 30));
    const end = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - (days - 1) * 86400000);
    from = start.toISOString().slice(0, 10);
    to = end.toISOString().slice(0, 10);
  }
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  const endMs = new Date(to + 'T00:00:00+08:00').getTime();
  const startMs = new Date(from + 'T00:00:00+08:00').getTime();
  if (Number.isFinite(endMs) && Number.isFinite(startMs) && endMs - startMs > 29 * 86400000) {
    from = new Date(endMs - 29 * 86400000 + 8 * 3600000).toISOString().slice(0, 10);
  }
  return { from, to };
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function increment(target, key, value) {
  target[key] = (target[key] || 0) + value;
}

function eventDevice(event) {
  if (event.device === 'mobile' || event.device === 'pc') return event.device;
  return MOBILE_UA.test(String(event.ua || '')) ? 'mobile' : 'pc';
}

function deviceSummary(row, visitorType) {
  const source = row || {};
  const type = String(visitorType || 'all');
  const pc = Number(type === 'normal' ? source.normalPcPv : type === 'spider' ? source.spiderPcPv : source.pcPv) || 0;
  const mobile = Number(type === 'normal' ? source.normalMobilePv : type === 'spider' ? source.spiderMobilePv : source.mobilePv) || 0;
  return { pc, mobile, total: pc + mobile };
}

function keyFor(dimension, event) {
  const separator = '\u0001';
  if (dimension === 'site') return event.siteKey;
  if (dimension === 'spider') return event.spiderType;
  if (dimension === 'url') return event.path;
  if (dimension === 'ip') return event.ip;
  if (dimension === 'search') return [ event.searchEngine, event.refererHost, event.path ].join(separator);
  if (dimension === 'error') return [ event.status, event.path ].join(separator);
  if (dimension === 'url_ip') return [ event.path, event.ip ].join(separator);
  if (dimension === 'ip_url') return [ event.ip, event.path ].join(separator);
  if (dimension === 'spider_url') return [ event.spiderType, event.path ].join(separator);
  if (dimension === 'search_ip') return [ event.searchEngine, event.refererHost, event.path, event.ip ].join(separator);
  return '';
}

function relationParent(dimension, event) {
  if (dimension === 'url_ip') return { dimension: 'url', key: event.path, field: 'uniqueIp' };
  if (dimension === 'ip_url') return { dimension: 'ip', key: event.ip, field: 'uniqueUrls' };
  if (dimension === 'spider_url') return { dimension: 'spider', key: event.spiderType, field: 'uniqueUrls' };
  if (dimension === 'search_ip') return { dimension: 'search', key: keyFor('search', event), field: 'uniqueIp' };
  return null;
}

function upsertedIndexes(result) {
  const indexes = {};
  const ids = result && result.upsertedIds || result && result.result && result.result.upsertedIds;
  if (ids && typeof ids === 'object') Object.keys(ids).forEach(index => { indexes[Number(index)] = true; });
  const rows = result && typeof result.getUpsertedIds === 'function'
    ? result.getUpsertedIds()
    : result && result.result && Array.isArray(result.result.upserted) ? result.result.upserted : [];
  (rows || []).forEach(row => { if (row && row.index !== undefined) indexes[Number(row.index)] = true; });
  return indexes;
}

class StatsAggregator extends Service {
  get statsConfig() {
    return this.app.config.stats || {};
  }

  get redisKey() {
    return this.statsConfig.redisStreamKey || 'stats:events';
  }

  get groupName() {
    return this.statsConfig.redisConsumerGroup || 'stats-aggregator';
  }

  get consumerName() {
    return this.statsConfig.redisConsumerName || 'stats-aggregator-main';
  }

  async ensureGroup() {
    if (!this.app.redis || !this.app.redis.xgroup) return false;
    try {
      await this.app.redis.xgroup('CREATE', this.redisKey, this.groupName, '0', 'MKSTREAM');
    } catch (error) {
      if (String(error && error.message || '').indexOf('BUSYGROUP') === -1) throw error;
    }
    return true;
  }

  async readMessages(start) {
    const result = await this.app.redis.xreadgroup(
      'GROUP', this.groupName,
      this.consumerName,
      'COUNT', Math.max(50, Number(this.statsConfig.consumeBatchSize) || 500),
      'BLOCK', 1,
      'STREAMS', this.redisKey, start
    );
    if (!result || !result.length || !result[0][1]) return [];
    return result[0][1].map(item => {
      const fields = item[1] || [];
      let payload = '';
      for (let i = 0; i < fields.length; i += 2) {
        if (fields[i] === 'payload') payload = fields[i + 1];
      }
      try {
        return { id: item[0], event: JSON.parse(payload) };
      } catch (error) {
        return { id: item[0], event: null };
      }
    });
  }

  buildOperation(map, dimension, event, unique) {
    const key = keyFor(dimension, event);
    if (!key || (dimension === 'spider' && !event.spiderType)) return;
    const identity = [ dimension, event.date, event.siteKey, key ].join('\u0002');
    let item = map[identity];
    if (!item) {
      item = map[identity] = {
        dimension,
        date: event.date,
        siteKey: event.siteKey,
        key,
        inc: {},
        set: {},
        setOnInsert: {
          firstAt: new Date(event.timestamp),
          expireAt: new Date(new Date(event.timestamp).getTime() + (Number(this.statsConfig.retentionDays) || 30) * 86400000),
        },
      };
    }
    if (unique) {
      item.parent = relationParent(dimension, event);
      item.set.lastAt = new Date(event.timestamp);
      item.set.lastIp = event.ip;
      item.set.lastUa = event.ua;
      item.set.lastUrl = event.path;
      return;
    }
    increment(item.inc, 'pv', 1);
    increment(item.inc, event.spiderType ? 'spiderPv' : 'normalPv', 1);
    if (dimension === 'site') {
      const device = eventDevice(event);
      const prefix = event.spiderType ? 'spider' : 'normal';
      increment(item.inc, device === 'mobile' ? 'mobilePv' : 'pcPv', 1);
      increment(item.inc, prefix + (device === 'mobile' ? 'MobilePv' : 'PcPv'), 1);
    }
    if (event.searchEngine) increment(item.inc, 'searchPv', 1);
    if (event.status >= 400) increment(item.inc, 'errorPv', 1);
    item.set.lastAt = new Date(event.timestamp);
    item.set.lastIp = event.ip;
    item.set.lastUa = event.ua;
    item.set.lastUrl = event.path;
    if (dimension === 'search') {
      item.set.sourceDomain = event.refererHost;
      item.set.landingPath = event.path;
    }
    if (dimension === 'error') item.set.statusCode = event.status;
    if (dimension === 'ip') item.set.visitorType = event.spiderType || '普通用户';
  }

  async saveEvents(events) {
    if (!control.enabled(this.app)) return;
    const map = {};
    events.forEach(event => {
      if (!event || !event.date || !event.siteKey || !event.path) return;
      this.buildOperation(map, 'site', event, false);
      this.buildOperation(map, 'url', event, false);
      this.buildOperation(map, 'ip', event, false);
      if (event.spiderType) this.buildOperation(map, 'spider', event, false);
      if (event.searchEngine) this.buildOperation(map, 'search', event, false);
      if (event.status >= 400) this.buildOperation(map, 'error', event, false);
      if (event.ip) this.buildOperation(map, 'url_ip', event, true);
      if (event.ip) this.buildOperation(map, 'ip_url', event, true);
      if (event.spiderType) this.buildOperation(map, 'spider_url', event, true);
      if (event.searchEngine && event.ip) this.buildOperation(map, 'search_ip', event, true);
    });

    const items = Object.keys(map).map(identity => map[identity]);
    const relationDimensions = [ 'url_ip', 'ip_url', 'spider_url', 'search_ip' ];
    const relationItems = items.filter(item => relationDimensions.indexOf(item.dimension) !== -1);
    const primaryItems = items.filter(item => relationDimensions.indexOf(item.dimension) === -1);
    const buildBulkOperation = item => {
      const update = { $setOnInsert: item.setOnInsert };
      if (Object.keys(item.inc).length) update.$inc = item.inc;
      if (Object.keys(item.set).length) update.$set = item.set;
      return {
        updateOne: {
          filter: { dimension: item.dimension, date: item.date, siteKey: item.siteKey, key: item.key },
          update,
          upsert: true,
        },
      };
    };

    if (relationItems.length) {
      const relationResult = await this.ctx.model.StatsDaily.bulkWrite(relationItems.map(buildBulkOperation), { ordered: false });
      const inserted = upsertedIndexes(relationResult);
      Object.keys(inserted).forEach(indexValue => {
        const item = relationItems[Number(indexValue)];
        if (!item || !item.parent) return;
        const identity = [ item.parent.dimension, item.date, item.siteKey, item.parent.key ].join('\u0002');
        const parent = map[identity];
        if (parent) increment(parent.inc, item.parent.field, 1);
      });
    }

    if (primaryItems.length) {
      await this.ctx.model.StatsDaily.bulkWrite(primaryItems.map(buildBulkOperation), { ordered: false });
    }
  }

  async consumeAvailable(maxBatches) {
    if (!control.enabled(this.app)) return 0;
    if (!this.app.redis || !this.app.redis.xreadgroup) return 0;
    const lockKey = this.statsConfig.redisLockKey || 'stats:aggregate:lock';
    const lockToken = this.consumerName + ':' + process.pid + ':' + Date.now();
    const lockSeconds = Math.max(600, Number(this.statsConfig.redisLockSeconds) || 900);
    const lock = await this.app.redis.set(lockKey, lockToken, 'NX', 'EX', lockSeconds);
    if (lock !== 'OK') return 0;
    let consumed = 0;
    try {
      await this.ensureGroup();
      const limit = Math.min(50, Math.max(1, Number(maxBatches) || 1));
      for (let batchIndex = 0; batchIndex < limit; batchIndex++) {
        if (!control.enabled(this.app)) break;
        let messages = await this.readMessages('0');
        if (!messages.length) messages = await this.readMessages('>');
        if (!messages.length) break;
        if (!control.enabled(this.app)) break;
        const valid = messages.filter(item => item.event).map(item => item.event);
        if (valid.length) await this.saveEvents(valid);
        const ids = messages.map(item => item.id);
        await this.app.redis.xack(this.redisKey, this.groupName, ...ids);
        if (typeof this.app.redis.xdel === 'function') await this.app.redis.xdel(this.redisKey, ...ids);
        consumed += valid.length;
      }
      return consumed;
    } finally {
      const releaseScript = 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';
      try {
        await this.app.redis.eval(releaseScript, 1, lockKey, lockToken);
      } catch (error) {
        this.ctx.app.logger.warn('[stats] release aggregate lock failed: ' + String(error && error.message || error).slice(0, 200));
      }
    }
  }

  async consumeOnce() {
    return this.consumeAvailable(1);
  }

  match(dimension, body) {
    const range = dateRange(body);
    const match = { dimension, date: { $gte: range.from, $lte: range.to } };
    if (body && body.site && body.site !== 'all') match.siteKey = String(body.site).slice(0, 255);
    return match;
  }

  async siteAggregate(date, body) {
    const match = this.match('site', Object.assign({}, body, { dateFrom: date, dateTo: date }));
    const rows = await this.ctx.model.StatsDaily.aggregate([
      { $match: match },
      { $group: {
        _id: null,
        pv: { $sum: '$pv' },
        normal: { $sum: '$normalPv' },
        spider: { $sum: '$spiderPv' },
        search: { $sum: '$searchPv' },
        errors: { $sum: '$errorPv' },
        pcPv: { $sum: '$pcPv' },
        mobilePv: { $sum: '$mobilePv' },
        normalPcPv: { $sum: '$normalPcPv' },
        normalMobilePv: { $sum: '$normalMobilePv' },
        spiderPcPv: { $sum: '$spiderPcPv' },
        spiderMobilePv: { $sum: '$spiderMobilePv' },
      } },
    ]).option({ maxTimeMS: 5000 });
    return rows[0] || { pv: 0, normal: 0, spider: 0, search: 0, errors: 0 };
  }

  async overview(body) {
    const input = body || {};
    const range = dateRange(input);
    const dateList = [];
    for (let cursor = new Date(range.from + 'T00:00:00+08:00'); cursor <= new Date(range.to + 'T00:00:00+08:00'); cursor = new Date(cursor.getTime() + 86400000)) {
      dateList.push(new Date(cursor.getTime() + 8 * 3600000).toISOString().slice(0, 10));
    }
    const todayInput = Object.assign({}, input, { dateFrom: today(), dateTo: today() });
    const droppedPromise = this.app.redis
      ? this.app.redis.get(this.statsConfig.redisDroppedKey || 'stats:dropped').catch(() => 0)
      : Promise.resolve(0);
    const [ metrics, trendRows, ipTrendRows, urlCount, ipCount, spiderPie, pageRows, droppedValue ] = await Promise.all([
      this.siteAggregate(today(), input),
      this.ctx.model.StatsDaily.aggregate([
        { $match: this.match('site', input) },
        { $group: {
          _id: '$date',
          pv: { $sum: '$pv' },
          normal: { $sum: '$normalPv' },
          spider: { $sum: '$spiderPv' },
          search: { $sum: '$searchPv' },
          pcPv: { $sum: '$pcPv' },
          mobilePv: { $sum: '$mobilePv' },
          normalPcPv: { $sum: '$normalPcPv' },
          normalMobilePv: { $sum: '$normalMobilePv' },
          spiderPcPv: { $sum: '$spiderPcPv' },
          spiderMobilePv: { $sum: '$spiderMobilePv' },
        } },
        { $sort: { _id: 1 } },
      ]),
      this.ctx.model.StatsDaily.aggregate([
        { $match: this.match('ip', input) },
        { $group: { _id: '$date', ip: { $sum: 1 } } },
      ]),
      this.ctx.model.StatsDaily.countDocuments(this.match('url', todayInput)),
      this.ctx.model.StatsDaily.countDocuments(this.match('ip', todayInput)),
      this.ctx.model.StatsDaily.aggregate([
        { $match: this.match('spider', todayInput) },
        { $group: { _id: '$key', value: { $sum: '$pv' } } },
        { $sort: { value: -1 } },
      ]),
      this.ctx.model.StatsDaily.find(this.match('url', todayInput)).sort({ pv: -1 }).limit(10).lean(),
      droppedPromise,
    ]);
    const trendMap = {};
    trendRows.forEach(row => { trendMap[row._id] = row; });
    ipTrendRows.forEach(row => {
      if (!trendMap[row._id]) trendMap[row._id] = { _id: row._id };
      trendMap[row._id].ip = Number(row.ip || 0);
    });
    const rangeDeviceTotals = trendRows.reduce((totals, row) => {
      [ 'pcPv', 'mobilePv', 'normalPcPv', 'normalMobilePv', 'spiderPcPv', 'spiderMobilePv' ].forEach(field => {
        totals[field] += Number(row[field] || 0);
      });
      return totals;
    }, { pcPv: 0, mobilePv: 0, normalPcPv: 0, normalMobilePv: 0, spiderPcPv: 0, spiderMobilePv: 0 });
    return {
      code: 200,
      updatedAt: new Date().toISOString(),
      metrics: { pv: metrics.pv || 0, ip: ipCount, normal: metrics.normal || 0, spider: metrics.spider || 0, urls: urlCount, search: metrics.search || 0, errors: metrics.errors || 0 },
      device: deviceSummary(rangeDeviceTotals, input.visitorType),
      dropped: Number(droppedValue) || 0,
      trend: dateList.map(date => Object.assign({ date, pv: 0, ip: 0, normal: 0, spider: 0, search: 0 }, trendMap[date] || {})),
      visitorPie: [
        { name: '普通用户', value: Number(metrics.normal || 0) },
        { name: '蜘蛛', value: Number(metrics.spider || 0) },
      ].filter(item => item.value > 0),
      spiderPie: spiderPie.map(row => ({ name: row._id, value: row.value })),
      pageRows: pageRows.map(row => ({ path: row.key, domain: row.siteKey, total: row.pv, normal: row.normalPv, spider: row.spiderPv, last: row.lastAt })),
    };
  }

  async dashboard(body) {
    const input = Object.assign({}, body || {}, { dateFrom: today(), dateTo: today() });
    const [ metrics, errorRows ] = await Promise.all([
      this.siteAggregate(today(), input),
      this.ctx.model.StatsDaily.find(this.match('error', input)).sort({ pv: -1 }).limit(10).maxTimeMS(5000).lean(),
    ]);
    return {
      code: 200,
      updatedAt: new Date().toISOString(),
      metrics: {
        pv: metrics.pv || 0,
        normal: metrics.normal || 0,
        spider: metrics.spider || 0,
        errors: metrics.errors || 0,
      },
      device: deviceSummary(metrics, 'all'),
      errorRows: errorRows.map(row => this.formatRow('error', row, 0)),
    };
  }

  async sites(body) {
    const keyword = String(body && body.keyword || '').trim().slice(0, 120);
    const match = keyword ? { link: new RegExp(escapeRegExp(keyword), 'i') } : {};
    const rows = await this.ctx.model.Domain.find(match)
      .select({ link: 1, isHttps: 1, _id: 0 })
      .sort({ link: 1 })
      .limit(2000)
      .lean();
    return {
      code: 200,
      rows: rows.map(row => ({
        label: String(row.link || ''),
        value: String(row.link || '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/:\d+$/, ''),
      })).filter(row => row.value),
    };
  }

  async list(kind, body) {
    const dimension = { spider: 'spider', page: 'url', ip: 'ip', referer: 'search', error: 'error' }[kind];
    if (!dimension) return { code: 200, total: 0, rows: [] };
    const input = body || {};
    const match = this.match(dimension, input);
    const keyword = String(input.keyword || '').trim().slice(0, 120);
    if (keyword.length >= 2) {
      const reg = new RegExp(escapeRegExp(keyword), 'i');
      match.$or = [ { key: reg }, { lastUa: reg }, { lastIp: reg }, { sourceDomain: reg } ];
    }
    const sortAliases = {
      total: 'pv', count: 'pv', normal: 'normalPv', spider: 'spiderPv',
      last: 'lastAt', first: 'firstAt', name: 'key', path: 'key', ip: 'key',
      engine: 'key', domain: 'siteKey', urls: 'uniqueUrls',
    };
    const requestedSort = String(input.sortField || 'pv');
    const sortField = sortAliases[requestedSort] || requestedSort;
    const allowedSort = [ 'pv', 'normalPv', 'spiderPv', 'lastAt', 'firstAt', 'key', 'siteKey', 'uniqueIp', 'uniqueUrls' ];
    const sort = {};
    sort[allowedSort.indexOf(sortField) === -1 ? 'pv' : sortField] = String(input.sortOrder || 'ascending') === 'ascending' ? 1 : -1;
    const pageSize = Math.min(100, Math.max(1, Number(input.pageSize) || 20));
    const page = Math.min(1000, Math.max(1, Number(input.page) || 1));
    const visitorType = [ 'normal', 'spider' ].indexOf(String(input.visitorType || '')) !== -1
      ? String(input.visitorType) : 'all';
    const pipeline = [
      { $match: match },
      { $sort: { lastAt: -1 } },
      { $group: {
        _id: { key: '$key', siteKey: '$siteKey' },
        pv: { $sum: '$pv' },
        normalPv: { $sum: '$normalPv' },
        spiderPv: { $sum: '$spiderPv' },
        searchPv: { $sum: '$searchPv' },
        errorPv: { $sum: '$errorPv' },
        uniqueIp: { $sum: '$uniqueIp' },
        uniqueUrls: { $sum: '$uniqueUrls' },
        firstAt: { $min: '$firstAt' },
        lastAt: { $max: '$lastAt' },
        lastIp: { $first: '$lastIp' },
        lastUa: { $first: '$lastUa' },
        lastUrl: { $first: '$lastUrl' },
        sourceDomain: { $first: '$sourceDomain' },
        landingPath: { $first: '$landingPath' },
        visitorType: { $first: '$visitorType' },
        statusCode: { $first: '$statusCode' },
      } },
      { $project: {
        _id: 0, key: '$_id.key', siteKey: '$_id.siteKey', pv: 1, normalPv: 1, spiderPv: 1,
        searchPv: 1, errorPv: 1, uniqueIp: 1, uniqueUrls: 1, firstAt: 1, lastAt: 1,
        lastIp: 1, lastUa: 1, lastUrl: 1, sourceDomain: 1, landingPath: 1,
        visitorType: 1, statusCode: 1,
      } },
    ];
    if (visitorType !== 'all') {
      pipeline.push({ $addFields: { pv: visitorType === 'normal' ? '$normalPv' : '$spiderPv' } });
      pipeline.push({ $match: { pv: { $gt: 0 } } });
    }
    pipeline.push({ $facet: {
      metadata: [ { $count: 'total' } ],
      rows: [ { $sort: sort }, { $skip: (page - 1) * pageSize }, { $limit: pageSize } ],
    } });

    const [ aggregateResult, summary ] = await Promise.all([
      this.ctx.model.StatsDaily.aggregate(pipeline).allowDiskUse(true),
      this.listSummary(kind, input),
    ]);
    const result = aggregateResult[0] || { metadata: [], rows: [] };
    const total = result.metadata[0] ? Number(result.metadata[0].total || 0) : 0;
    const rows = result.rows || [];
    const formattedRows = rows.map(row => this.formatRow(kind, row));
    const response = Object.assign({
      code: 200,
      total,
      page,
      pageSize,
      rows: formattedRows,
    }, summary);
    if (kind === 'spider' && formattedRows.length) this.ensureSpiderCharts(response, formattedRows);
    return response;
  }

  ensureSpiderCharts(response, rows) {
    const totals = {};
    rows.forEach(row => {
      const name = String(row.name || row.type || '其他蜘蛛');
      totals[name] = (totals[name] || 0) + Number(row.count || 0);
    });
    const fallbackPie = Object.keys(totals)
      .map(name => ({ name, value: totals[name] }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
    if (!Array.isArray(response.spiderPie) || !response.spiderPie.length) response.spiderPie = fallbackPie;

    const trend = Array.isArray(response.spiderTrend) ? response.spiderTrend : [];
    const hasTrendValue = trend.some(item => Object.keys(item || {}).some(key => key !== 'date' && Number(item[key]) > 0));
    if (!hasTrendValue && fallbackPie.length) {
      const latestDate = rows.reduce((value, row) => {
        const date = String(row.last || '').slice(0, 10);
        return date > value ? date : value;
      }, '') || today();
      const point = { date: latestDate };
      fallbackPie.forEach(item => { point[item.name] = item.value; });
      response.spiderTrend = [ point ];
    }
  }

  async listSummary(kind, body) {
    if (kind !== 'spider' && kind !== 'referer') return {};
    const dimension = kind === 'spider' ? 'spider' : 'search';
    const range = dateRange(body);
    const separator = '\u0001';
    const keyExpression = kind === 'spider' ? '$key' : { $arrayElemAt: [ { $split: [ '$key', separator ] }, 0 ] };
    const todayInput = Object.assign({}, body || {}, { dateFrom: today(), dateTo: today() });
    const summaryInput = kind === 'spider' ? (body || {}) : todayInput;
    const [ trendRows, todayRows ] = await Promise.all([
      this.ctx.model.StatsDaily.aggregate([
        { $match: this.match(dimension, body || {}) },
        { $group: { _id: { date: '$date', key: keyExpression }, count: { $sum: '$pv' } } },
        { $sort: { '_id.date': 1 } },
      ]),
      this.ctx.model.StatsDaily.aggregate([
        { $match: this.match(dimension, summaryInput) },
        { $group: { _id: keyExpression, count: { $sum: '$pv' } } },
        { $sort: { count: -1 } },
      ]),
    ]);
    const trendMap = {};
    trendRows.forEach(row => {
      const date = row._id.date;
      if (!trendMap[date]) trendMap[date] = { date };
      trendMap[date][row._id.key || '其他'] = Number(row.count || 0);
    });
    const trend = [];
    for (let cursor = new Date(range.from + 'T00:00:00+08:00'); cursor <= new Date(range.to + 'T00:00:00+08:00'); cursor = new Date(cursor.getTime() + 86400000)) {
      const date = new Date(cursor.getTime() + 8 * 3600000).toISOString().slice(0, 10);
      trend.push(trendMap[date] || { date });
    }
    if (kind === 'spider') {
      return {
        spiderTrend: trend,
        spiderPie: todayRows.map(row => ({ name: row._id || '其他蜘蛛', value: Number(row.count || 0) })),
      };
    }
    return {
      refererTrend: trend,
      refererRows: todayRows.map(row => ({ engine: row._id || '其他搜索引擎', count: Number(row.count || 0) })),
    };
  }

  formatRow(kind, row) {
    if (kind === 'spider') return { name: row.key, ua: row.lastUa, ip: row.lastIp, count: row.pv, urls: row.uniqueUrls || 0, last: row.lastAt, type: row.key, domain: row.siteKey };
    if (kind === 'page') return { path: row.key, domain: row.siteKey, total: row.pv, normal: row.normalPv, spider: row.spiderPv, ip: row.uniqueIp || 0, last: row.lastAt };
    if (kind === 'ip') return { ip: row.key, domain: row.siteKey, count: row.pv, urls: row.uniqueUrls || 0, type: row.spiderPv > 0 && row.normalPv === 0 ? '蜘蛛' : '普通用户', first: row.firstAt, last: row.lastAt, ua: row.lastUa };
    if (kind === 'referer') {
      const parts = row.key.split('\u0001');
      return { engine: parts[0] || '', source: row.sourceDomain || parts[1] || '', landing: row.landingPath || parts[2] || '', count: row.pv, ip: row.uniqueIp || 0, last: row.lastAt, domain: row.siteKey };
    }
    return { status: row.statusCode, path: row.key.split('\u0001')[1] || row.key, domain: row.siteKey, count: row.pv, last: row.lastAt };
  }
}

module.exports = StatsAggregator;
