'use strict';

const Service = require('egg').Service;
const scheduleState = require('../lib/collectScheduleState');

class MovieCollectSchedulerService extends Service {
  async enabledSources(siteType) {
    try {
      const rows = await scheduleState.sources(this.ctx);
      if (!rows) return [];
      return rows.filter(row => Number(row.siteType) === siteType);
    } catch (error) {
      // Connection may drop between readyState inspection and the actual query.
      const app = this.ctx.app;
      if (!app.movieScheduleWarnAt || Date.now() - app.movieScheduleWarnAt >= 300000) {
        app.movieScheduleWarnAt = Date.now();
        this.ctx.logger.warn('[movie-collector] schedule discovery skipped: %s', error.message);
      }
      return [];
    }
  }

  nowParts(timeZone = process.env.MOVIE_COLLECT_TIMEZONE || 'Asia/Shanghai') {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const values = {};
    parts.forEach(item => { if (item.type !== 'literal') values[item.type] = item.value; });
    return {
      date: `${values.year}-${values.month}-${values.day}`,
      time: `${values.hour}:${values.minute}`,
      minuteOfDay: Number(values.hour) * 60 + Number(values.minute),
    };
  }

  async tick() {
    const { date, time, minuteOfDay } = this.nowParts();
    const sources = await this.enabledSources(11);
    if (!sources.length || this.ctx.model.CollectSource.db.readyState !== 1) {
      return { date, time, matched: sources.length, created: 0, skipped: sources.length };
    }
    let created = 0;
    let skipped = 0;

    for (const source of sources) {
      try {
        const scheduleMatch = String(source.scheduleTime || '03:00').match(/^(\d{1,2}):(\d{1,2})$/);
        const scheduleMinute = scheduleMatch ? Number(scheduleMatch[1]) * 60 + Number(scheduleMatch[2]) : 180;
        // 每分钟调度可能不是在整分启动，允许 5 分钟的补偿窗口，避免服务重启或调度抖动导致漏采。
        if (minuteOfDay < scheduleMinute || minuteOfDay - scheduleMinute > 5) continue;
        await this.ctx.service.collectSource.recoverStaleTasks(source._id);
        const active = await this.ctx.model.CollectTask.findOne({
          sourceId: source._id,
          status: { $in: [ 'pending', 'running', 'paused' ] },
        }).select('_id status').lean();
        const claimed = await this.ctx.model.CollectSource.findOneAndUpdate(
          { _id: source._id, siteType: 11, status: 1, scheduleEnabled: 1, scheduleLastDate: { $ne: date } },
          { $set: { scheduleLastDate: date } },
          { new: true }
        ).lean();
        if (!claimed) continue;
        if (active) {
          skipped += 1;
          this.ctx.logger.info('[movie-collector] scheduled collection skipped for %s: task %s is %s', source.name, active._id, active.status);
          continue;
        }
        const result = await this.ctx.service.collectSource.createTask({
          sourceId: String(source._id),
          siteType: source.siteType,
          mode: 'incremental',
          pages: source.schedulePages || 10,
        });
        if (result && result.code === 200) created += 1;
        else {
          skipped += 1;
          this.ctx.logger.warn('[%s-collector] scheduled collection failed for %s: %s', Number(source.siteType) === 8 ? 'video' : 'movie', source.name, result && result.message || 'unknown error');
        }
      } catch (error) {
        skipped += 1;
        this.ctx.logger.error('[%s-collector] scheduled collection error for %s: %s', Number(source.siteType) === 8 ? 'video' : 'movie', source.name, error.stack || error.message);
      }
    }
    return { date, time, matched: sources.length, created, skipped };
  }

  async runVideoDaily() {
    const { date, time } = this.nowParts(process.env.VIDEO_COLLECT_TIMEZONE || 'Asia/Shanghai');
    const sources = await this.enabledSources(8);
    if (!sources.length || this.ctx.model.CollectSource.db.readyState !== 1) {
      return { date, time, matched: sources.length, created: 0, skipped: sources.length };
    }
    let created = 0;
    let skipped = 0;

    for (const source of sources) {
      try {
        await this.ctx.service.collectSource.recoverStaleTasks(source._id);
        const active = await this.ctx.model.CollectTask.findOne({
          sourceId: source._id,
          status: { $in: [ 'pending', 'running', 'paused' ] },
        }).select('_id status').lean();
        const claimed = await this.ctx.model.CollectSource.findOneAndUpdate(
          { _id: source._id, siteType: 8, status: 1, scheduleEnabled: 1, scheduleLastDate: { $ne: date } },
          { $set: { scheduleLastDate: date } },
          { new: true }
        ).lean();
        if (!claimed) continue;
        if (active) {
          skipped += 1;
          this.ctx.logger.info('[video-collector] daily collection skipped for %s: task %s is %s', source.name, active._id, active.status);
          continue;
        }

        // 只传采集源，让 createTask 使用默认采集参数：增量、第一页、10 页、重试 3 次。
        const result = await this.ctx.service.collectSource.createTask({
          sourceId: String(source._id),
          siteType: 8,
        });
        if (result && result.code === 200) created += 1;
        else {
          skipped += 1;
          this.ctx.logger.warn('[video-collector] daily collection failed for %s: %s', source.name, result && result.message || 'unknown error');
        }
      } catch (error) {
        skipped += 1;
        this.ctx.logger.error('[video-collector] daily collection error for %s: %s', source.name, error.stack || error.message);
      }
    }

    this.ctx.logger.info('[video-collector] daily collection finished at %s: matched=%s created=%s skipped=%s', time, sources.length, created, skipped);
    return { date, time, matched: sources.length, created, skipped };
  }
}

module.exports = MovieCollectSchedulerService;
