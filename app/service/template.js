'use strict';

const Service = require('egg').Service;
const defaultRows = require('../common_data/templates.json');

const MAX_LIMIT = 500;
const MAX_IMPORT = 5000;
const OPTIONS_DB_TIMEOUT = 1500;
const ALLOWED_SORT_FIELDS = [ 'siteType', 'label', 'value', 'disabled', 'sort', 'createdAt' ];

function text(value, maxLength) {
  return String(value === undefined || value === null ? '' : value).trim().slice(0, maxLength);
}

function number(value, fallback) {
  if (value === '' || value === null || value === undefined) return fallback;
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function boolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function templateKey(row) {
  return `${row.siteType}|${row.value}`;
}

function settleWithTimeout(task, timeout) {
  return new Promise(resolve => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, timeout: true, error: new Error('template database request timed out') });
    }, timeout);

    Promise.resolve()
      .then(task)
      .then(value => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ ok: true, value });
      })
      .catch(error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ ok: false, timeout: false, error });
      });
  });
}

function failureReason(result) {
  if (result.timeout) return 'timeout';
  return result.error && (result.error.code || result.error.name) || 'unknown';
}

function normalizeRow(input = {}, partial = false) {
  const row = {};
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'siteType')) {
    row.siteType = number(input.siteType, NaN);
    if (!Number.isInteger(row.siteType) || row.siteType < 0 || row.siteType > 999) {
      return { error: 'siteType 必须是 0 到 999 的整数' };
    }
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'label')) {
    row.label = text(input.label, 200);
    if (!row.label) return { error: '模板名称不能为空' };
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'value')) {
    row.value = text(input.value, 120);
    if (!row.value || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(row.value)) {
      return { error: '模板值只能使用字母、数字、点、下划线和短横线' };
    }
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'imageView')) {
    row.imageView = text(input.imageView, 1000);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'disabled')) {
    row.disabled = boolean(input.disabled, false);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'sort')) {
    row.sort = number(input.sort, 0);
    if (!Number.isFinite(row.sort) || row.sort < -100000000 || row.sort > 100000000) {
      return { error: '排序值范围不正确' };
    }
  }
  return { row };
}

class TemplateService extends Service {
  async ensureSeeded() {
    if (this.app.templateSeedPromise) return this.app.templateSeedPromise;

    this.app.templateSeedPromise = (async () => {
      const model = this.ctx.model.Template;
      const exists = await model.exists({});
      if (exists) return;

      const rows = defaultRows.map(item => normalizeRow(item).row).filter(Boolean);
      if (!rows.length) return;
      try {
        await model.insertMany(rows, { ordered: false });
      } catch (error) {
        // 多 Worker 首次同时初始化时，唯一索引可能让部分插入报重复，已有数据可正常使用。
        if (!error || !error.writeErrors) throw error;
      }
    })();

    try {
      await this.app.templateSeedPromise;
    } finally {
      this.app.templateSeedPromise = null;
    }
  }

  buildQuery(params = {}) {
    const query = {};
    const siteType = params.siteType === '' || params.siteType === undefined ? null : number(params.siteType, NaN);
    if (Number.isInteger(siteType)) query.siteType = siteType;
    if (params.disabled !== '' && params.disabled !== undefined) {
      const disabled = boolean(params.disabled, null);
      if (disabled !== null) query.disabled = disabled;
    }
    const keyword = text(params.keyword || params.search, 120);
    if (keyword) {
      const safeKeyword = escapeRegExp(keyword);
      query.$or = [
        { label: { $regex: safeKeyword, $options: 'i' } },
        { value: { $regex: safeKeyword, $options: 'i' } },
      ];
    }
    return query;
  }

  buildSort(params = {}) {
    const field = ALLOWED_SORT_FIELDS.indexOf(params.sortField) !== -1 ? params.sortField : 'sort';
    const direction = String(params.sortOrder || '').toLowerCase() === 'desc' ? -1 : 1;
    return { [field]: direction, label: 1, _id: 1 };
  }

