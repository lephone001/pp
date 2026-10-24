'use strict';

const Service = require('egg').Service;
const control = require('../lib/statsControl');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const dateNow = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
// One atomic update per date/batch: workers never read-modify-write shared files.
const ACCUMULATE = `
if redis.call('HEXISTS', KEYS[1], 'all') == 0 then return 0 end
local batch = cjson.decode(ARGV[1])
for field, delta in pairs(batch) do
  local old = redis.call('HGET', KEYS[1], field)
  local row = old and cjson.decode(old) or {metrics={},device={},errorRows={}}
  for k,v in pairs(delta.metrics) do row.metrics[k] = (row.metrics[k] or 0) + v end
  for k,v in pairs(delta.device) do row.device[k] = (row.device[k] or 0) + v end
  for _,v in ipairs(delta.errorRows) do table.insert(row.errorRows, v) end
  table.sort(row.errorRows, function(a,b) return a.last > b.last end)
  while #row.errorRows > 10 do table.remove(row.errorRows) end
  row.updatedAt = ARGV[2]
  redis.call('HSET', KEYS[1], field, cjson.encode(row))
end
redis.call('EXPIRE', KEYS[1], 259200)
return 1`;

function empty() {
  return { metrics: { pv: 0, normal: 0, spider: 0, errors: 0 }, device: { pc: 0, mobile: 0, total: 0 }, errorRows: [] };
}

class StatsSummary extends Service {
  get dataDir() {
    return path.join(this.app.baseDir, 'app', 'local', '_data', 'stats');
  }

  filePath(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid statistics date');
    return path.join(this.dataDir, date, 'dashboard.json');
  }

  key(date) {
    return (this.app.config.stats.redisSummaryPrefix || 'stats:summary:') + date;
  }

  accumulate(days, event) {
      if (!event || !/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !event.siteKey || !event.path) return;
      const sites = days[event.date] || (days[event.date] = Object.create(null));
      // Full hostnames remain in detail records, not in per-worker counters.
      [ 'all' ].forEach(key => {
        const row = sites[key] || (sites[key] = empty());
        row.metrics.pv++;
        row.metrics[event.spiderType ? 'spider' : 'normal']++;
        const mobile = event.device === 'mobile' || (!event.device && /mobile|android|iphone|ipad/i.test(event.ua || ''));
        row.device[mobile ? 'mobile' : 'pc']++;
        row.device.total++;
        if (event.status >= 400) {
          row.metrics.errors++;
          row.errorRows.push({ status: event.status, domain: event.siteKey, path: event.path, count: 1, last: new Date(event.timestamp).toISOString() });
          row.errorRows.sort((a, b) => b.last.localeCompare(a.last));
          row.errorRows.length = Math.min(10, row.errorRows.length);
        }
      });
  }

  async record(events) {
    const days = Object.create(null);
    events.forEach(event => this.accumulate(days, event));
    return this.recordTotals(days);
  }

  async recordTotals(days) {
    if (!control.enabled(this.app)) return;
    for (const date of Object.keys(days)) {
      if (!control.enabled(this.app)) break;
      if (!days[date].all) continue;
      const delta = JSON.stringify({ all: days[date].all });
      let saved = false;
      for (let attempt = 0; attempt < 100 && control.enabled(this.app); attempt++) {
        if (await this.app.redis.eval(ACCUMULATE, 1, this.key(date), delta, new Date().toISOString())) {
          saved = true;
          break;
        }
        await this.restoreTotals(date);
      }
      if (!saved && control.enabled(this.app)) throw new Error('Statistics initialization timed out');
    }
  }

  async restoreTotals(date) {
    const redis = this.app.redis;
    const key = this.key(date);
    const lockKey = key + ':restore';
    const token = crypto.randomBytes(16).toString('hex');
    if (await redis.set(lockKey, token, 'NX', 'EX', 30) !== 'OK') {
      await new Promise(resolve => setTimeout(resolve, 100));
      return;
    }
    try {
      // Recheck after taking the lock: another worker may have restored it.
      if (await redis.hexists(key, 'all')) return;
      let seed = empty();
      try {
        const data = JSON.parse(await fs.readFile(this.filePath(date), 'utf8'));
        if (data.date === date && data.sites && data.sites.all) seed = data.sites.all;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (!control.enabled(this.app)) return;
      await redis.eval(`
        if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
        redis.call('HSETNX', KEYS[1], 'all', ARGV[2])
        redis.call('EXPIRE', KEYS[1], 259200)
        return 1`, 2, key, lockKey, token, JSON.stringify(seed));
    } finally {
      await redis.eval('if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end', 1, lockKey, token);
    }
  }

  async cleanup() {
    await fs.mkdir(this.dataDir, { recursive: true });
    const root = await fs.realpath(this.dataDir);
    const cutoff = new Date(Date.now() + 8 * 3600000 - 29 * 86400000).toISOString().slice(0, 10);
    for (const entry of await fs.readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(entry.name) || entry.name >= cutoff) continue;
      const target = path.join(root, entry.name);
      // Never follow a symlink/junction outside this dedicated statistics directory.
      const resolved = await fs.realpath(target);
      if (resolved !== target || path.dirname(resolved) !== root) continue;
      await fs.rmdir(target, { recursive: true });
    }
  }

