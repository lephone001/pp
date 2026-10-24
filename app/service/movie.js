'use strict';

const Service = require('egg').Service;

const isObjectId = value => /^[a-fA-F0-9]{24}$/.test(String(value || ''));
const toObjectId = (ctx, value) => isObjectId(value) ? ctx.app.mongoose.Types.ObjectId(value) : null;
const asNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const withMovieCover = item => item ? { ...item, cover: item.cover || item.coverBig || '' } : item;
const categorySort = { isTop: -1, isHot: -1, sort: 1, _id: 1 };
const latestMovieSort = { updatedAt: -1, updateTime: -1, createdAt: -1, _id: -1 };
const isRootCategory = parentId => !parentId || String(parentId) === '0';
const categoryParentId = category => {
  if (!category) return '';
  const value = [ category.parentId, category.type_pid, category.typePid, category.parent_id ]
    .find(item => item !== undefined && item !== null && String(item).trim() !== '');
  return String(value || '');
};

function buildCategoryTree(rows = []) {
  const nodes = rows.map(item => ({ ...item, children: [] }));
  const nodeMap = new Map();
  nodes.forEach(node => {
    if (node.typeId !== undefined && node.typeId !== null) nodeMap.set(String(node.typeId), node);
    if (node._id) nodeMap.set(String(node._id), node);
  });
  const roots = [];
  nodes.forEach(node => {
    const parentId = categoryParentId(node);
    const parent = isRootCategory(parentId) ? null : nodeMap.get(parentId);
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
}

function flattenCategoryTree(tree = [], level = 0, result = []) {
  tree.forEach(node => {
    const children = Array.isArray(node.children) ? node.children : [];
    const item = { ...node };
    delete item.children;
    result.push({ ...item, level, hasChildren: children.length > 0 });
    flattenCategoryTree(children, level + 1, result);
  });
  return result;
}

function categoryIdsWithDescendants(rows = [], typeId) {
  const wanted = String(typeId || '');
  if (!wanted) return [];
  const ids = [ wanted ];
  const queue = [ wanted ];
  while (queue.length) {
    const parentId = queue.shift();
    rows.forEach(item => {
      if (categoryParentId(item) === parentId && !ids.includes(String(item.typeId))) {
        const childId = String(item.typeId);
        ids.push(childId);
        queue.push(childId);
      }
    });
  }
  return ids;
}

function categoryDisplayRows(rows = []) {
  return flattenCategoryTree(buildCategoryTree(rows)).map(item => ({
    ...item,
    name: `${String.fromCharCode(160).repeat(Number(item.level || 0) * 2)}${item.name}`,
  }));
}

function findCategory(rows = [], typeId) {
  const wanted = String(typeId || '');
  return rows.find(item => String(item.typeId || '') === wanted || String(item._id || '') === wanted) || null;
}

function findCategoryParent(rows = [], category) {
  const parentId = categoryParentId(category);
  if (!category || isRootCategory(parentId)) return null;
  return findCategory(rows, parentId);
}

function findRootCategory(rows = [], category) {
  let current = category;
  const visited = new Set();
  while (current && !isRootCategory(categoryParentId(current))) {
    const currentId = String(current.typeId || current._id || '');
    if (!currentId || visited.has(currentId)) break;
    visited.add(currentId);
    current = findCategoryParent(rows, current);
  }
  return current || category || null;
}

function rootCategories(rows = []) {
  return rows.filter(item => isRootCategory(categoryParentId(item)));
}

function navigationCategories(rows = []) {
  const roots = rootCategories(rows);
  const topRoots = roots.filter(item => Number(item.isTop) === 1);
  // 保留 isTop 的配置；如果历史数据没有设置 isTop，主分类仍然可以正常导航。
  return topRoots.length ? topRoots : roots;
}

function categoryContext(rows = [], typeId) {
  const currentCategory = findCategory(rows, typeId);
  const rootCategory = findRootCategory(rows, currentCategory);
  const rootTypeId = rootCategory ? String(rootCategory.typeId || rootCategory._id || '') : '';
  const subCategories = rootTypeId
    ? rows.filter(item => categoryParentId(item) === rootTypeId)
    : [];
  return {
    currentCategory,
    rootCategory,
    subCategories,
    navTypeId: rootTypeId,
  };
}

const movieFields = [
  'sourceId', 'vodId', 'name', 'subName', 'enName', 'typeId', 'typeName', 'year', 'area', 'lang',
  'actor', 'director', 'writer', 'cover', 'coverBig', 'remark', 'content', 'score', 'status', 'isEnd',
  'episodeCount', 'tags', 'firstLetter', 'pinyin', 'viewCount', 'likeCount', 'publishTime', 'updateTime', 'siteType',
];

function cleanMovieUpdates(input = {}) {
  const updates = {};
  movieFields.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(input, key)) updates[key] = input[key];
  });
  if (updates.score !== undefined) updates.score = asNumber(updates.score);
  [ 'status', 'isEnd', 'episodeCount', 'viewCount', 'likeCount', 'siteType' ].forEach(key => {
    if (updates[key] !== undefined) updates[key] = asNumber(updates[key]);
  });
  if (updates.tags && !Array.isArray(updates.tags)) {
    updates.tags = String(updates.tags).split(/[,，|]/).map(item => item.trim()).filter(Boolean);
  }
  return updates;
}

