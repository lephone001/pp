'use strict';

const Service = require('egg').Service;

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseList(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  if (!value) return [];
  const text = String(value).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parseList(parsed);
  } catch (error) {
    // 兼容历史数据中的逗号、换行和 | 分隔格式。
  }
  return text.split(/[\r\n,，|]+/).map(item => item.trim()).filter(Boolean);
}

function categoryKey(item) {
  return String(item && (item.id !== undefined && item.id !== null ? item.id : (item.copyid || item._id)) || '');
}

function cityKey(item) {
  return String(item && (item.id !== undefined && item.id !== null ? item.id : (item.copyid || item._id)) || '');
}

function cityParentKey(item) {
  if (!item) return '';
  const parentId = String(item.parentId || '').trim();
  if (parentId && parentId !== '0') return parentId;
  if (Number(item.level) > 0 && item.provinceId !== undefined && item.provinceId !== null) {
    return String(item.provinceId);
  }
  return '';
}

function cityPath(item, cityMap) {
  if (!item) return '';
  const names = [];
  const visited = new Set();
  let current = item;
  while (current) {
    const key = cityKey(current);
    if (!key || visited.has(key)) break;
    visited.add(key);
    if (current.name) names.unshift(String(current.name).trim());
    const parentKey = cityParentKey(current);
    current = parentKey ? cityMap.get(parentKey) : null;
  }
  return names.join(' / ');
}

function cityProvinceKey(item, cityMap) {
  if (!item) return '';
  const visited = new Set();
  let current = item;
  while (current) {
    const key = cityKey(current);
    if (!key || visited.has(key)) return '';
    visited.add(key);
    const parentKey = cityParentKey(current);
    if (!parentKey) return key;
    current = cityMap.get(parentKey);
  }
  return '';
}

function cityTree(cities) {
  const nodes = (cities || []).map(item => ({ ...item, children: [] }));
  const byKey = new Map(nodes.map(item => [cityKey(item), item]));
  const roots = [];
  nodes.forEach(item => {
    const parentId = String(item.parentId || '0');
    const parent = byKey.get(parentId);
    if (parent && parent !== item) parent.children.push(item);
    else roots.push(item);
  });
  const sortNodes = list => {
    list.sort((left, right) => {
      const sortDiff = toNumber(left.sort) - toNumber(right.sort);
      if (sortDiff) return sortDiff;
      return String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN');
    });
    list.forEach(item => sortNodes(item.children));
    return list;
  };
  return sortNodes(roots);
}

class MissPageService extends Service {
  async getCategories() {
    return this.ctx.model.MissCategory.find({ status: { $ne: 0 } })
      .sort({ isTop: -1, sort: 1, name: 1, _id: -1 })
      .lean();
  }

  async getCities() {
    return this.ctx.model.MissCity.find({ status: { $ne: 0 } })
      .sort({ parentId: 1, sort: 1, name: 1, _id: 1 })
      .lean();
  }

  async getLeaders() {
    const rows = await this.ctx.model.MissLeader.find({
      recordType: 'agent',
      status: { $ne: 0 },
      leaderStatus: { $ne: 0 },
    })
      .sort({ leaderSort: -1, leaderScore: -1, leaderId: 1, _id: -1 })
      .limit(24)
      .lean();
    return rows.map(item => ({
      ...item,
      name: item.leaderName || item.leaderUserName || '代理展示',
      username: item.leaderUserName || '',
      city: item.leaderCity || '',
      header: item.leaderHeader || '',
      rz: item.leaderRz || 0,
      cj: item.leaderCj || 0,
      zonghe: item.leaderScore || 0,
      jianjie: item.leaderDescription || '',
    }));
  }

  async decorate(rows, categories, cities) {
    const categoryMap = new Map((categories || []).map(item => [ categoryKey(item), item ]));
    const cityMap = new Map((cities || []).map(item => [ cityKey(item), item ]));
    return (rows || []).map(item => {
      const images = parseList(item.image_list);
      const videos = parseList(item.video_list);
      const category = categoryMap.get(String(item.categoryId || ''));
      const city = cityMap.get(String(item.cityId || ''));
      const cityName = cityPath(city, cityMap);
      const detailAddress = String(item.detail_address || '').trim();
      return {
        ...item,
        images,
        cover: images[0] || '',
        videos,
        categoryName: category ? category.name : '',
        cityName,
        cityPath: cityName,
        provinceName: city && cityParentKey(city) && cityMap.get(cityParentKey(city))
          ? cityMap.get(cityParentKey(city)).name
          : (city ? city.name : ''),
        fullAddress: [cityName, detailAddress].filter(Boolean).join(' / '),
        tags: Array.isArray(item.tags) ? item.tags : parseList(item.tags),
      };
    });
  }