  async snapshot() {
    if (!control.enabled(this.app)) return;
    await this.cleanup();
    if (!this.app.redis) return;
    // Flushes can cross midnight; finish yesterday's file as well.
    await this.snapshotDate(new Date(Date.now() + 8 * 3600000 - 86400000).toISOString().slice(0, 10));
    await this.snapshotDate(dateNow());
  }

  async snapshotDate(date) {
    if (!control.enabled(this.app)) return;
    let rows = await this.app.redis.hgetall(this.key(date));
    // Keep the last good file during Redis restarts or before the first flush.
    if (!rows || !rows.all) {
      rows = { all: JSON.stringify(Object.assign(empty(), { updatedAt: new Date().toISOString() })) };
    }
    const sites = Object.create(null);
    Object.keys(rows).forEach(key => {
      const row = JSON.parse(rows[key]);
      row.errorRows = Array.isArray(row.errorRows) ? row.errorRows : [];
      sites[key] = row;
    });
    // Reconcile legacy daily totals in the background, never in dashboard().
    // Redis totals started at deployment; Mongo totals also include earlier visits.
    // These overlap, so use maxima per site instead of adding both sources.
    let previous;
    try {
      previous = JSON.parse(await fs.readFile(this.filePath(date), 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const merge = (key, incoming) => {
      const row = sites[key] || (sites[key] = empty());
      for (const group of [ 'metrics', 'device' ]) {
        for (const name of Object.keys(incoming[group] || {})) {
          row[group][name] = Math.max(Number(row[group][name]) || 0, Number(incoming[group][name]) || 0);
        }
      }
      if (!row.updatedAt || incoming.updatedAt > row.updatedAt) row.updatedAt = incoming.updatedAt;
    };
    if (previous && previous.date === date) {
      Object.keys(previous.sites || {}).forEach(key => merge(key, previous.sites[key]));
    }
    const model = this.ctx.model && this.ctx.model.StatsDaily;
    if (model) {
      try {
        const totals = await model.find({ dimension: 'site', date })
          .select('siteKey pv normalPv spiderPv errorPv pcPv mobilePv updatedAt')
          .maxTimeMS(5000).lean();
        for (const item of totals) {
          merge('site:' + item.siteKey, {
            metrics: { pv: item.pv, normal: item.normalPv, spider: item.spiderPv, errors: item.errorPv },
            device: { pc: item.pcPv, mobile: item.mobilePv, total: (Number(item.pcPv) || 0) + (Number(item.mobilePv) || 0) },
            updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : null,
          });
        }
      } catch (error) {
        this.ctx.logger.warn('[stats] daily totals reconciliation failed: %s', error.message);
      }
    }
    const total = empty();
    for (const key of Object.keys(sites).filter(key => key.startsWith('site:'))) {
      for (const group of [ 'metrics', 'device' ]) {
        for (const name of Object.keys(total[group])) total[group][name] += Number(sites[key][group][name]) || 0;
      }
      if (!total.updatedAt || sites[key].updatedAt > total.updatedAt) total.updatedAt = sites[key].updatedAt;
    }
    merge('all', total);
    const file = this.filePath(date);
    if (!control.enabled(this.app)) return;
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = file + '.' + process.pid + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
    try {
      await fs.writeFile(temp, JSON.stringify({ date, sites }), 'utf8');
      await fs.rename(temp, file);
    } finally {
      await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
  }

  async dashboard(body) {
    let data;
    try {
      data = JSON.parse(await fs.readFile(this.filePath(dateNow()), 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const key = body && body.site && body.site !== 'all' ? 'site:' + body.site : 'all';
    const row = data && data.date === dateNow() && data.sites[key];
    return Object.assign({ code: 200, source: 'local-summary', initialized: Boolean(row), updatedAt: row && row.updatedAt || null }, row || empty());
  }
}

module.exports = StatsSummary;