class MovieService extends Service {
  async movieList(params = {}) {
    const page = Math.max(1, asNumber(params.page, 1));
    const limit = Math.min(100, Math.max(1, asNumber(params.limit, 20)));
    const query = { siteType: asNumber(params.siteType, 11), status: { $ne: 0 } };
    if (params.status !== undefined && params.status !== '') query.status = asNumber(params.status);
    if (params.name) query.name = { $regex: String(params.name).trim(), $options: 'i' };
    if (params.typeId !== undefined && params.typeId !== '') query.typeId = String(params.typeId);
    if (params.year !== undefined && params.year !== '') query.year = String(params.year);
    if (params.actor) query.actor = { $regex: String(params.actor).trim(), $options: 'i' };
    if (params.director) query.director = { $regex: String(params.director).trim(), $options: 'i' };

    const [ rows, count ] = await Promise.all([
      this.ctx.model.Movie.find(query).sort(latestMovieSort).skip((page - 1) * limit).limit(limit).lean(),
      this.ctx.model.Movie.countDocuments(query),
    ]);
    const sourceIds = [ ...new Set(rows.map(item => item.sourceId).filter(isObjectId)) ];
    const sourceDocs = sourceIds.length ? await this.ctx.model.CollectSource.find({ _id: { $in: sourceIds } }).select('name code').lean() : [];
    const sourceMap = new Map(sourceDocs.map(item => [ String(item._id), item ]));
    const normalizedRows = rows.map(item => {
      const source = sourceMap.get(String(item.sourceId));
      return { ...withMovieCover(item), sourceName: source ? source.name : (item.sourceId === 'manual' ? '手动添加' : ''), sourceCode: source ? source.code : '' };
    });
    return { code: 200, data: { data: normalizedRows, rows: normalizedRows, count, page, limit } };
  }

  async createMovie(input = {}) {
    const updates = cleanMovieUpdates(input);
    if (!updates.name) return { code: -1, message: '电影名称不能为空' };
    updates.sourceId = updates.sourceId || 'manual';
    updates.vodId = updates.vodId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    updates.siteType = updates.siteType || 11;
    try {
      const row = await this.ctx.model.Movie.create(updates);
      return { code: 200, data: row };
    } catch (error) {
      if (error && error.code === 11000) return { code: -1, message: '同一采集源下的 vodId 已存在' };
      throw error;
    }
  }