  async list(params = {}) {
    const defaultList = this.buildDefaultListResponse(params);
    const seedResult = await settleWithTimeout(() => this.ensureSeeded(), OPTIONS_DB_TIMEOUT);
    if (!seedResult.ok) {
      this.ctx.logger.warn('[template] template initialization failed, returning default template list (reason=%s)', failureReason(seedResult));
      return defaultList;
    }

    const query = this.buildQuery(params);
    const all = params.all === true || params.all === 'true';
    const requestedLimit = Number(params.limit) || 20;
    const limit = all ? 10000 : Math.min(MAX_LIMIT, Math.max(1, requestedLimit));
    const page = Math.max(1, Number(params.page) || 1);
    const queryResult = await settleWithTimeout(() => Promise.all([
      this.ctx.model.Template.find(query)
        .sort(this.buildSort(params))
        .skip(all ? 0 : (page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      all ? Promise.resolve(0) : this.ctx.model.Template.countDocuments(query).exec(),
    ]), OPTIONS_DB_TIMEOUT);
    if (!queryResult.ok) {
      this.ctx.logger.warn('[template] template list query failed, returning default template list (reason=%s)', failureReason(queryResult));
      return defaultList;
    }

    const rows = queryResult.value[0] || [];
    const count = queryResult.value[1] || 0;
    return { code: 200, data: { data: rows, rows, count: all ? rows.length : count, page, limit } };
  }

  buildDefaultListRows(params = {}) {
    const siteType = params.siteType === '' || params.siteType === undefined
      ? null
      : number(params.siteType, NaN);
    const disabled = params.disabled === '' || params.disabled === undefined
      ? null
      : boolean(params.disabled, null);
    const keyword = text(params.keyword || params.search, 120).toLowerCase();

    const rows = defaultRows.map(item => normalizeRow(item).row).filter(Boolean).filter(row => {
      if (Number.isInteger(siteType) && row.siteType !== siteType) return false;
      if (disabled !== null && row.disabled !== disabled) return false;
      if (keyword
        && row.label.toLowerCase().indexOf(keyword) === -1
        && row.value.toLowerCase().indexOf(keyword) === -1
      ) return false;
      return true;
    });

    const sort = this.buildSort(params);
    rows.sort((left, right) => {
      const fields = Object.keys(sort);
      for (let i = 0; i < fields.length; i += 1) {
        const field = fields[i];
        const direction = sort[field];
        const leftValue = left[field] === undefined ? '' : left[field];
        const rightValue = right[field] === undefined ? '' : right[field];
        if (leftValue === rightValue) continue;
        if (field === 'siteType' || field === 'sort') {
          return (Number(leftValue) - Number(rightValue)) * direction;
        }
        return String(leftValue).localeCompare(String(rightValue)) * direction;
      }
      return 0;
    });
    return rows;
  }

  buildDefaultListResponse(params = {}) {
    const all = params.all === true || params.all === 'true';
    const requestedLimit = Number(params.limit) || 20;
    const limit = all ? 10000 : Math.min(MAX_LIMIT, Math.max(1, requestedLimit));
    const page = Math.max(1, Number(params.page) || 1);
    const allRows = this.buildDefaultListRows(params);
    const rows = all ? allRows : allRows.slice((page - 1) * limit, page * limit);
    return {
      code: 200,
      data: { data: rows, rows, count: allRows.length, page, limit },
    };
  }

  async options() {
    const defaultOptionRows = this.buildOptionRows([]);
    const seedResult = await settleWithTimeout(() => this.ensureSeeded(), OPTIONS_DB_TIMEOUT);
    if (!seedResult.ok) {
      this.ctx.logger.warn('[template] template initialization failed, returning default template options (reason=%s)', failureReason(seedResult));
      return { code: 200, data: defaultOptionRows };
    }

    const queryResult = await settleWithTimeout(() => this.ctx.model.Template.find({})
      .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
      .limit(100)
      .select('siteType imageView label value disabled sort')
      .lean()
      .exec(), OPTIONS_DB_TIMEOUT);
    if (!queryResult.ok) {
      this.ctx.logger.warn('[template] template query failed, returning default template options (reason=%s)', failureReason(queryResult));
      return { code: 200, data: defaultOptionRows };
    }

    return { code: 200, data: this.buildOptionRows(queryResult.value) };
  }

  buildOptionRows(latestRows) {
    const merged = [];
    const positions = {};

    defaultRows.forEach(item => {
      const normalized = normalizeRow(item);
      if (normalized.error) return;
      const key = templateKey(normalized.row);
      positions[key] = merged.length;
      merged.push(normalized.row);
    });

    (Array.isArray(latestRows) ? latestRows : []).forEach(item => {
      const normalized = normalizeRow(item);
      if (normalized.error) return;
      const key = templateKey(normalized.row);
      if (Object.prototype.hasOwnProperty.call(positions, key)) {
        merged[positions[key]] = normalized.row;
      } else {
        positions[key] = merged.length;
        merged.push(normalized.row);
      }
    });

    const rows = merged
      .filter(item => !item.disabled)
      .sort((left, right) => left.siteType - right.siteType || left.sort - right.sort || left.label.localeCompare(right.label));
    return rows;
  }

  async create(input = {}) {
    const normalized = normalizeRow(input);
    if (normalized.error) return { code: -1, message: normalized.error };
    try {
      const row = await this.ctx.model.Template.create(normalized.row);
      return { code: 200, data: row };
    } catch (error) {
      if (error && error.code === 11000) return { code: -1, message: '同一站点下模板值已经存在' };
      throw error;
    }
  }

  async update(id, input = {}) {
    if (!/^[a-f\d]{24}$/i.test(String(id || ''))) return { code: -1, message: '模板 ID 无效' };
    const normalized = normalizeRow(input, true);
    if (normalized.error) return { code: -1, message: normalized.error };
    try {
      const row = await this.ctx.model.Template.findByIdAndUpdate(
        id,
        { $set: normalized.row },
        { new: true, runValidators: true }
      ).lean();
      return row ? { code: 200, data: row } : { code: 404, message: '模板不存在' };
    } catch (error) {
      if (error && error.code === 11000) return { code: -1, message: '同一站点下模板值已经存在' };
      throw error;
    }
  }

  async remove(id) {
    if (!/^[a-f\d]{24}$/i.test(String(id || ''))) return { code: -1, message: '模板 ID 无效' };
    const result = await this.ctx.model.Template.findByIdAndDelete(id);
    return result ? { code: 200, message: '删除成功' } : { code: 404, message: '模板不存在' };
  }

  parseImport(input) {
    let rows = input && input.rows !== undefined ? input.rows : input && input.content;
    if (typeof rows === 'string') {
      try {
        rows = JSON.parse(rows.replace(/^\uFEFF/, ''));
      } catch (error) {
        return { error: 'JSON 格式错误' };
      }
    }
    if (!Array.isArray(rows)) return { error: '导入内容必须是数组' };
    if (rows.length > MAX_IMPORT) return { error: `单次最多导入 ${MAX_IMPORT} 条模板` };
    return { rows };
  }

  async importRows(input = {}) {
    await this.ensureSeeded();
    const parsed = this.parseImport(input);
    if (parsed.error) return { code: -1, message: parsed.error };
    const operations = [];
    const keys = {};
    for (let i = 0; i < parsed.rows.length; i += 1) {
      const normalized = normalizeRow(parsed.rows[i]);
      if (normalized.error) return { code: -1, message: `第 ${i + 1} 条：${normalized.error}` };
      const key = templateKey(normalized.row);
      if (keys[key]) return { code: -1, message: `第 ${i + 1} 条与第 ${keys[key]} 条重复` };
      keys[key] = i + 1;
      operations.push({
        updateOne: {
          filter: { siteType: normalized.row.siteType, value: normalized.row.value },
          update: { $set: normalized.row },
          upsert: true,
        },
      });
    }
    if (operations.length) await this.ctx.model.Template.bulkWrite(operations, { ordered: true });
    return { code: 200, message: `成功导入 ${operations.length} 条模板`, data: { count: operations.length } };
  }

  async exportRows() {
    await this.ensureSeeded();
    const rows = await this.ctx.model.Template.find({})
      .sort({ siteType: 1, sort: 1, label: 1, _id: 1 })
      .select('siteType imageView label value disabled sort')
      .lean();
    return { code: 200, data: rows.map(row => ({
      siteType: row.siteType,
      imageView: row.imageView || '',
      label: row.label,
      value: row.value,
      disabled: Boolean(row.disabled),
      sort: Number(row.sort) || 0,
    })) };
  }
}

module.exports = TemplateService;