  async listPage({ page = 1, limit = 24, categoryId, provinceId, cityId, keyword } = {}) {
    const safePage = Math.max(1, toNumber(page, 1));
    const safeLimit = Math.min(60, Math.max(1, toNumber(limit, 24)));
    const query = { status: { $ne: 0 } };
    if (categoryId !== undefined && categoryId !== '') query.categoryId = toNumber(categoryId);
    if (cityId !== undefined && cityId !== '') query.cityId = toNumber(cityId);
    else if (provinceId !== undefined && provinceId !== '') query.provinceId = toNumber(provinceId);
    if (keyword) {
      const pattern = String(keyword).trim();
      query.$or = [
        { title: { $regex: pattern, $options: 'i' } },
        { service: { $regex: pattern, $options: 'i' } },
        { job: { $regex: pattern, $options: 'i' } },
        { remarks: { $regex: pattern, $options: 'i' } },
      ];
    }
    const [ rows, count, categories, cities ] = await Promise.all([
      this.ctx.model.Miss.find(query)
        .sort({ isTop: -1, isHot: -1, _id: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
      this.ctx.model.Miss.countDocuments(query),
      this.getCategories(),
      this.getCities(),
    ]);
    const cityMap = new Map(cities.map(item => [ cityKey(item), item ]));
    const selectedCity = cityId !== undefined && cityId !== ''
      ? cities.find(item => cityKey(item) === String(cityId))
      : null;
    const selectedProvinceId = selectedCity
      ? cityProvinceKey(selectedCity, cityMap)
      : (provinceId !== undefined && provinceId !== '' ? String(provinceId) : '');
    const displayCities = cities.map(item => ({ ...item, displayName: cityPath(item, cityMap) }));
    const cityTreeRows = cityTree(displayCities);
    const hotCities = displayCities.filter(item => Number(item.hot) === 1);
    return {
      rows: await this.decorate(rows, categories, cities),
      count,
      page: safePage,
      limit: safeLimit,
      categoryId: categoryId || '',
      provinceId: selectedProvinceId,
      cityId: cityId || '',
      keyword: keyword || '',
      categories,
      cities: displayCities,
      cityTree: cityTreeRows,
      hotCities,
    };
  }

  async homeData() {
    const data = await this.listPage({ page: 1, limit: 24 });
    data.leaders = await this.getLeaders();
    return data;
  }

  async leaderListPage() {
    const [ leaders, categories ] = await Promise.all([
      this.getLeaders(),
      this.getCategories(),
    ]);
    return {
      leaders,
      count: leaders.length,
      categories,
    };
  }

  async categoryPage(categoryId, options = {}) {
    const result = await this.listPage({ ...options, categoryId });
    result.currentCategory = result.categories.find(item => String(item.id || item.copyid || item._id) === String(categoryId)) || null;
    return result;
  }

  async detailPage(id) {
    let row;
    let rowModel = this.ctx.model.Miss;
    try {
      row = await this.ctx.model.Miss.findOne({ _id: id, status: { $ne: 0 } }).lean();
    } catch (error) {
      return null;
    }
    if (!row) {
      try {
        row = await this.ctx.model.MissLeader.findOne({ _id: id, recordType: { $ne: 'agent' }, status: { $ne: 0 } }).lean();
        rowModel = this.ctx.model.MissLeader;
      } catch (error) {
        return null;
      }
    }
    if (!row) return null;
    const relatedQuery = { categoryId: row.categoryId, status: { $ne: 0 }, _id: { $ne: row._id } };
    if (rowModel === this.ctx.model.MissLeader) {
      relatedQuery.recordType = { $ne: 'agent' };
      if (row.leaderId !== undefined && row.leaderId !== null) relatedQuery.leaderId = row.leaderId;
    }
    const [ categories, cities, related, comments ] = await Promise.all([
      this.getCategories(),
      this.getCities(),
      rowModel.find(relatedQuery)
        .sort({ isTop: -1, isHot: -1, _id: -1 })
        .limit(8)
        .lean(),
      this.ctx.model.MissComment.find({ missId: row.id || row._id, status: 1 })
        .sort({ isTop: -1, createdAt: -1 })
        .limit(20)
        .lean()
        .catch(() => []),
    ]);
    const [ detail ] = await this.decorate([ row ], categories, cities);
    return {
      detail,
      related: await this.decorate(related, categories, cities),
      comments,
      categories,
      cities,
    };
  }

  async leaderPage(leaderId, options = {}) {
    const numericLeaderId = toNumber(leaderId, 0);
    if (!numericLeaderId) return null;
    const page = Math.max(1, toNumber(options.page, 1));
    const limit = Math.min(60, Math.max(1, toNumber(options.limit, 24)));
    const [ leader, categories, cities, rows, count ] = await Promise.all([
      this.ctx.model.MissLeader.findOne({
        recordType: 'agent',
        leaderId: numericLeaderId,
        status: { $ne: 0 },
        leaderStatus: { $ne: 0 },
      }).lean(),
      this.getCategories(),
      this.getCities(),
      this.ctx.model.MissLeader.find({
        leaderId: numericLeaderId,
        recordType: { $ne: 'agent' },
        status: { $ne: 0 },
      })
        .sort({ isTop: -1, isHot: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.ctx.model.MissLeader.countDocuments({
        leaderId: numericLeaderId,
        recordType: { $ne: 'agent' },
        status: { $ne: 0 },
      }),
    ]);
    if (!leader) return null;
    return {
      leader: {
        ...leader,
        name: leader.leaderName || leader.leaderUserName || '代理展示',
        username: leader.leaderUserName || '',
        city: leader.leaderCity || '',
        header: leader.leaderHeader || '',
        rz: leader.leaderRz || 0,
        cj: leader.leaderCj || 0,
        zonghe: leader.leaderScore || 0,
        jianjie: leader.leaderDescription || '',
      },
      rows: await this.decorate(rows, categories, cities),
      count,
      page,
      limit,
      categories,
      cities,
    };
  }
}

module.exports = MissPageService;