  async findMovie(id) {
    const objectId = toObjectId(this.ctx, id);
    if (!objectId) return { code: -1, message: '电影 ID 无效' };
    const movie = await this.ctx.model.Movie.findById(objectId).lean();
    if (!movie) return { code: 404, message: '电影不存在' };
    const [ episodes, playSources, playUrls ] = await Promise.all([
      this.ctx.model.Episode.find({ movieId: objectId, status: { $ne: 0 } }).sort({ sort: 1, episode: 1 }).lean(),
      this.ctx.model.PlaySource.find({ movieId: objectId, status: { $ne: 0 } }).sort({ sort: 1, _id: 1 }).lean(),
      this.ctx.model.PlayUrl.find({ movieId: objectId, status: { $ne: 0 } }).sort({ sort: 1, episode: 1 }).lean(),
    ]);
    return { code: 200, data: { movie, episodes, playSources, playUrls } };
  }

  async updateMovie(id, input = {}) {
    const objectId = toObjectId(this.ctx, id);
    if (!objectId) return { code: -1, message: '电影 ID 无效' };
    const updates = cleanMovieUpdates(input);
    const row = await this.ctx.model.Movie.findByIdAndUpdate(objectId, { $set: updates }, { new: true, runValidators: true }).lean();
    return row ? { code: 200, data: row, message: '保存成功' } : { code: 404, message: '电影不存在' };
  }

  async deleteMovie(id) {
    const objectId = toObjectId(this.ctx, id);
    if (!objectId) return { code: -1, message: '电影 ID 无效' };
    const row = await this.ctx.model.Movie.findByIdAndUpdate(objectId, { $set: { status: 0 } }, { new: true }).lean();
    return row ? { code: 200, message: '电影已移出前台' } : { code: 404, message: '电影不存在' };
  }

  async categoryList(params = {}) {
    const query = { siteType: asNumber(params.siteType, 11) };
    if (params.status !== undefined && params.status !== '') query.status = asNumber(params.status);
    let rows = await this.ctx.model.MovieCategory.find(query).sort(categorySort).lean();
    rows = await this.ensureCategoryHierarchy(rows);
    const tree = buildCategoryTree(rows);
    return { code: 200, data: { data: rows, tree, treeRows: flattenCategoryTree(tree), count: rows.length } };
  }

  async ensureCategoryHierarchy(categories = []) {
    if (!categories.length) return categories;
    const sources = await this.ctx.model.CollectSource.find({
      siteType: 11,
      status: { $ne: 0 },
      'remoteCategories.0': { $exists: true },
    }).select('remoteCategories').lean();
    const remoteParents = new Map();
    sources.forEach(source => {
      (source.remoteCategories || []).forEach(item => {
        const remoteId = String(item.remoteId || item.typeId || '').trim();
        if (!remoteId || remoteParents.has(remoteId)) return;
        remoteParents.set(remoteId, String(item.parentId || item.type_pid || '0').trim() || '0');
      });
    });
    if (!remoteParents.size) return categories;

    const updates = [];
    categories.forEach(category => {
      const typeId = String(category.typeId || '').trim();
      const parentId = remoteParents.get(typeId);
      if (!typeId || parentId === undefined || categoryParentId(category) === parentId) return;
      updates.push({
        updateOne: {
          filter: { _id: category._id },
          update: { $set: { parentId } },
        },
      });
    });
    if (updates.length) await this.ctx.model.MovieCategory.bulkWrite(updates, { ordered: false });
    return categories.map(category => {
      const parentId = remoteParents.get(String(category.typeId || '').trim());
      return parentId === undefined ? category : { ...category, parentId };
    });
  }

  async createCategory(input = {}) {
    if (!input.name) return { code: -1, message: '分类名称不能为空' };
    const data = {
      siteType: asNumber(input.siteType, 11), typeId: String(input.typeId || Date.now()), name: String(input.name),
      parentId: String(input.parentId === undefined || input.parentId === '' ? '0' : input.parentId), sort: asNumber(input.sort), status: asNumber(input.status, 1),
      isHot: asNumber(input.isHot, 0), isTop: asNumber(input.isTop, 0),
      icon: input.icon || '', description: input.description || '',
    };
    try {
      return { code: 200, data: await this.ctx.model.MovieCategory.create(data) };
    } catch (error) {
      if (error && error.code === 11000) return { code: -1, message: '分类 typeId 已存在' };
      throw error;
    }
  }

