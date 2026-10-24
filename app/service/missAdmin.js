'use strict';

const Service = require('egg').Service;

const LEGACY_PROVINCES = new Map();
try {
  const allCityList = require('./datajson/plugins/city');
  allCityList.forEach(group => (group.province || []).forEach(item => {
    LEGACY_PROVINCES.set(String(item.id), {
      id: Number(item.id),
      name: item.name,
      copyid: item.copyid,
    });
  }));
} catch (error) {
  // 城市插件仅用于兼容旧的 provinceId 数据，插件不可用时不影响后台城市管理。
}

const MISS_FIELDS = [
  'title', 'provinceId', 'categoryId', 'cityId', 'up_uid', 'up_username', 'pay_view', 'type', 'copyid',
  'bust', 'height', 'weight', 'missType', 'job', 'remarks', 'overview', 'status', 'image_list', 'video_list', 'price',
  'contact_information', 'isShowInfoContent', 'service', 'environment', 'service_time', 'safety_assessment',
  'num', 'age', 'figure', 'info_from', 'detail_address', 'content', 'view', 'isHot', 'missPass', 'isTop',
  'time', 'star', 'bad', 'tags',
];

const LEADER_FIELDS = [
  'leaderId', 'leaderUserName', 'leaderName', 'leaderHeader', 'leaderCity',
  'leaderRz', 'leaderCj', 'leaderScore', 'leaderDescription', 'leaderSort',
  'leaderStatus', 'status', 'recordType',
];

function numberOrUndefined(value) {
  if (value === '' || value === null || value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function listValue(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  if (!value) return [];
  return String(value).split(/[\r\n,，|]+/).map(item => item.trim())
    .filter(Boolean);
}

function cleanCityName(value) {
  return String(value || '')
    .replace(/[\u180B-\u180D\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim();
}

function cityIdentity(item) {
  if (!item) return '';
  if (item.id !== undefined && item.id !== null && item.id !== '') return String(item.id);
  if (item.copyid !== undefined && item.copyid !== null && item.copyid !== '') return String(item.copyid);
  return String(item._id || '');
}

function cityParentId(item) {
  if (item && item.parentId !== undefined && item.parentId !== null && String(item.parentId).trim() !== '') {
    return String(item.parentId);
  }
  if (item && item.provinceId !== undefined && item.provinceId !== null && String(item.provinceId).trim() !== '') {
    return String(item.provinceId);
  }
  return '0';
}

function numericValue(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function citySort(a, b) {
  const sortDiff = numericValue(a.sort) - numericValue(b.sort);
  if (sortDiff) return sortDiff;
  const nameDiff = String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');
  if (nameDiff) return nameDiff;
  return String(a._id || '').localeCompare(String(b._id || ''));
}

function flattenCities(rawRows) {
  const actualRows = (rawRows || []).map(item => ({
    ...item,
    parentId: cityParentId(item),
    level: numericValue(item.level),
    isVirtual: false,
  }));
  const actualKeys = new Set(actualRows.map(cityIdentity));
  const legacyParentIds = new Set(actualRows
    .filter(item => (!item.parentId || item.parentId === String(item.provinceId || '')) && item.provinceId !== undefined)
    .map(item => String(item.provinceId)));
  const virtualRows = [];
  legacyParentIds.forEach(parentId => {
    const legacy = LEGACY_PROVINCES.get(parentId);
    if (!legacy || actualKeys.has(parentId)) return;
    virtualRows.push({
      _id: `legacy-province-${parentId}`,
      id: legacy.id,
      name: legacy.name,
      copyid: legacy.copyid,
      provinceId: legacy.id,
      parentId: '0',
      level: 0,
      status: 1,
      isVirtual: true,
    });
  });
  const rows = virtualRows.concat(actualRows);
  const byKey = new Map(rows.map(item => [ cityIdentity(item), item ]));
  const parentMap = new Map();
  rows.forEach(item => {
    const parentId = item.isVirtual ? '0' : cityParentId(item);
    if (!parentMap.has(parentId)) parentMap.set(parentId, []);
    parentMap.get(parentId).push(item);
  });
  parentMap.forEach(items => items.sort(citySort));
  const visiting = new Set();
  const visited = new Set();
  const output = [];
  const visit = (item, level, parentName = '') => {
    const key = cityIdentity(item);
    if (visited.has(key) || visiting.has(key)) return;
    visiting.add(key);
    item.level = level;
    item.parentId = item.isVirtual ? '0' : cityParentId(item);
    item.parentName = parentName;
    output.push(item);
    (parentMap.get(key) || []).forEach(child => visit(child, level + 1, item.name));
    visiting.delete(key);
    visited.add(key);
  };
  (parentMap.get('0') || []).forEach(item => visit(item, 0));
  rows.forEach(item => {
    const parent = byKey.get(cityParentId(item));
    visit(item, numericValue(item.level), parent ? parent.name : '');
  });
  return output;
}

function cityQuery(id) {
  if (id === undefined || id === null || id === '') return null;
  const value = String(id);
  if (/^[a-f\d]{24}$/i.test(value)) return { _id: value };
  const number = Number(id);
  return Number.isFinite(number) ? { id: number } : { copyid: value };
}

function parseCityImport(input = {}) {
  let source = input.rows !== undefined ? input.rows : input.content;
  if (typeof source === 'string') {
    const text = source.trim();
    if (!text) return [];
    try {
      source = JSON.parse(text);
    } catch (error) {
      source = text.split(/[\r\n\u2028\u2029]+/).map(name => ({
        name,
        parentId: input.parentId || '0',
      }));
    }
  }
  if (source && !Array.isArray(source) && Array.isArray(source.rows)) source = source.rows;
  if (source && !Array.isArray(source) && Array.isArray(source.data)) source = source.data;
  return Array.isArray(source) ? source : [];
}

function cityExportRow(item) {
  return {
    id: item.id,
    name: cleanCityName(item.name),
    copyid: item.copyid === undefined || item.copyid === null ? '' : String(item.copyid),
    provinceId: item.provinceId,
    parentId: cityParentId(item),
    level: numericValue(item.level),
    sort: numericValue(item.sort),
    hot: Number(item.hot) === 1 ? 1 : 0,
    status: Number(item.status) === 0 ? 0 : 1,
  };
}

function cleanMiss(input = {}) {
  const data = {};
  MISS_FIELDS.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(input, key)) data[key] = input[key];
  });
  [ 'provinceId', 'categoryId', 'cityId', 'up_uid', 'pay_view', 'type', 'overview', 'status', 'isShowInfoContent', 'view', 'isHot', 'missPass', 'isTop', 'star', 'bad' ].forEach(key => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = numberOrUndefined(data[key]);
      if (value === undefined) delete data[key];
      else data[key] = value;
    }
  });
  if (Object.prototype.hasOwnProperty.call(data, 'tags')) data.tags = listValue(data.tags);
  return data;
}