  async updateCategory(id, input = {}) {
    const objectId = toObjectId(this.ctx, id);
    const current = objectId ? await this.ctx.model.MovieCategory.findById(objectId).lean() : null;
    if (!current) return { code: 404, message: 'Category not found' };
    if (!objectId) return { code: -1, message: '分类 ID 无效' };
    const allowed = [ 'typeId', 'name', 'parentId', 'sort', 'status', 'isHot', 'isTop', 'icon', 'description', 'siteType' ];
    const updates = {};
    allowed.forEach(key => { if (input[key] !== undefined) updates[key] = input[key]; });
    if (updates.parentId === '') updates.parentId = '0';
    if (updates.parentId && updates.parentId !== '0') {
      const categories = await this.ctx.model.MovieCategory.find({ siteType: current.siteType }).select('typeId parentId').lean();
      const descendants = categoryIdsWithDescendants(categories, current.typeId);
      if (descendants.includes(String(updates.parentId))) return { code: -1, message: 'Cannot move a category below its own child' };
    }
    [ 'sort', 'status', 'isHot', 'isTop', 'siteType' ].forEach(key => { if (updates[key] !== undefined) updates[key] = asNumber(updates[key]); });
    const row = await this.ctx.model.MovieCategory.findByIdAndUpdate(objectId, { $set: updates }, { new: true }).lean();
    return row ? { code: 200, data: row } : { code: 404, message: '分类不存在' };
  }

  async deleteCategory(id) {
    const objectId = toObjectId(this.ctx, id);
    if (!objectId) return { code: -1, message: '分类 ID 无效' };
    const row = await this.ctx.model.MovieCategory.findByIdAndUpdate(objectId, { $set: { status: 0 } }, { new: true }).lean();
    return row ? { code: 200, message: '分类已停用' } : { code: 404, message: '分类不存在' };
  }

  async homeData() {
    const query = { siteType: 11, status: 1 };
    let [ categories, latest, hot ] = await Promise.all([
      this.ctx.model.MovieCategory.find(query).sort(categorySort).lean(),
      this.ctx.model.Movie.find(query).sort(latestMovieSort).limit(24).lean(),
      this.ctx.model.Movie.find(query).sort({ viewCount: -1, likeCount: -1, _id: -1 }).limit(12).lean(),
    ]);
    categories = await this.ensureCategoryHierarchy(categories);
    const categoryTree = buildCategoryTree(categories);
    const mainCategories = rootCategories(categories);
    const navCategories = navigationCategories(categories);
    return {
      categories: categoryDisplayRows(categories),
      mainCategories,
      categoryTree,
      categoryTreeRows: flattenCategoryTree(categoryTree),
      navCategories,
      topCategories: navCategories,
      latest: latest.map(withMovieCover),
      hot: hot.map(withMovieCover),
    };
  }

  async listPage({ typeId, keyword, page = 1, limit = 24 } = {}) {
    const query = { siteType: 11, status: 1 };
    if (keyword) query.$or = [
      { name: { $regex: String(keyword).trim(), $options: 'i' } },
      { actor: { $regex: String(keyword).trim(), $options: 'i' } },
      { director: { $regex: String(keyword).trim(), $options: 'i' } },
    ];
    const safePage = Math.max(1, asNumber(page, 1));
    const safeLimit = Math.min(60, Math.max(1, asNumber(limit, 24)));
    let categories = await this.ctx.model.MovieCategory.find({ siteType: 11, status: 1 }).sort(categorySort).lean();
    categories = await this.ensureCategoryHierarchy(categories);
    if (typeId) query.typeId = { $in: categoryIdsWithDescendants(categories, typeId) };
    const [ rows, count ] = await Promise.all([
      this.ctx.model.Movie.find(query).sort(latestMovieSort).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
      this.ctx.model.Movie.countDocuments(query),
    ]);
    const categoryTree = buildCategoryTree(categories);
    const context = categoryContext(categories, typeId);
    const mainCategories = rootCategories(categories);
    const navCategories = navigationCategories(categories);
    return {
      rows: rows.map(withMovieCover),
      count,
      categories: categoryDisplayRows(categories),
      mainCategories,
      subCategories: context.subCategories,
      currentCategory: context.currentCategory,
      rootCategory: context.rootCategory,
      categoryTree,
      categoryTreeRows: flattenCategoryTree(categoryTree),
      navCategories,
      topCategories: navCategories,
      navTypeId: context.navTypeId,
      page: safePage,
      limit: safeLimit,
      keyword: keyword || '',
      typeId: typeId || '',
    };
  }

  async detailPage(id) {
    const objectId = toObjectId(this.ctx, id);
    if (!objectId) return null;
    const movie = await this.ctx.model.Movie.findOne({ _id: objectId, siteType: 11, status: 1 }).lean();
    if (!movie) return null;
    const [ episodes, sources, urls, related, categories ] = await Promise.all([
      this.ctx.model.Episode.find({ movieId: objectId, status: 1 }).sort({ sort: 1, episode: 1 }).lean(),
      this.ctx.model.PlaySource.find({ movieId: objectId, status: 1 }).sort({ sort: 1, _id: 1 }).lean(),
      this.ctx.model.PlayUrl.find({ movieId: objectId, status: 1 }).sort({ sort: 1, episode: 1 }).lean(),
      this.ctx.model.Movie.find({ siteType: 11, status: 1, typeId: movie.typeId, _id: { $ne: objectId } }).sort({ viewCount: -1, _id: -1 }).limit(8).lean(),
      this.ctx.model.MovieCategory.find({ siteType: 11, status: 1 }).sort(categorySort).lean(),
    ]);
    const normalizedCategories = await this.ensureCategoryHierarchy(categories);
    const context = categoryContext(normalizedCategories, movie.typeId);
    const navCategories = navigationCategories(normalizedCategories);
    return {
      movie: withMovieCover(movie),
      episodes,
      sources,
      urls,
      related: related.map(withMovieCover),
      navCategories,
      topCategories: navCategories,
      navTypeId: context.navTypeId,
    };
  }

  async playPage(id, episode, sourceId) {
    const detail = await this.detailPage(id);
    if (!detail) return null;
    const wantedEpisode = asNumber(episode, detail.episodes[0] ? detail.episodes[0].episode : 0);
    const currentEpisode = detail.episodes.find(item => item.episode === wantedEpisode) || detail.episodes[0] || null;
    const wantedSource = sourceId || (detail.sources[0] && detail.sources[0].code);
    let playList = detail.urls.filter(item => {
      const episodeMatch = currentEpisode ? String(item.episodeId) === String(currentEpisode._id) || item.episode === currentEpisode.episode : item.episode === 0;
      return episodeMatch && (!wantedSource || item.sourceId === wantedSource);
    });
    if (!playList.length) {
      playList = detail.urls.filter(item => currentEpisode ? (String(item.episodeId) === String(currentEpisode._id) || item.episode === currentEpisode.episode) : item.episode === 0);
    }
    if (!playList.length && detail.urls.length) playList = [ detail.urls[0] ];
    const allEpisodes = detail.episodes;
    const index = currentEpisode ? allEpisodes.findIndex(item => String(item._id) === String(currentEpisode._id)) : -1;
    return {
      ...detail,
      currentEpisode,
      currentSource: playList[0] ? playList[0].sourceId : wantedSource,
      playList,
      previousEpisode: index > 0 ? allEpisodes[index - 1] : null,
      nextEpisode: index >= 0 && index < allEpisodes.length - 1 ? allEpisodes[index + 1] : null,
    };
  }
}

MovieService.isObjectId = isObjectId;
module.exports = MovieService;