function cleanLeader(input = {}) {
  const data = {};
  LEADER_FIELDS.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(input, key)) data[key] = input[key];
  });
  [ 'leaderId', 'leaderRz', 'leaderCj', 'leaderScore', 'leaderSort', 'leaderStatus', 'status' ].forEach(key => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = numberOrUndefined(data[key]);
      if (value === undefined) delete data[key];
      else data[key] = value;
    }
  });
  data.recordType = 'agent';
  return data;
}

class MissAdminService extends Service {
  async list(params = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const query = {};
    if (params.title) query.title = { $regex: String(params.title).trim(), $options: 'i' };
    if (params.categoryId !== undefined && params.categoryId !== '') query.categoryId = Number(params.categoryId);
    if (params.cityId !== undefined && params.cityId !== '') query.cityId = Number(params.cityId);
    if (params.status !== undefined && params.status !== '') query.status = Number(params.status);
    const [ rows, count, categories, cities ] = await Promise.all([
      this.ctx.model.Miss.find(query)
        .sort({ _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.ctx.model.Miss.countDocuments(query),
      this.ctx.model.MissCategory.find({}).sort({ name: 1, _id: -1 }).lean(),
      this.ctx.model.MissCity.find({}).sort({ provinceId: 1, name: 1, _id: 1 }).lean(),
    ]);
    const categoryMap = new Map(categories.map(item => [ String(item.id || item._id), item.name ]));
    const cityMap = new Map(cities.map(item => [ String(item.id || item._id), item.name ]));
    const normalized = rows.map(item => ({
      ...item,
      images: listValue(item.image_list),
      categoryName: categoryMap.get(String(item.categoryId || '')) || '',
      cityName: cityMap.get(String(item.cityId || '')) || '',
    }));
    return { code: 200, data: { data: normalized, rows: normalized, count, page, limit, categories, cities } };
  }

  async find(id) {
    let row;
    try {
      row = await this.ctx.model.Miss.findById(id).lean();
    } catch (error) {
      row = null;
    }
    return row ? { code: 200, data: row } : { code: 404, message: '美女信息不存在' };
  }

  async create(input, user = {}) {
    const data = cleanMiss(input);
    if (!data.title) return { code: -1, message: '标题不能为空' };
    if (!data.image_list) return { code: -1, message: '至少填写一张图片地址' };
    data.status = data.status === undefined ? 1 : data.status;
    data.missPass = data.missPass === undefined ? 1 : data.missPass;
    if (data.up_uid === undefined && user.id !== undefined) data.up_uid = Number(user.id);
    if (!data.up_username && user.username) data.up_username = user.username;
    const row = await this.ctx.model.Miss.create(data);
    return { code: 200, data: row, message: '创建成功' };
  }

  async update(id, input) {
    const updates = cleanMiss(input);
    if (!updates.title) return { code: -1, message: '标题不能为空' };
    if (!updates.image_list) return { code: -1, message: '至少填写一张图片地址' };
    const row = await this.ctx.model.Miss.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).lean();
    return row ? { code: 200, data: row, message: '保存成功' } : { code: 404, message: '美女信息不存在' };
  }

  async remove(id) {
    const row = await this.ctx.model.Miss.findByIdAndUpdate(id, { $set: { status: 0 } }, { new: true }).lean();
    return row ? { code: 200, message: '已删除' } : { code: 404, message: '美女信息不存在' };
  }

  async leaderList(params = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const query = { recordType: 'agent' };
    if (params.name) {
      const pattern = String(params.name).trim();
      query.$or = [
        { leaderName: { $regex: pattern, $options: 'i' } },
        { leaderUserName: { $regex: pattern, $options: 'i' } },
        { leaderCity: { $regex: pattern, $options: 'i' } },
      ];
    }
    if (params.status !== undefined && params.status !== '') query.leaderStatus = Number(params.status);
    const [ rows, count ] = await Promise.all([
      this.ctx.model.MissLeader.find(query)
        .sort({ leaderSort: -1, leaderScore: -1, leaderId: 1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.ctx.model.MissLeader.countDocuments(query),
    ]);
    return { code: 200, data: { data: rows, rows, count, page, limit } };
  }

  async leaderFind(id) {
    let row;
    try {
      row = await this.ctx.model.MissLeader.findOne({ _id: id, recordType: 'agent' }).lean();
    } catch (error) {
      row = null;
    }
    return row ? { code: 200, data: row } : { code: 404, message: '代理资料不存在' };
  }

  async leaderCreate(input = {}) {
    const data = cleanLeader(input);
    if (!data.leaderName) return { code: -1, message: '代理名称不能为空' };
    if (!data.leaderUserName) return { code: -1, message: '代理账号不能为空' };
    const duplicate = await this.ctx.model.MissLeader.findOne({
      recordType: 'agent',
      leaderUserName: data.leaderUserName,
    }).lean();
    if (duplicate) return { code: -1, message: '代理账号已存在' };
    if (data.leaderId === undefined) {
      const last = await this.ctx.model.MissLeader.findOne({ leaderId: { $exists: true } })
        .sort({ leaderId: -1 })
        .select('leaderId')
        .lean();
      data.leaderId = (Number(last && last.leaderId) || 0) + 1;
    }
    data.status = data.status === undefined ? 1 : data.status;
    data.leaderStatus = data.leaderStatus === undefined ? 1 : data.leaderStatus;
    const row = await this.ctx.model.MissLeader.create(data);
    return { code: 200, data: row, message: '代理创建成功' };
  }

  async leaderUpdate(id, input = {}) {
    const data = cleanLeader(input);
    if (!data.leaderName) return { code: -1, message: '代理名称不能为空' };
    if (!data.leaderUserName) return { code: -1, message: '代理账号不能为空' };
    const duplicate = await this.ctx.model.MissLeader.findOne({
      recordType: 'agent',
      leaderUserName: data.leaderUserName,
      _id: { $ne: id },
    }).lean();
    if (duplicate) return { code: -1, message: '代理账号已存在' };
    const row = await this.ctx.model.MissLeader.findOneAndUpdate(
      { _id: id, recordType: 'agent' },
      { $set: data },
      { new: true, runValidators: true },
    ).lean();
    return row ? { code: 200, data: row, message: '代理保存成功' } : { code: 404, message: '代理资料不存在' };
  }

  async leaderRemove(id) {
    const row = await this.ctx.model.MissLeader.findOneAndUpdate(
      { _id: id, recordType: 'agent' },
      { $set: { status: 0, leaderStatus: 0 } },
      { new: true },
    ).lean();
    return row ? { code: 200, message: '代理已删除' } : { code: 404, message: '代理资料不存在' };
  }

  async categoryList() {
    const rows = await this.ctx.model.MissCategory.find({}).sort({ isTop: -1, sort: 1, name: 1, _id: -1 }).lean();
    return { code: 200, data: { data: rows, rows, count: rows.length } };
  }

  async createCategory(input = {}) {
    const name = cleanCityName(input.name);
    if (!name) return { code: -1, message: '分类名称不能为空' };
    if (await this.ctx.model.MissCategory.findOne({ name })) return { code: -1, message: '分类名称已存在' };
    const last = await this.ctx.model.MissCategory.findOne({})
      .sort({ id: -1 })
      .select('id')
      .lean();
    const data = { id: (Number(last && last.id) || 0) + 1, name, copyid: input.copyid || '', status: Number(input.status) === 0 ? 0 : 1 };
    return { code: 200, data: await this.ctx.model.MissCategory.create(data), message: '创建成功' };
  }

  async updateCategory(id, input = {}) {
    const name = String(input.name || '').trim();
    if (!name) return { code: -1, message: '分类名称不能为空' };
    const duplicate = await this.ctx.model.MissCategory.findOne({ name, _id: { $ne: id } });
    if (duplicate) return { code: -1, message: '分类名称已存在' };
    const updates = { name, copyid: input.copyid || '', status: Number(input.status) === 0 ? 0 : 1 };
    const row = await this.ctx.model.MissCategory.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
    return row ? { code: 200, data: row, message: '保存成功' } : { code: 404, message: '分类不存在' };
  }

  async removeCategory(id) {
    const row = await this.ctx.model.MissCategory.findByIdAndUpdate(id, { $set: { status: 0 } }, { new: true }).lean();
    return row ? { code: 200, message: '已删除' } : { code: 404, message: '分类不存在' };
  }

  async cityList(params = {}) {
    const query = params.includeDisabled ? {} : { status: { $ne: 0 } };
    const rawRows = await this.ctx.model.MissCity.find(query)
      .sort({ parentId: 1, provinceId: 1, sort: 1, name: 1, _id: 1 })
      .lean();
    const rows = flattenCities(rawRows);
    return { code: 200, data: { data: rows, rows, tree: rows, count: rawRows.length } };
  }

  async exportCity() {
    const rawRows = await this.ctx.model.MissCity.find({})
      .sort({ parentId: 1, provinceId: 1, level: 1, sort: 1, name: 1, _id: 1 })
      .lean();
    const rows = flattenCities(rawRows).map(cityExportRow);
    return {
      code: 200,
      data: {
        type: 'miss_city',
        version: 1,
        exportedAt: new Date().toISOString(),
        rows,
        count: rows.length,
      },
    };
  }

  async createCity(input = {}) {
    const name = String(input.name || '').trim();
    if (!name) return { code: -1, message: '城市名称不能为空' };
    const parentId = String(input.parentId || '0');
    const rawRows = await this.ctx.model.MissCity.find({}).lean();
    const rows = flattenCities(rawRows);
    const parent = parentId === '0' ? null : rows.find(item => cityIdentity(item) === parentId);
    if (parentId !== '0' && !parent) return { code: -1, message: '上级地区不存在' };
    if (rows.some(item => !item.isVirtual && cityParentId(item) === parentId && cleanCityName(item.name) === name)) {
      return { code: -1, message: '同级城市名称已存在' };
    }
    const last = await this.ctx.model.MissCity.findOne({})
      .sort({ id: -1 })
      .select('id')
      .lean();
    const data = {
      id: (Number(last && last.id) || 0) + 1,
      name,
      copyid: String(input.copyid || '').trim(),
      provinceId: numericValue(input.provinceId, parent && parent.provinceId ? parent.provinceId : (parent && parent.id ? parent.id : 0)) || undefined,
      parentId,
      level: parent ? Number(parent.level || 0) + 1 : 0,
      sort: numericValue(input.sort),
      hot: Number(input.hot) === 1 ? 1 : 0,
      status: Number(input.status) === 0 ? 0 : 1,
    };
    return { code: 200, data: await this.ctx.model.MissCity.create(data), message: '城市创建成功' };
  }

  async updateCity(id, input = {}) {
    const query = cityQuery(id);
    if (!query) return { code: 404, message: '城市不存在' };
    const current = await this.ctx.model.MissCity.findOne(query).lean();
    if (!current) return { code: 404, message: '城市不存在' };
    const name = cleanCityName(input.name);
    if (!name) return { code: -1, message: '城市名称不能为空' };
    const parentId = String(input.parentId || '0');
    const rawRows = await this.ctx.model.MissCity.find({}).lean();
    const rows = flattenCities(rawRows);
    const currentKey = cityIdentity(current);
    if (parentId === currentKey) return { code: -1, message: '上级地区不能选择自身' };
    const parent = parentId === '0' ? null : rows.find(item => cityIdentity(item) === parentId);
    if (parentId !== '0' && !parent) return { code: -1, message: '上级地区不存在' };
    let cursor = parent;
    const visited = new Set();
    while (cursor && !cursor.isVirtual) {
      const cursorKey = cityIdentity(cursor);
      if (cursorKey === currentKey) return { code: -1, message: '不能把地区移动到自己的子级下面' };
      if (visited.has(cursorKey)) break;
      visited.add(cursorKey);
      const parentId = cityParentId(cursor);
      cursor = rows.find(item => cityIdentity(item) === parentId);
    }
    if (rows.some(item => !item.isVirtual && cityIdentity(item) !== currentKey && cityParentId(item) === parentId && cleanCityName(item.name) === name)) {
      return { code: -1, message: '同级城市名称已存在' };
    }
    const updates = {
      name,
      copyid: String(input.copyid || '').trim(),
      provinceId: numericValue(input.provinceId, parent && parent.provinceId ? parent.provinceId : (parent && parent.id ? parent.id : 0)) || undefined,
      parentId,
      level: parent ? Number(parent.level || 0) + 1 : 0,
      sort: numericValue(input.sort),
      hot: Number(input.hot) === 1 ? 1 : 0,
      status: Number(input.status) === 0 ? 0 : 1,
    };
    const row = await this.ctx.model.MissCity.findOneAndUpdate(query, { $set: updates }, { new: true, runValidators: true })
      .lean();
    return row ? { code: 200, data: row, message: '城市保存成功' } : { code: 404, message: '城市不存在' };
  }

  async removeCity(id) {
    const query = cityQuery(id);
    if (!query) return { code: 404, message: '城市不存在' };
    const current = await this.ctx.model.MissCity.findOne(query).lean();
    if (!current) return { code: 404, message: '城市不存在' };
    const key = cityIdentity(current);
    const childCount = await this.ctx.model.MissCity.countDocuments({
      status: { $ne: 0 },
      $or: [{ parentId: key }, { parentId: { $exists: false }, provinceId: Number(current.id) }],
    });
    if (childCount) return { code: -1, message: '请先处理子级地区后再删除' };
    const row = await this.ctx.model.MissCity.findOneAndUpdate(query, { $set: { status: 0 } }, { new: true }).lean();
    return row ? { code: 200, data: row, message: '城市已隐藏' } : { code: 404, message: '城市不存在' };
  }

  async batchCreateCity(input = {}) {
    const source = input.names !== undefined ? input.names : (input.content !== undefined ? input.content : input.items);
    const lines = Array.isArray(source) ? source : String(source || '').split(/[\r\n\u2028\u2029]+/);
    const parentId = String(input.parentId || '0');
    const created = [];
    let skipped = 0;
    const failed = [];
    for (const line of lines) {
      const item = line && typeof line === 'object' ? line : null;
      const text = item ? cleanCityName(item.name) : cleanCityName(line);
      if (!text) continue;
      const parts = text.split(/[|｜,，]/);
      const parsedName = cleanCityName(item ? item.name : parts.shift());
      const parsedCopyid = item ? item.copyid : parts.join(',').trim();
      let result;
      try {
        result = await this.createCity({
          name: parsedName,
          copyid: parsedCopyid,
          parentId,
          provinceId: input.provinceId,
          sort: input.sort,
          hot: input.hot,
          status: input.status,
        });
      } catch (error) {
        failed.push({ name: parsedName || text, message: error.message || '保存失败' });
        continue;
      }
      if (result.code === 200) created.push(result.data);
      else if (result.message === '同级城市名称已存在') skipped += 1;
      else failed.push({ name: parsedName || text, message: result.message || '保存失败' });
    }
    const message = `批量添加完成，新增 ${created.length} 条，跳过 ${skipped} 条，失败 ${failed.length} 条`;
    return { code: 200, data: { created, skipped, failed, count: created.length }, message };
  }

  async importCity(input = {}) {
    const sourceRows = parseCityImport(input);
    if (!sourceRows.length) return { code: -1, message: '导入文件中没有可识别的城市数据' };
    if (sourceRows.length > 10000) return { code: -1, message: '单次最多导入 10000 条城市数据' };

    const rawRows = await this.ctx.model.MissCity.find({}).lean();
    const existingRows = rawRows.map(item => ({ ...item, parentId: cityParentId(item) }));
    const sourceIdMap = new Map();
    const inserted = [];
    const updated = [];
    const failed = [];
    let nextId = Math.max(0, ...existingRows.map(item => numericValue(item.id))) + 1;

    const orderedRows = sourceRows.map((item, index) => ({ item: item || {}, index }))
      .sort((a, b) => numericValue(a.item.level, 0) - numericValue(b.item.level, 0) || a.index - b.index);

    for (const entry of orderedRows) {
      const item = entry.item;
      const name = cleanCityName(item.name || item.title);
      if (!name) {
        failed.push({ name: '', message: '城市名称为空' });
        continue;
      }
      const sourceParentId = String(item.parentId !== undefined && item.parentId !== null && item.parentId !== ''
        ? item.parentId
        : (item.provinceId || input.parentId || '0'));
      const parentId = sourceIdMap.get(sourceParentId) || sourceParentId;
      const parent = existingRows.find(row => cityIdentity(row) === parentId);
      const sibling = existingRows.find(row => cityParentId(row) === parentId && cleanCityName(row.name) === name);
      const incomingId = numericValue(item.id, 0);
      const sameId = incomingId ? existingRows.find(row => cityIdentity(row) === String(incomingId)) : null;
      const target = sibling || (sameId && (cleanCityName(sameId.name) === name || cityParentId(sameId) === parentId) ? sameId : null);
      const id = target ? numericValue(target.id, 0) : (incomingId && !sameId ? incomingId : nextId++);
      const level = item.level !== undefined ? numericValue(item.level) : (parent ? numericValue(parent.level) + 1 : 0);
      const data = {
        id,
        name,
        copyid: item.copyid === undefined || item.copyid === null ? '' : String(item.copyid).trim(),
        provinceId: numericValue(item.provinceId, parent && parent.provinceId ? parent.provinceId : (parent && parent.id ? parent.id : numericValue(parentId))) || undefined,
        parentId,
        level,
        sort: numericValue(item.sort),
        hot: Number(item.hot) === 1 ? 1 : 0,
        status: Number(item.status) === 0 ? 0 : 1,
      };
      try {
        if (target) {
          const row = await this.ctx.model.MissCity.findByIdAndUpdate(target._id, { $set: data }, { new: true, runValidators: true }).lean();
          if (row) {
            updated.push(row);
            const targetIndex = existingRows.findIndex(rowItem => String(rowItem._id) === String(target._id));
            if (targetIndex >= 0) existingRows[targetIndex] = { ...row, parentId: cityParentId(row) };
          }
        } else {
          const row = await this.ctx.model.MissCity.create(data);
          inserted.push(row);
          existingRows.push({ ...row.toObject(), parentId });
        }
        if (item.id !== undefined && item.id !== null && item.id !== '') sourceIdMap.set(String(item.id), String(id));
      } catch (error) {
        failed.push({ name, message: error.message || '写入数据库失败' });
      }
    }
    return {
      code: 200,
      data: { inserted, updated, failed, count: inserted.length + updated.length },
      message: `导入完成，新增 ${inserted.length} 条，更新 ${updated.length} 条，失败 ${failed.length} 条`,
    };
  }
}

module.exports = MissAdminService;
