'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const Service = require('egg').Service;

const ImgTypeNameList = [
  { nameval: '', value: 'bdzb-108', nums: '108' },
  { value: 'bdmn-151', nums: '151' },
  { value: 'bc-38', nums: '38' },
  { value: 'mn', nums: '200' },
  { value: 'mn2', nums: '200' },
  { value: 'mn3', nums: '200' },
  { value: 'mn4', nums: '200' },
  { value: 'mn5', nums: '8369' },
  { value: 'mn6', nums: '10062' },
  { value: 'mn7', nums: '70000' },
];

class ArticleComapanyService extends Service {
  get articleCompanyModel() {
    const { ctx } = this;
    return ctx.model.ArticleComapany || ctx.model.ArticleCompany;
  }

  success(data = {}, message = 'success') {
    return {
      code: 200,
      message,
      data,
    };
  }

  fail(message = 'params error', code = -1) {
    return {
      code,
      message,
    };
  }

  pickUpdates(body = {}) {
    const updates = body.updates || body;
    const allowKeys = [ 'companyId', 'name', 'fileName', 'imgTypeName', 'isFileName', 'content', 'tdk', 'tdkNums', 'templateSection', 'templates', 'status' ];
    const data = {};

    for (const key of allowKeys) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        data[key] = updates[key];
      }
    }

    if (Object.prototype.hasOwnProperty.call(data, 'tdk')) {
      data.tdkNums = Array.isArray(data.tdk) ? data.tdk.length : 0;
    }

    return data;
  }

  async articleComapanyList({
    limit = 20,
    offset = 0,
    page = 1,
    companyId,
    name,
    status,
  } = {}) {
    const { ctx } = this;
    const criteria = {};

    if (companyId) criteria.companyId = companyId;
    if (name) criteria.name = new RegExp(name, 'i');
    if (status !== undefined && status !== '') criteria.status = Number(status);

    const pageLimit = Math.max(Number(limit) || 20, 1);
    const pageOffset = offset ? Number(offset) || 0 : (Math.max(Number(page) || 1, 1) - 1) * pageLimit;

    const count = await this.articleCompanyModel.countDocuments(criteria);
    const rows = await this.articleCompanyModel
      .find(criteria)
      .sort({ updatedAt: -1, _id: -1 })
      .skip(pageOffset)
      .limit(pageLimit)
      .lean();

    return this.success({
      data: ctx.service.utils.jiamiFn(rows),
      count,
      limit: pageLimit,
      offset: pageOffset,
    });
  }

  async articleComapanyCreate(body = {}) {
    const { ctx } = this;

    if (!body.name) {
      return this.fail('name is required');
    }

    const data = this.pickUpdates(body);
    const row = await this.articleCompanyModel.create(data);

    return this.success(ctx.service.utils.jiamiFn(row), 'created');
  }

  async articleComapanyGetOne(body = {}) {
    const { ctx } = this;
    const id = body.id || body._id;

    if (!id) {
      return this.fail('id is required');
    }

    const row = await this.articleCompanyModel.findById(id).lean();
    if (!row) {
      return this.fail('not found', -2);
    }

    return this.success(ctx.service.utils.jiamiFn(row));
  }

  async articleComapanyUpdate(body = {}) {
    const id = body.id || body._id;

    if (!id) {
      return this.fail('id is required');
    }

    if (
      Object.prototype.hasOwnProperty.call(body, 'contentIndex') &&
      Object.prototype.hasOwnProperty.call(body, 'contentItem')
    ) {
      const contentIndex = Number(body.contentIndex);
      if (!Number.isInteger(contentIndex) || contentIndex < 0) {
        return this.fail('contentIndex is invalid');
      }

      const row = await this.articleCompanyModel.findByIdAndUpdate(
        id,
        { $set: { [`content.${contentIndex}`]: body.contentItem } },
        { new: true }
      ).select('_id').lean();

      if (!row) {
        return this.fail('not found', -2);
      }

      return this.success({
        _id: row._id,
        updatedKeys: [ `content.${contentIndex}` ],
      }, 'updated');
    }

    const updates = this.pickUpdates(body);
    if (!Object.keys(updates).length) {
      return this.fail('no update data');
    }

    const row = await this.articleCompanyModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    ).select('_id').lean();

    if (!row) {
      return this.fail('not found', -2);
    }

    return this.success({
      _id: row._id,
      updatedKeys: Object.keys(updates),
    }, 'updated');
  }

  async articleComapanyDelete(body = {}) {
    const id = body.id || body._id;

    if (!id) {
      return this.fail('id is required');
    }

    const row = await this.articleCompanyModel.findByIdAndDelete(id).lean();
    if (!row) {
      return this.fail('not found', -2);
    }

    return this.success({}, 'deleted');
  }

  async articleComapanyStatus(body = {}) {
    const { ctx } = this;
    const id = body.id || body._id;
    const status = Number(body.status);

    if (!id || Number.isNaN(status)) {
      return this.fail('id or status is required');
    }

    const row = await this.articleCompanyModel.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    ).lean();

    if (!row) {
      return this.fail('not found', -2);
    }

    return this.success(ctx.service.utils.jiamiFn(row), 'status updated');
  }

  getArticleCompanyCacheDir(row = {}) {
    const baseDir = path.resolve(process.cwd(), 'cache', 'articlecompany');
    const safeFileName = this.safeDirName(row.fileName);
    if (!safeFileName) {
      return { baseDir, cacheDir: '', dirCacheName: '' };
    }

    const cacheDir = path.resolve(baseDir, safeFileName);
    if (cacheDir !== baseDir && !cacheDir.startsWith(baseDir + path.sep)) {
      return { baseDir, cacheDir: '', dirCacheName: '' };
    }

    return {
      baseDir,
      cacheDir,
      dirCacheName: safeFileName,
    };
  }

  async articleComapanyClearFolder(body = {}) {
    const id = body.id || body._id;
    if (!id) {
      return this.fail('id is required');
    }

    const row = await this.articleCompanyModel.findById(id).lean();
    if (!row) {
      return this.fail('not found', -2);
    }

    const { cacheDir, dirCacheName } = this.getArticleCompanyCacheDir(row);
    if (!cacheDir) {
      return this.fail('fileName is required');
    }

    const logger = this.ctx.logger || this.app.logger || console;
    this.runArticleCompanyBackground(async () => {
      await fs.promises.mkdir(cacheDir, { recursive: true });
      const removedCount = await this.clearDirectory(cacheDir);
      await this.setArticleCompanyNumCache(
        this.getArticleCompanyNumCacheKey(row._id, dirCacheName),
        0
      );
      logger.info(`[articleCompany] clear folder done: ${cacheDir}, removed ${removedCount}`);
    });

    return this.success({
      status: 'running',
      dir: cacheDir,
    }, 'folder clear task started');
  }

  async clearDirectory(dir, batchSize = 100) {
    const entries = await fs.promises.readdir(dir);
    for (let index = 0; index < entries.length; index += batchSize) {
      const batch = entries.slice(index, index + batchSize);
      await Promise.all(batch.map(entry => this.removePath(path.join(dir, entry), batchSize)));
    }
    return entries.length;
  }

  async removePath(targetPath, batchSize = 100) {
    let stat;
    try {
      stat = await fs.promises.lstat(targetPath);
    } catch (err) {
      if (err && err.code === 'ENOENT') return;
      throw err;
    }

    if (!stat.isDirectory()) {
      await fs.promises.unlink(targetPath);
      return;
    }

    await this.clearDirectory(targetPath, batchSize);
    await fs.promises.rmdir(targetPath);
  }

  async articleComapanyDeleteCbdContent(body = {}) {
    const id = body.id || body._id;
    if (!id) {
      return this.fail('id is required');
    }

    const row = await this.articleCompanyModel.findById(id).lean();
    if (!row) {
      return this.fail('not found', -2);
    }

    const ArticleCbdModel = this.ctx.model.ArticleCbd || this.ctx.model.ArticleCBD || this.ctx.model.articleCbd;
    if (!ArticleCbdModel) {
      return this.fail('articleCbd model not found', -3);
    }

    this.runArticleCompanyBackground(async () => {
      await ArticleCbdModel.deleteMany({ articleCompany: row._id });
    });

    return this.success({
      status: 'running',
      articleCompany: this.getArticleCompanyOutput(row),
    }, 'article cbd delete task started');
  }

  valueList(value) {
    if (Array.isArray(value)) {
      return value.map(item => {
        if (item && typeof item === 'object') {
          return String(item.text || item.content || item.value || '').trim();
        }
        return String(item || '').trim();
      }).filter(Boolean);
    }
    if (typeof value === 'string') return value.split('\n').map(item => item.trim()).filter(Boolean);
    return [];
  }

  contentValueList(item = {}) {
    const value = item && item.text !== undefined ? item.text : item.content;
    if (Number(item && item.contentType) === 3) {
      if (!Array.isArray(value)) return [];
      return value
        .filter(itemValue => itemValue !== undefined && itemValue !== null && itemValue !== '')
        .filter(itemValue => !(itemValue && typeof itemValue === 'object' && itemValue.enabled === false));
    }
    return this.valueList(value);
  }

  valueToString(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') {
      for (const key of [ 'text', 'content', 'value', 'name', 'title', 'display' ]) {
        if (value[key] !== undefined && value[key] !== null && value[key] !== '') {
          return String(value[key]);
        }
      }
      try {
        return JSON.stringify(value);
      } catch (e) {
        return '';
      }
    }
    return String(value);
  }

  getPathValue(source, pathKey) {
    const pathText = String(pathKey || '').trim();
    if (!pathText || source === undefined || source === null) return undefined;
    if (source && typeof source === 'object' && Object.prototype.hasOwnProperty.call(source, pathText)) {
      return source[pathText];
    }

    const parts = pathText.split('.').map(item => item.trim()).filter(Boolean);
    if (!parts.length) return undefined;

    let current = source;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      if (typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }

  getFieldAliases(field = '') {
    const name = String(field || '').trim();
    if (!name) return [];
    const aliases = [ name ];
    if (name.endsWith('s') && name.length > 1) {
      aliases.push(name.slice(0, -1));
    } else {
      aliases.push(`${name}s`);
    }
    return [ ...new Set(aliases.filter(Boolean)) ];
  }

  setAliasValues(target = {}, field = '', value) {
    for (const alias of this.getFieldAliases(field)) {
      if (target[alias] === undefined || target[alias] === null || target[alias] === '') {
        target[alias] = value;
      }
    }
  }

  renderReplaceValue(value, map = {}, pools = {}, depth = 0) {
    const text = this.valueToString(value);
    if (depth >= 3 || !/[{]{2}|&&/.test(text)) return text;
    return this.replaceVars(text, map, pools, depth + 1);
  }

  getSelectedTemplates(templates = [], templateIndexes) {
    if (!Array.isArray(templateIndexes) || !templateIndexes.length) {
      return templates;
    }

    const indexes = [ ...new Set(templateIndexes
      .map(index => Number(index))
      .filter(index => Number.isInteger(index) && index >= 0 && index < templates.length)) ];

    return indexes.map(index => templates[index]).filter(Boolean);
  }

  replaceVars(text = '', map = {}, pools = {}, depth = 0) {
    const getValue = key => {
      const field = String(key || '').trim();
      if (!field) return '';

      if (Object.prototype.hasOwnProperty.call(map, field)) {
        const value = map[field];
        if (Array.isArray(value)) return value.map(item => this.renderReplaceValue(item, map, pools, depth)).join('\n');
        return this.renderReplaceValue(value, map, pools, depth);
      }

      if (field.indexOf('.') > -1) {
        const parts = field.split('.').map(item => item.trim()).filter(Boolean);
        const rootField = parts.shift();
        const childPath = parts.join('.');
        const rootValue = Object.prototype.hasOwnProperty.call(map, rootField)
          ? map[rootField]
          : this.randomListItem(pools[rootField]);
        return this.renderReplaceValue(this.getPathValue(rootValue, childPath), map, pools, depth);
      }

      return this.renderReplaceValue(this.randomListItem(pools[field]), map, pools, depth);
    };
    const getRepeatedValue = (fieldKey, countValue) => {
      const field = String(fieldKey || '').trim();
      const count = Math.max(Number(countValue) || 0, 0);
      if (!field || !count) return '';

      const poolField = field.indexOf('.') > -1 ? field.split('.')[0].trim() : field;
      const pool = Array.isArray(pools[poolField]) && pools[poolField].length
        ? pools[poolField]
        : (Object.prototype.hasOwnProperty.call(map, poolField) ? [ map[poolField] ] : []);
      if (!pool.length) return '';

      const values = [];
      for (let index = 0; index < count; index++) {
        const item = this.randomListItem(pool);
        const value = field.indexOf('.') > -1
          ? this.getPathValue(item, field.split('.').slice(1).join('.'))
          : item;
        if (value !== undefined && value !== null && value !== '') {
          values.push(this.renderReplaceValue(value, map, pools, depth));
        }
      }
      return values.join('');
    };

    return String(text || '')
      .replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, key) => {
        const repeatMatch = String(key || '').trim().match(/^(\d+)\s*:\s*(.+)$/);
        if (repeatMatch) {
          return getRepeatedValue(repeatMatch[2], repeatMatch[1]);
        }
        return getValue(key);
      })
      .replace(/&&\s*([^&]+?)\s*&&/g, (match, key) => getValue(key));
  }

  async clearArticleCompanyCache(dir) {
    await fs.promises.mkdir(dir, { recursive: true });
    const files = await fs.promises.readdir(dir);
    await Promise.all(
      files
        .filter(file => /^\d+\.json$/.test(file))
        .map(file => fs.promises.unlink(path.join(dir, file)))
    );
  }

  async getArticleCompanyCacheState(dir) {
    await fs.promises.mkdir(dir, { recursive: true });
    let maxIndex = -1;
    const collectNumericJsonFiles = async currentDir => {
      let entries = [];
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch (e) {
        return;
      }
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (/^\d+$/.test(entry.name)) {
            await collectNumericJsonFiles(path.join(currentDir, entry.name));
          }
          continue;
        }

        if (/^\d+\.json$/i.test(entry.name)) {
          const index = Number(path.basename(entry.name, '.json'));
          if (index > maxIndex) maxIndex = index;
        }
      }
    };

    await collectNumericJsonFiles(dir);

    return {
      maxIndex,
      signatures: new Set(),
      fileNames: new Set(),
    };
  }

  articleJsonSignature(item = {}) {
    const block = { ...(item.block || {}) };
    delete block.b_number;

    return JSON.stringify({
      title: item.title || '',
      keywords: item.keywords || '',
      description: item.description || '',
      image: item.image || '',
      content: item.content || '',
      block,
      articleCompany: item.articleCompany || {},
    });
  }

  getBlockOutputMap(contentMap = {}) {
    const result = {};
    for (const key of Object.keys(contentMap)) {
      result[`b_${key}`] = contentMap[key];
    }
    return result;
  }

  getArticleCompanyOutput(row = {}) {
    return {
      name: row.name || '',
      _id: row._id ? String(row._id) : '',
      fileName: row.fileName || '',
      imgTypeName: row.imgTypeName || 'bdmn-151',
    };
  }

  getRandomArticleImage(imgTypeName = 'bdmn-151') {
    const typeName = imgTypeName || 'bdmn-151';
    const typeItem = ImgTypeNameList.find(item => item.value === typeName);
    const imageTotal = Number(typeItem && typeItem.nums) || 200;
    const randomNumber = Math.floor(Math.random() * 1000000000);
    const imageIndex = randomNumber % imageTotal;

    return `/images/article/${typeName}/${imageIndex}.jpg`;
  }

  randomListItem(list = []) {
    if (!Array.isArray(list) || !list.length) return '';
    return list[Math.floor(Math.random() * list.length)] || '';
  }

  getTdkFieldPools(tdkList = []) {
    const fieldNames = [ 'title', 'keywords', 'description' ];
    return fieldNames.reduce((pools, field) => {
      pools[field] = tdkList
        .map(item => (item && item[field] !== undefined && item[field] !== null ? String(item[field]).trim() : ''))
        .filter(Boolean);
      return pools;
    }, {});
  }

  getContentFieldPools(dimensions = []) {
    return dimensions.reduce((pools, dimension) => {
      if (dimension && dimension.field) {
        const values = Array.isArray(dimension.values) ? dimension.values : [];
        this.setAliasValues(pools, dimension.field, values);
      }
      return pools;
    }, {});
  }

  getContentListFieldPools(contentList = []) {
    return contentList.reduce((pools, item) => {
      if (item && item.field) {
        const values = this.contentValueList(item);
        if (values.length) {
          this.setAliasValues(pools, item.field, values);
        }
      }
      return pools;
    }, {});
  }

  getContentReplaceMap(contentFieldPools = {}, contentMap = {}) {
    const result = { ...contentMap };
    for (const [ field, value ] of Object.entries(contentMap)) {
      this.setAliasValues(result, field, value);
    }
    for (const [ field, values ] of Object.entries(contentFieldPools)) {
      if (result[field] !== undefined && result[field] !== null && result[field] !== '') {
        continue;
      }
      const value = this.randomListItem(values);
      if (value !== undefined && value !== null && value !== '') {
        this.setAliasValues(result, field, value);
      }
    }
    return result;
  }

  getTemplateValuePools(contentFieldPools = {}, tdkFieldPools = {}, contentMap = {}, templateMap = {}) {
    const pools = {};
    const replaceMap = {
      ...contentMap,
      ...templateMap,
    };

    for (const [ field, values ] of Object.entries(contentFieldPools)) {
      pools[field] = Array.isArray(values) ? values.filter(value => value !== undefined && value !== null && value !== '') : [];
    }

    for (const [ field, value ] of Object.entries(contentMap)) {
      if (!pools[field]) pools[field] = [];
      if (value !== undefined && value !== null && value !== '') {
        pools[field].push(value);
      }
    }

    for (const field of [ 'title', 'keywords', 'description' ]) {
      const values = (tdkFieldPools[field] || [])
        .map(value => this.replaceVars(value, replaceMap))
        .filter(Boolean);
      const currentValue = templateMap[field];
      if (currentValue !== undefined && currentValue !== null && currentValue !== '') {
        values.push(currentValue);
      }
      pools[field] = values;
    }

    return pools;
  }

  getTemplateSectionValues(templateSection = [], replaceMap = {}, pools = {}) {
    const map = {};
    const sectionPools = {};
    if (!Array.isArray(templateSection) || !templateSection.length) {
      return { map, pools: sectionPools };
    }

    templateSection.forEach(item => {
      if (!item || !item.field) return;
      const field = String(item.field || '').trim();
      if (!field) return;
      const contentList = this.valueList(item.content || item.text || item.value)
        .map(content => this.replaceVars(content, replaceMap, pools))
        .filter(Boolean);
      if (!contentList.length) return;

      map[field] = this.randomListItem(contentList);
      if (!sectionPools[field]) sectionPools[field] = [];
      contentList.forEach(content => sectionPools[field].push(content));

      const prefix = field.split('_')[0];
      if (prefix && prefix !== field) {
        if (!sectionPools[prefix]) sectionPools[prefix] = [];
        contentList.forEach(content => sectionPools[prefix].push(content));
      }
    });

    return { map, pools: sectionPools };
  }

  mergeValuePools(...poolList) {
    const result = {};
    poolList.forEach(pool => {
      if (!pool || typeof pool !== 'object') return;
      Object.entries(pool).forEach(([ field, values ]) => {
        const valueList = Array.isArray(values) ? values : [ values ];
        if (!result[field]) result[field] = [];
        valueList
          .filter(value => value !== undefined && value !== null && value !== '')
          .forEach(value => result[field].push(value));
      });
    });
    return result;
  }

  getTdkValue(tdk = {}, field, pools = {}) {
    const value = tdk && tdk[field] !== undefined && tdk[field] !== null ? String(tdk[field]).trim() : '';
    return value || this.randomListItem(pools[field]);
  }

  hasMixedBlockValues(result = {}, contentMap = {}, dimensions = []) {
    const checkFields = [ 'title', 'keywords', 'description' ];

    for (const dimension of dimensions) {
      const field = dimension.field;
      const ownValue = contentMap[field] === undefined || contentMap[field] === null ? '' : String(contentMap[field]);
      const otherValues = (dimension.values || [])
        .map(value => String(value || ''))
        .filter(value => value && value !== ownValue && value.length >= 2)
        .filter(value => !ownValue.includes(value) && !value.includes(ownValue));

      if (!otherValues.length) continue;

      for (const checkField of checkFields) {
        const text = String(result[checkField] || '');
        if (otherValues.some(value => text.includes(value))) {
          return true;
        }
      }
    }

    return false;
  }

  safeDirName(name = '') {
    return String(name || '')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\.\.+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 80);
  }

  truncateUtf8String(value = '', maxBytes = 180) {
    const limit = Math.max(Number(maxBytes) || 0, 0);
    if (!limit) return '';
    let result = '';
    let bytes = 0;
    for (const char of String(value || '')) {
      const charBytes = Buffer.byteLength(char);
      if (bytes + charBytes > limit) break;
      result += char;
      bytes += charBytes;
    }
    return result;
  }

  safeJsonFileName(name = '') {
    const safeName = String(name || '')
      .trim()
      .replace(/[\\/:*?"<>|\x00-\x1F]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/\.\.+/g, '.')
      .replace(/^[.\-]+|[.\-]+$/g, '');
    return this.truncateUtf8String(safeName, 180).replace(/^[.\-]+|[.\-]+$/g, '');
  }

  getArticleCompanyBucketDir(index = 0) {
    const num = Math.max(Number(index) || 0, 0);
    return String(Math.floor(num / 1000) + 1);
  }

  getArticleCompanyNumericPath(cacheDir, index = 0) {
    return path.join(cacheDir, this.getArticleCompanyBucketDir(index), `${index}.json`);
  }

  getArticleCompanyNamePath(cacheDir, fileName = '') {
    const safeFileName = path.basename(String(fileName || ''));
    const hash = safeFileName.replace(/\.json$/i, '');
    if (/^[a-f0-9]{32}$/i.test(hash)) {
      return path.join(cacheDir, 'name', hash.slice(0, 2), hash.slice(2, 4), `${hash}.json`);
    }
    return path.join(cacheDir, 'name', safeFileName);
  }

  async getArticleCompanyNumericJsonPaths(cacheDir) {
    const paths = [];
    const collect = async currentDir => {
      let entries = [];
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch (e) {
        return;
      }

      for (const entry of entries) {
        const entryPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (/^\d+$/.test(entry.name)) {
            await collect(entryPath);
          }
          continue;
        }

        if (/^\d+\.json$/i.test(entry.name)) {
          paths.push(entryPath);
        }
      }
    };

    await collect(cacheDir);

    return paths.sort((a, b) => {
      const aNum = Number(path.basename(a, '.json'));
      const bNum = Number(path.basename(b, '.json'));
      if (aNum !== bNum) return aNum - bNum;
      return a.localeCompare(b);
    });
  }

  normalizeArticleCbdDocFromCache(json = {}, row = {}, numericIndex = 0) {
    const doc = {
      title: json.title || '',
      keywords: json.keywords || '',
      description: json.description || '',
      content: json.content || '',
      image: json.image || '',
      prevName: json.prevName || '',
      nextName: json.nextName || '',
      nowName: json.nowName || '',
      block: {
        ...(json.block || {}),
        b_number: Number.isNaN(Number(numericIndex)) ? (json.block && json.block.b_number) : Number(numericIndex),
      },
      articleCompany: row._id,
    };

    if (json.createdAt) {
      const createdAt = new Date(json.createdAt);
      if (!Number.isNaN(createdAt.getTime())) {
        doc.createdAt = createdAt;
      }
    }

    return doc;
  }

  async insertArticleCbdBatch(ArticleCbdModel, batch = []) {
    if (!batch.length) return 0;
    try {
      const result = await ArticleCbdModel.insertMany(batch, { ordered: false });
      return Array.isArray(result) ? result.length : batch.length;
    } catch (err) {
      if (Array.isArray(err && err.insertedDocs)) {
        return err.insertedDocs.length;
      }
      if (err && err.result && typeof err.result.nInserted === 'number') {
        return err.result.nInserted;
      }
      throw err;
    }
  }

  async dropArticleCbdTitleFactoryUniqueIndex(ArticleCbdModel) {
    const logger = this.ctx.logger || this.app.logger || console;
    try {
      const indexes = await ArticleCbdModel.collection.indexes();
      for (const indexInfo of indexes) {
        const key = indexInfo && indexInfo.key ? indexInfo.key : {};
        const hasTitle = Object.prototype.hasOwnProperty.call(key, 'title');
        const hasArticleCompany = Object.prototype.hasOwnProperty.call(key, 'articleCompany');
        if (indexInfo.unique && hasTitle && hasArticleCompany && indexInfo.name) {
          await ArticleCbdModel.collection.dropIndex(indexInfo.name);
          logger.info(`[articleCompany] dropped articleCbd unique index: ${indexInfo.name}`);
        }
      }
    } catch (err) {
      logger.error('[articleCompany] drop articleCbd title/articleCompany unique index failed', err);
    }
  }

  getUniqueJsonFileName(baseName, fileNames, fallbackIndex) {
    let safeBaseName = this.safeJsonFileName(baseName) || String(fallbackIndex);
    if (/^\d+$/.test(safeBaseName)) {
      safeBaseName = `t_${safeBaseName}`;
    }
    let fileName = `${safeBaseName}.json`;
    if (fileNames.has(fileName)) {
      fileName = `${safeBaseName}-${fallbackIndex}.json`;
      let suffix = 2;
      while (fileNames.has(fileName)) {
        fileName = `${safeBaseName}-${fallbackIndex}-${suffix}.json`;
        suffix++;
      }
    }

    fileNames.add(fileName);
    return fileName;
  }

  hashArticleCompanyName(name = '') {
    return crypto.createHash('md5').update(String(name || '')).digest('hex');
  }

  getArticleCompanyNameFileName(articleName = '') {
    return `${this.hashArticleCompanyName(articleName)}.json`;
  }

  getUniqueArticleNameInfo(baseName, fileNames, fallbackIndex) {
    let urlName = this.safeJsonFileName(baseName) || String(fallbackIndex);
    if (/^\d+$/.test(urlName)) {
      urlName = `t_${urlName}`;
    }
    urlName = `${urlName}-${fallbackIndex}`;
    const fileName = this.getArticleCompanyNameFileName(urlName);

    if (fileNames && typeof fileNames.add === 'function') {
      fileNames.add(fileName);
    }
    return { urlName, fileName };
  }

  compactContentMap(contentMap = {}) {
    return Object.entries(contentMap || {}).reduce((result, [ key, value ]) => {
      result[key] = this.truncateUtf8String(this.valueToString(value), 180);
      return result;
    }, {});
  }

  getContentMapAtIndex(dimensions = [], comboIndex = 0) {
    const result = {};
    let divisor = 1;
    const indexes = [];
    for (let index = dimensions.length - 1; index >= 0; index--) {
      const values = Array.isArray(dimensions[index].values) ? dimensions[index].values : [];
      const count = values.length || 1;
      indexes[index] = Math.floor(comboIndex / divisor) % count;
      divisor *= count;
    }

    dimensions.forEach((dimension, index) => {
      const values = Array.isArray(dimension.values) ? dimension.values : [];
      result[dimension.field] = values[indexes[index]];
    });

    return result;
  }

  async getArticleCompanyPreviousName(cacheDir, index) {
    if (index < 0) return '';
    try {
      const json = JSON.parse(await fs.promises.readFile(this.getArticleCompanyNumericPath(cacheDir, index), 'utf8'));
      return json && json.nowName ? String(json.nowName) : '';
    } catch (e) {
      return '';
    }
  }

  *cartesianContentMaps(dimensions = [], index = 0, current = {}) {
    if (index >= dimensions.length) {
      yield { ...current };
      return;
    }

    const dimension = dimensions[index];
    for (const value of dimension.values) {
      current[dimension.field] = value;
      yield* this.cartesianContentMaps(dimensions, index + 1, current);
    }

    delete current[dimension.field];
  }

  async pushWriteTask(tasks, task, concurrency = 20) {
    tasks.push(task);
    if (tasks.length >= concurrency) {
      await Promise.all(tasks);
      tasks.length = 0;
    }
  }

  sleep(ms = 0) {
    const timeout = Math.max(Number(ms) || 0, 0);
    if (!timeout) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, timeout));
  }

  withTimeout(promise, timeoutMs = 60000, label = 'task') {
    const timeout = Math.max(Number(timeoutMs) || 0, 0);
    if (!timeout) return promise;

    let timer = null;
    const timeoutPromise = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${label} timeout after ${timeout}ms`));
      }, timeout);
    });

    return Promise.race([ promise, timeoutPromise ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  normalizeGenerateMaxRunMs(value) {
    const defaultMs = 10 * 60 * 1000;
    const maxMs = 60 * 60 * 1000;
    const raw = Math.max(Number(value) || defaultMs, 0);
    if (!raw) return 0;
    return Math.min(raw, maxMs);
  }

  isProcessAlive(pid) {
    const processId = Number(pid);
    if (!Number.isInteger(processId) || processId <= 0) return false;
    try {
      process.kill(processId, 0);
      return true;
    } catch (err) {
      return false;
    }
  }

  async getArticleCompanyTaskProgress(dir, fileName) {
    try {
      return JSON.parse(await fs.promises.readFile(path.join(dir, fileName), 'utf8'));
    } catch (err) {
      return null;
    }
  }

  getArticleCompanyGenerateLockPath() {
    return path.join(process.cwd(), 'run', 'article-company-generate', 'generate.lock');
  }

  async acquireArticleCompanyGenerateLock(data = {}) {
    const lockPath = this.getArticleCompanyGenerateLockPath();
    await fs.promises.mkdir(path.dirname(lockPath), { recursive: true });

    const tryAcquire = async () => {
      const handle = await fs.promises.open(lockPath, 'wx');
      try {
        await handle.writeFile(JSON.stringify({
          ...data,
          ownerPid: process.pid,
          createdAt: new Date().toISOString(),
        }, null, 2), 'utf8');
      } finally {
        await handle.close();
      }
      return lockPath;
    };

    try {
      return await tryAcquire();
    } catch (err) {
      if (!err || err.code !== 'EEXIST') throw err;

      const lockData = await this.getArticleCompanyTaskProgress(
        path.dirname(lockPath),
        path.basename(lockPath)
      );
      const runningPid = lockData && (lockData.childPid || lockData.ownerPid);
      if (this.isProcessAlive(runningPid)) {
        throw new Error(`article company generate is already running, pid=${runningPid}`);
      }

      // 上一次进程异常退出会留下锁文件；确认进程不存在后才清理并重试。
      await fs.promises.unlink(lockPath).catch(unlinkErr => {
        if (unlinkErr && unlinkErr.code !== 'ENOENT') throw unlinkErr;
      });
      return await tryAcquire();
    }
  }

  async updateArticleCompanyGenerateLock(lockPath, data = {}) {
    if (!lockPath) return;
    await fs.promises.writeFile(lockPath, JSON.stringify({
      ...data,
      updatedAt: new Date().toISOString(),
    }, null, 2), 'utf8');
  }

  async releaseArticleCompanyGenerateLock(lockPath = this.getArticleCompanyGenerateLockPath()) {
    await fs.promises.unlink(lockPath).catch(err => {
      if (err && err.code !== 'ENOENT') throw err;
    });
  }

  async writeArticleCompanyGenerateProgress(dir, data = {}) {
    try {
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(
        path.join(dir, 'generate-progress.json'),
        JSON.stringify({
          ...data,
          updatedAt: new Date().toISOString(),
        }, null, 2),
        'utf8'
      );
    } catch (err) {
      const logger = this.ctx.logger || this.app.logger || console;
      logger.warn('[articleCompany] write generate progress failed', err);
    }
  }

  async writeArticleCompanyGenerateError(dir, err, data = {}) {
    const errorData = {
      ...data,
      status: 'error',
      message: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack : '',
      updatedAt: new Date().toISOString(),
    };

    await this.writeArticleCompanyGenerateProgress(dir, errorData);

    try {
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.appendFile(
        path.join(dir, 'generate-error.log'),
        `${JSON.stringify(errorData, null, 2)}\n\n`,
        'utf8'
      );
    } catch (writeErr) {
      const logger = this.ctx.logger || this.app.logger || console;
      logger.warn('[articleCompany] write generate error failed', writeErr);
    }
  }

  async writeArticleCompanyImportProgress(dir, data = {}) {
    try {
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(
        path.join(dir, 'import-progress.json'),
        JSON.stringify({
          ...data,
          updatedAt: new Date().toISOString(),
        }, null, 2),
        'utf8'
      );
    } catch (err) {
      const logger = this.ctx.logger || this.app.logger || console;
      logger.warn('[articleCompany] write import progress failed', err);
    }
  }

  async writeArticleCompanyImportError(dir, err, data = {}) {
    const errorData = {
      ...data,
      status: 'error',
      message: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack : '',
      updatedAt: new Date().toISOString(),
    };

    await this.writeArticleCompanyImportProgress(dir, errorData);

    try {
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.appendFile(
        path.join(dir, 'import-error.log'),
        `${JSON.stringify(errorData, null, 2)}\n\n`,
        'utf8'
      );
    } catch (writeErr) {
      const logger = this.ctx.logger || this.app.logger || console;
      logger.warn('[articleCompany] write import error failed', writeErr);
    }
  }

  startArticleCompanyGenerateProcess({
    id,
    templateIndexes,
    writeConcurrency,
    strictMixedBlock,
    generateDelayMs,
    generateDelayStep,
    generateMaxRunMs,
  } = {}) {
    const scriptPath = path.join(process.cwd(), 'scripts', 'article-company-generate.js');
    const logDir = path.join(process.cwd(), 'run', 'article-company-generate');
    fs.mkdirSync(logDir, { recursive: true });

    const args = [ scriptPath, '--id', String(id || '') ];
    if (Array.isArray(templateIndexes) && templateIndexes.length) {
      args.push('--templateIndexes', templateIndexes.join(','));
    }
    if (writeConcurrency) {
      args.push('--writeConcurrency', String(writeConcurrency));
    }
    if (generateDelayMs) {
      args.push('--generateDelayMs', String(generateDelayMs));
    }
    if (generateDelayStep) {
      args.push('--generateDelayStep', String(generateDelayStep));
    }
    if (generateMaxRunMs) {
      args.push('--generateMaxRunMs', String(generateMaxRunMs));
    }
    if (strictMixedBlock) {
      args.push('--strictMixedBlock', 'true');
    }

    const stdout = fs.openSync(path.join(logDir, 'generate.out.log'), 'a');
    const stderr = fs.openSync(path.join(logDir, 'generate.err.log'), 'a');
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      detached: true,
      stdio: [ 'ignore', stdout, stderr ],
      env: {
        ...process.env,
        ARTICLE_COMPANY_GENERATE_CHILD: '1',
        NODE_OPTIONS: process.env.ARTICLE_COMPANY_GENERATE_NODE_OPTIONS || '--max-old-space-size=512',
        EGG_SERVER_ENV: process.env.EGG_SERVER_ENV || this.app.config.env || 'prod',
      },
    });

    child.unref();
    return child.pid;
  }

  startArticleCompanyImportProcess({
    id,
    batchSize,
    clearExisting,
  } = {}) {
    const scriptPath = path.join(process.cwd(), 'scripts', 'article-company-import-cbd.js');
    const logDir = path.join(process.cwd(), 'run', 'article-company-import-cbd');
    fs.mkdirSync(logDir, { recursive: true });

    const args = [ scriptPath, '--id', String(id || '') ];
    if (batchSize) {
      args.push('--batchSize', String(batchSize));
    }
    if (clearExisting) {
      args.push('--clearExisting', 'true');
    }

    const stdout = fs.openSync(path.join(logDir, 'import.out.log'), 'a');
    const stderr = fs.openSync(path.join(logDir, 'import.err.log'), 'a');
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      detached: true,
      stdio: [ 'ignore', stdout, stderr ],
      env: {
        ...process.env,
        ARTICLE_COMPANY_IMPORT_CHILD: '1',
        NODE_OPTIONS: process.env.ARTICLE_COMPANY_IMPORT_NODE_OPTIONS || '--max-old-space-size=1024',
        EGG_SERVER_ENV: process.env.EGG_SERVER_ENV || this.app.config.env || 'prod',
      },
    });

    child.unref();
    return child.pid;
  }

  async writeArticleCompanySitemap(dir) {
    await fs.promises.mkdir(dir, { recursive: true });
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const rootFiles = entries.filter(entry => entry.isFile()).map(entry => entry.name);
    const rootJsonFiles = rootFiles.filter(file => /\.json$/i.test(file));
    let nameJsonFiles = [];
    try {
      nameJsonFiles = (await fs.promises.readdir(path.join(dir, 'name'))).filter(file => /\.json$/i.test(file));
    } catch (e) {
      nameJsonFiles = [];
    }

    const numericIndexSet = new Set();
    rootJsonFiles
      .filter(file => /^\d+\.json$/i.test(file))
      .forEach(file => numericIndexSet.add(Number(path.basename(file, '.json'))));
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
      let files = [];
      try {
        files = await fs.promises.readdir(path.join(dir, entry.name));
      } catch (e) {
        files = [];
      }
      files
        .filter(file => /^\d+\.json$/i.test(file))
        .forEach(file => numericIndexSet.add(Number(path.basename(file, '.json'))));
    }
    const numericIndexes = [ ...numericIndexSet ].filter(index => !Number.isNaN(index)).sort((a, b) => a - b);
    const numericCount = numericIndexes.length;
    let names = nameJsonFiles
      .map(file => path.basename(file, '.json'))
      .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true }));
    if (!names.length) {
      names = rootJsonFiles
      .filter(file => !/^\d+\.json$/i.test(file))
      .map(file => path.basename(file, '.json'))
      .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true }));
    }

    if (!names.length) {
      names = numericIndexes.map(index => String(index));
    }

    await fs.promises.writeFile(
      path.join(dir, 'sitemap.txt'),
      names.join('\n') + (names.length ? '\n' : ''),
      'utf8'
    );

    await fs.promises.writeFile(
      path.join(dir, 'num.txt'),
      String(numericCount),
      'utf8'
    );

    return numericCount;
  }

  getArticleCompanyNumCacheKey(factoryId, dirName) {
    return `articleCompany:${factoryId || ''}:${dirName || ''}`;
  }

  async setArticleCompanyNumCache(cacheKey, value) {
    const cacheValue = Number(value) || 0;
    if (this.app.redis) {
      await this.app.redis.set(`nav-${cacheKey}`, JSON.stringify(cacheValue));
      return;
    }

    await this.ctx.service.cache.set(cacheKey, cacheValue);
  }

  runArticleCompanyBackground(task) {
    const logger = this.ctx.logger || this.app.logger || console;
    const run = async () => {
      try {
        await task();
      } catch (err) {
        logger.error('[articleCompany] background task failed', err);
      }
    };

    if (typeof this.ctx.runInBackground === 'function') {
      this.ctx.runInBackground(run);
      return;
    }

    setImmediate(run);
  }

  async articleComapanyGenerate(body = {}) {
    const id = body.id || body._id;

    if (!id) {
      return this.fail('id is required');
    }

    const row = await this.articleCompanyModel.findById(id).lean();
    if (!row) {
      return this.fail('not found', -2);
    }

    const tdkList = Array.isArray(row.tdk) ? row.tdk : [];
    const contentList = Array.isArray(row.content) ? row.content : [];
    const templates = this.getSelectedTemplates(Array.isArray(row.templates) ? row.templates : [], body.templateIndexes);
    const openContentList = contentList.filter(item => item && item.openzh);
    const openContentDimensions = openContentList
      .filter(item => item && item.field)
      .map(item => ({
        field: item.field,
        values: this.contentValueList(item),
      }))
      .filter(item => item.values.length);

    if (!tdkList.length) return this.fail('tdk is empty');
    if (!contentList.length) return this.fail('content is empty');
    if (!templates.length) return this.fail('templates is empty');

    const baseDir = path.join(process.cwd(), 'cache', 'articlecompany');
    const safeFileName = this.safeDirName(row.fileName);
    const cacheDir = safeFileName ? path.join(baseDir, safeFileName) : baseDir;
    const dirCacheName = safeFileName || 'root';
    const writeConcurrency = Math.max(Number(body.writeConcurrency) || 3, 1);
    const generateDelayMs = Math.max(Number(body.generateDelayMs) || 0, 0);
    const generateDelayStep = Math.max(Number(body.generateDelayStep) || 100, 1);
    const generateMaxRunMs = this.normalizeGenerateMaxRunMs(body.generateMaxRunMs);

    if (body.force !== true) {
      const progress = await this.getArticleCompanyTaskProgress(cacheDir, 'generate-progress.json');
      const runningStatuses = [ 'queued', 'starting', 'running', 'finalizing' ];
      const runningPid = progress && (progress.processPid || progress.childPid);
      if (progress && runningStatuses.includes(progress.status) && this.isProcessAlive(runningPid)) {
        return this.fail(`generate is already running, pid=${runningPid}`, -4);
      }
    }

    const expectedCount = (Number(tdkList.length) || 0) *
      openContentDimensions.reduce((total, dimension) => total * ((dimension.values && dimension.values.length) || 0), 1) *
      (Number(templates.length) || 0);
    let generateLockPath = '';
    let childPid = 0;
    try {
      generateLockPath = await this.acquireArticleCompanyGenerateLock({
        articleCompanyId: String(row._id),
        articleCompanyName: row.name || '',
        fileName: row.fileName || '',
      });
      childPid = this.startArticleCompanyGenerateProcess({
        id: row._id,
        templateIndexes: body.templateIndexes,
        writeConcurrency,
        generateDelayMs,
        generateDelayStep,
        generateMaxRunMs,
        strictMixedBlock: body.strictMixedBlock === true,
      });
      await this.updateArticleCompanyGenerateLock(generateLockPath, {
        articleCompanyId: String(row._id),
        articleCompanyName: row.name || '',
        fileName: row.fileName || '',
        childPid,
      });
    } catch (err) {
      if (generateLockPath && !childPid) {
        await this.releaseArticleCompanyGenerateLock(generateLockPath);
      }
      return this.fail(err.message || String(err), -4);
    }
    await this.writeArticleCompanyGenerateProgress(cacheDir, {
      status: 'queued',
      articleCompanyId: row && row._id ? String(row._id) : '',
      articleCompanyName: row && row.name ? row.name : '',
      fileName: row && row.fileName ? row.fileName : '',
      cacheDir,
      expectedCount,
      tdkCount: tdkList.length,
      templateCount: templates.length,
      writeConcurrency,
      generateDelayMs,
      generateDelayStep,
      generateMaxRunMs,
      openDimensions: openContentDimensions.map(item => ({
        field: item.field,
        count: Array.isArray(item.values) ? item.values.length : 0,
      })),
      childPid,
    });

    return this.success({
      status: 'running',
      dir: cacheDir,
      childPid,
    }, 'generate process started');
  }

  async generateArticleCompanyFiles({
    row,
    tdkList,
    templates,
    openContentDimensions,
    contentList,
    cacheDir,
    dirCacheName,
    writeConcurrency = 3,
    generateDelayMs = 0,
    generateDelayStep = 100,
    generateMaxRunMs = 10 * 60 * 1000,
    templateIndexes,
    strictMixedBlock = false,
  }) {
    const startedAt = new Date().toISOString();
    const processStartedAt = Date.now();
    generateMaxRunMs = this.normalizeGenerateMaxRunMs(generateMaxRunMs);
    const expectedCount = (Number(tdkList.length) || 0) *
      openContentDimensions.reduce((total, dimension) => total * ((dimension.values && dimension.values.length) || 0), 1) *
      (Number(templates.length) || 0);
    let writtenCount = 0;
    let fileIndex = 0;
    let skippedMixedCount = 0;
    let skippedSignatureCount = 0;
    let lastProgressAt = 0;
    const progressBase = {
      articleCompanyId: row && row._id ? String(row._id) : '',
      articleCompanyName: row && row.name ? row.name : '',
      fileName: row && row.fileName ? row.fileName : '',
      cacheDir,
      expectedCount,
      tdkCount: tdkList.length,
      templateCount: templates.length,
      writeConcurrency,
      generateDelayMs,
      generateDelayStep,
      generateMaxRunMs,
      openDimensions: openContentDimensions.map(item => ({
        field: item.field,
        count: Array.isArray(item.values) ? item.values.length : 0,
      })),
      processPid: process.pid,
      startedAt,
    };

    const writeProgress = async (status = 'running', extra = {}, force = false) => {
      const now = Date.now();
      const progressTick = writtenCount + skippedMixedCount + skippedSignatureCount;
      if (!force && now - lastProgressAt < 5000 && (progressTick === 0 || progressTick % 100 !== 0)) return;
      lastProgressAt = now;
      await this.writeArticleCompanyGenerateProgress(cacheDir, {
        ...progressBase,
        status,
        fileIndex,
        writtenCount,
        skippedMixedCount,
        skippedSignatureCount,
        ...extra,
      });
    };

    await writeProgress('starting', {}, true);

    try {
      const cacheState = await this.getArticleCompanyCacheState(cacheDir);
      const articleCompanyOutput = this.getArticleCompanyOutput(row);

      fileIndex = Math.max(cacheState.maxIndex + 1, 0);
      const resumeFileIndex = fileIndex;
      let previous = null;
      let prevTitleName = '';
      let combinationIndex = -1;
      const writeTasks = [];
      const tdkFieldPools = this.getTdkFieldPools(tdkList);
      const contentFieldPools = {
        ...this.getContentListFieldPools(contentList),
        ...this.getContentFieldPools(openContentDimensions),
      };
      const writeResult = async (current, nextName = '') => {
        current.result.nextName = nextName;
        const jsonText = JSON.stringify(current.result, null, 2);
        const numericPath = this.getArticleCompanyNumericPath(cacheDir, current.numericIndex);
        const titlePath = this.getArticleCompanyNamePath(cacheDir, current.titleFileName);
        const writeMeta = {
          writingIndex: current.numericIndex,
          writingName: current.result && current.result.nowName ? current.result.nowName : '',
          writingNumericFileName: current.numericFileName,
          writingTitleFileName: current.titleFileName,
          writingNumericPath: numericPath,
          writingTitlePath: titlePath,
        };
        if (current.numericIndex % 100 === 0) {
          await writeProgress('running', {
            stage: 'beforeMkdir',
            ...writeMeta,
          }, true);
        }
        await this.withTimeout(
          fs.promises.mkdir(path.dirname(numericPath), { recursive: true }),
          60000,
          `mkdir numeric dir ${path.dirname(numericPath)}`
        );
        await this.withTimeout(
          fs.promises.mkdir(path.dirname(titlePath), { recursive: true }),
          60000,
          `mkdir name dir ${path.dirname(titlePath)}`
        );
        if (current.numericIndex % 100 === 0) {
          await writeProgress('running', {
            stage: 'beforeWriteNumeric',
            ...writeMeta,
          }, true);
        }
        await this.withTimeout(
          fs.promises.writeFile(numericPath, jsonText, 'utf8'),
          60000,
          `write numeric file ${numericPath}`
        );
        if (current.numericIndex % 100 === 0) {
          await writeProgress('running', {
            stage: 'afterWriteNumeric',
            ...writeMeta,
          }, true);
        }
        await this.withTimeout(
          fs.promises.writeFile(titlePath, jsonText, 'utf8'),
          60000,
          `write name file ${titlePath}`
        );
        if (current.numericIndex % 100 === 0) {
          await writeProgress('running', {
            stage: 'afterWriteName',
            ...writeMeta,
          }, true);
        }
      };

      await writeProgress('running', {
        startFileIndex: fileIndex,
        resumeFileIndex,
      }, true);

      const templateCount = templates.length;
      const contentComboCount = openContentDimensions.reduce((total, dimension) => {
        return total * ((dimension.values && dimension.values.length) || 0);
      }, 1);
      const countPerTdk = contentComboCount * templateCount;
      prevTitleName = await this.getArticleCompanyPreviousName(cacheDir, resumeFileIndex - 1);

      for (let combinationIndex = resumeFileIndex; combinationIndex < expectedCount; combinationIndex++) {
        const tdkIndex = Math.floor(combinationIndex / countPerTdk);
        const inTdkIndex = combinationIndex % countPerTdk;
        const contentComboIndex = Math.floor(inTdkIndex / templateCount);
        const templateIndex = inTdkIndex % templateCount;
        const tdk = tdkList[tdkIndex];
        const contentMap = this.getContentMapAtIndex(openContentDimensions, contentComboIndex);
        const template = templates[templateIndex];

        if (!tdk || !template) break;

        const replaceContentMap = this.getContentReplaceMap(contentFieldPools, contentMap);
        const basePools = this.getTemplateValuePools(contentFieldPools, tdkFieldPools, replaceContentMap);
        const title = this.replaceVars(this.getTdkValue(tdk, 'title', tdkFieldPools), replaceContentMap, basePools);
        const titleMap = {
          ...replaceContentMap,
          title,
        };
        const titlePools = this.getTemplateValuePools(contentFieldPools, tdkFieldPools, replaceContentMap, titleMap);
        const keywords = this.replaceVars(this.getTdkValue(tdk, 'keywords', tdkFieldPools), titleMap, titlePools);
        const keywordsMap = {
          ...titleMap,
          keywords,
        };
        const keywordsPools = this.getTemplateValuePools(contentFieldPools, tdkFieldPools, replaceContentMap, keywordsMap);
        const description = this.replaceVars(this.getTdkValue(tdk, 'description', tdkFieldPools), keywordsMap, keywordsPools);
        const templateMap = {
          ...keywordsMap,
          description,
        };
        const templatePools = this.getTemplateValuePools(contentFieldPools, tdkFieldPools, replaceContentMap, templateMap);
        const templateSectionValues = this.getTemplateSectionValues(row.templateSection, templateMap, templatePools);
        const contentTemplateMap = {
          ...templateMap,
          ...templateSectionValues.map,
        };
        const contentTemplatePools = this.mergeValuePools(templatePools, templateSectionValues.pools);
        const blockOutputMap = this.getBlockOutputMap(contentMap);
        const createdAt = new Date().toISOString();
        const result = {
          block: {
            ...blockOutputMap,
          },
          title,
          keywords,
          description,
          image: this.getRandomArticleImage(row.imgTypeName),
          content: this.replaceVars(template.content || template.text || '', contentTemplateMap, contentTemplatePools),
          createdAt,
          articleCompany: articleCompanyOutput,
        };

        if (strictMixedBlock && this.hasMixedBlockValues(result, replaceContentMap, openContentDimensions)) {
          skippedMixedCount++;
          await writeProgress('running');
          continue;
        }

        fileIndex = combinationIndex;
        const numericFileName = `${combinationIndex}.json`;
        if (fileIndex % 100 === 0) {
          await writeProgress('running', {
            stage: 'beforeBuildFileName',
            currentFileIndex: fileIndex,
            currentTdkIndex: tdkIndex,
            currentContentComboIndex: contentComboIndex,
            currentTemplateIndex: templateIndex,
            currentContentMap: this.compactContentMap(contentMap),
            currentTitle: this.truncateUtf8String(result.title, 180),
          }, true);
        }
        const articleNameInfo = this.getUniqueArticleNameInfo(result.title, null, combinationIndex);
        const titleFileName = articleNameInfo.fileName;
        result.nowName = articleNameInfo.urlName;
        result.prevName = prevTitleName;
        result.block.b_number = combinationIndex;
        const current = { numericIndex: combinationIndex, numericFileName, titleFileName, result };
        if (previous) {
          if (previous.numericIndex % 100 === 0) {
            await writeProgress('running', {
              stage: 'beforeWrite',
              writingIndex: previous.numericIndex,
              writingName: previous.result && previous.result.nowName ? previous.result.nowName : '',
              writingNumericFileName: previous.numericFileName,
              writingTitleFileName: previous.titleFileName,
            }, true);
          }
          await writeResult(previous, articleNameInfo.urlName);
          writtenCount++;
          await writeProgress('running', {
            stage: 'afterWrite',
            lastWrittenIndex: previous.numericIndex,
            lastWrittenName: previous.result && previous.result.nowName ? previous.result.nowName : '',
          });
          if (generateDelayMs > 0 && writtenCount % generateDelayStep === 0) {
            await this.sleep(generateDelayMs);
          }
          if (generateMaxRunMs > 0 && Date.now() - processStartedAt >= generateMaxRunMs) {
            await writeProgress('paused', {
              reason: 'generateMaxRunMs',
              stage: 'timeLimitReached',
              lastWrittenIndex: previous.numericIndex,
              lastWrittenName: previous.result && previous.result.nowName ? previous.result.nowName : '',
              nextStartFileIndex: combinationIndex,
            }, true);
            return {
              count: writtenCount,
              dir: cacheDir,
              paused: true,
              reason: 'generateMaxRunMs',
              nextStartFileIndex: combinationIndex,
            };
          }
        }
        previous = current;
        prevTitleName = result.nowName;
        fileIndex = combinationIndex + 1;
      }

      if (previous) {
        await writeResult(previous);
        writtenCount++;
        await writeProgress('running', {
          lastWrittenIndex: previous.numericIndex,
          lastWrittenName: previous.result && previous.result.nowName ? previous.result.nowName : '',
        }, true);
      }

      if (writeTasks.length) {
        await Promise.all(writeTasks);
      }

      await writeProgress('finalizing', {}, true);
      const sitemapCount = await this.writeArticleCompanySitemap(cacheDir);
      const articleCompanyNumCacheKey = this.getArticleCompanyNumCacheKey(row._id, dirCacheName);
      await this.setArticleCompanyNumCache(articleCompanyNumCacheKey, sitemapCount);
      const logger = this.ctx.logger || this.app.logger || console;
      logger.info(`[articleCompany] generate done: ${cacheDir}, written=${writtenCount}, sitemap=${sitemapCount}, skippedMixed=${skippedMixedCount}, skippedSignature=${skippedSignatureCount}`);
      await writeProgress('done', { sitemapCount }, true);

      return {
        count: writtenCount,
        dir: cacheDir,
        sitemap: path.join(cacheDir, 'sitemap.txt'),
        sitemapCount,
      };
    } catch (err) {
      await this.writeArticleCompanyGenerateError(cacheDir, err, {
        ...progressBase,
        fileIndex,
        writtenCount,
        skippedMixedCount,
        skippedSignatureCount,
      });
      throw err;
    }
  }

  async articleComapanyImportCbd(body = {}) {
    const id = body.id || body._id;

    if (!id) {
      return this.fail('id is required');
    }

    const row = await this.articleCompanyModel.findById(id).lean();
    if (!row) {
      return this.fail('not found', -2);
    }

    const ArticleCbdModel = this.ctx.model.ArticleCbd || this.ctx.model.ArticleCBD || this.ctx.model.articleCbd;
    if (!ArticleCbdModel) {
      return this.fail('articleCbd model not found', -3);
    }

    const batchSize = Math.max(Number(body.batchSize) || 1000, 1);
    const { cacheDir } = this.getArticleCompanyCacheDir(row);
    if (!cacheDir) {
      return this.fail('fileName is required');
    }

    if (body.force !== true) {
      const progress = await this.getArticleCompanyTaskProgress(cacheDir, 'import-progress.json');
      const runningStatuses = [ 'queued', 'starting', 'running', 'finalizing' ];
      const runningPid = progress && (progress.processPid || progress.childPid);
      if (progress && runningStatuses.includes(progress.status) && this.isProcessAlive(runningPid)) {
        return this.fail(`import is already running, pid=${runningPid}`, -4);
      }
    }

    const childPid = this.startArticleCompanyImportProcess({
      id: row._id,
      batchSize,
      clearExisting: body.clearExisting === true,
    });
    await this.writeArticleCompanyImportProgress(cacheDir, {
      status: 'queued',
      articleCompanyId: row && row._id ? String(row._id) : '',
      articleCompanyName: row && row.name ? row.name : '',
      fileName: row && row.fileName ? row.fileName : '',
      cacheDir,
      batchSize,
      clearExisting: body.clearExisting === true,
      childPid,
    });

    return this.success({
      status: 'running',
      articleCompany: this.getArticleCompanyOutput(row),
      dir: cacheDir,
      childPid,
    }, 'import process started');
  }

  async importArticleCompanyCbdFromCache({
    row,
    ArticleCbdModel,
    cacheDir,
    batchSize = 1000,
    clearExisting = false,
  }) {
    const articleCompanyId = row._id;
    const logger = this.ctx.logger || this.app.logger || console;
    let insertedCount = 0;
    let readErrorCount = 0;
    let processedCount = 0;
    let batch = [];
    let totalCount = 0;
    let lastProgressAt = 0;
    const startedAt = new Date().toISOString();
    const progressBase = {
      articleCompanyId: articleCompanyId ? String(articleCompanyId) : '',
      articleCompanyName: row && row.name ? row.name : '',
      fileName: row && row.fileName ? row.fileName : '',
      cacheDir,
      batchSize,
      clearExisting,
      startedAt,
    };

    const writeProgress = async (status = 'running', extra = {}, force = false) => {
      const now = Date.now();
      if (!force && now - lastProgressAt < 5000 && (processedCount === 0 || processedCount % 100 !== 0)) return;
      lastProgressAt = now;
      await this.writeArticleCompanyImportProgress(cacheDir, {
        ...progressBase,
        status,
        totalCount,
        processedCount,
        insertedCount,
        readErrorCount,
        pendingBatchCount: batch.length,
        ...extra,
      });
    };

    await writeProgress('starting', {}, true);

    try {
      const jsonPaths = await this.getArticleCompanyNumericJsonPaths(cacheDir);
      totalCount = jsonPaths.length;
      await writeProgress('running', { totalCount }, true);

      await this.dropArticleCbdTitleFactoryUniqueIndex(ArticleCbdModel);

      if (clearExisting) {
        await ArticleCbdModel.deleteMany({ articleCompany: articleCompanyId });
        await writeProgress('running', { clearedExisting: true }, true);
      }

      const pushDoc = async doc => {
        batch.push(doc);
        if (batch.length >= batchSize) {
          insertedCount += await this.insertArticleCbdBatch(ArticleCbdModel, batch);
          batch = [];
          await writeProgress('running', { lastInsertedAt: new Date().toISOString() }, true);
        }
      };

      for (const jsonPath of jsonPaths) {
        try {
          const json = JSON.parse(await fs.promises.readFile(jsonPath, 'utf8'));
          const numericIndex = Number(path.basename(jsonPath, '.json'));
          await pushDoc(this.normalizeArticleCbdDocFromCache(json, row, numericIndex));
        } catch (e) {
          readErrorCount++;
          logger.error(`[articleCompany] import cbd cache read failed: ${jsonPath}`, e);
        }
        processedCount++;
        await writeProgress('running', { lastReadPath: jsonPath });
      }

      if (batch.length) {
        insertedCount += await this.insertArticleCbdBatch(ArticleCbdModel, batch);
        batch = [];
      }

      logger.info(`[articleCompany] import cbd cache done: articleCompany=${articleCompanyId}, cacheFiles=${jsonPaths.length}, inserted=${insertedCount}, readError=${readErrorCount}, clearExisting=${clearExisting}`);
      await writeProgress('done', {}, true);

      return {
        count: insertedCount,
        cacheFiles: jsonPaths.length,
        readError: readErrorCount,
        articleCompany: this.getArticleCompanyOutput(row),
      };
    } catch (err) {
      await this.writeArticleCompanyImportError(cacheDir, err, {
        ...progressBase,
        totalCount,
        processedCount,
        insertedCount,
        readErrorCount,
        pendingBatchCount: batch.length,
      });
      throw err;
    }
  }

  async importArticleCompanyCbd({
    row,
    ArticleCbdModel,
    tdkList,
    contentList,
    templates,
    openContentDimensions,
    batchSize = 1000,
    strictMixedBlock = false,
  }) {
    const signatures = new Set();
    const fileNames = new Set();
    const articleCompanyId = row._id;
    let number = 0;
    let previous = null;
    let prevTitleName = '';
    let insertedCount = 0;
    let batch = [];
    let skippedMixedCount = 0;
    let skippedSignatureCount = 0;
    const tdkFieldPools = this.getTdkFieldPools(tdkList);
    const contentFieldPools = {
      ...this.getContentListFieldPools(contentList),
      ...this.getContentFieldPools(openContentDimensions),
    };
    const pushDoc = async doc => {
      batch.push(doc);
      if (batch.length >= batchSize) {
        const result = await ArticleCbdModel.insertMany(batch, { ordered: false });
        insertedCount += Array.isArray(result) ? result.length : batch.length;
        batch = [];
      }
    };

    for (const tdk of tdkList) {
      for (const contentMap of this.cartesianContentMaps(openContentDimensions)) {
        const replaceContentMap = this.getContentReplaceMap(contentFieldPools, contentMap);
        const basePools = this.getTemplateValuePools(contentFieldPools, tdkFieldPools, replaceContentMap);
        const title = this.replaceVars(this.getTdkValue(tdk, 'title', tdkFieldPools), replaceContentMap, basePools);
        const titleMap = {
          ...replaceContentMap,
          title,
        };
        const titlePools = this.getTemplateValuePools(contentFieldPools, tdkFieldPools, replaceContentMap, titleMap);
        const keywords = this.replaceVars(this.getTdkValue(tdk, 'keywords', tdkFieldPools), titleMap, titlePools);
        const keywordsMap = {
          ...titleMap,
          keywords,
        };
        const keywordsPools = this.getTemplateValuePools(contentFieldPools, tdkFieldPools, replaceContentMap, keywordsMap);
        const description = this.replaceVars(this.getTdkValue(tdk, 'description', tdkFieldPools), keywordsMap, keywordsPools);
        const templateMap = {
          ...keywordsMap,
          description,
        };
        const templatePools = this.getTemplateValuePools(contentFieldPools, tdkFieldPools, replaceContentMap, templateMap);
        const templateSectionValues = this.getTemplateSectionValues(row.templateSection, templateMap, templatePools);
        const contentTemplateMap = {
          ...templateMap,
          ...templateSectionValues.map,
        };
        const contentTemplatePools = this.mergeValuePools(templatePools, templateSectionValues.pools);
        const blockOutputMap = this.getBlockOutputMap(contentMap);

        for (const template of templates) {
          const createdAt = new Date();
          const result = {
            block: {
              ...blockOutputMap,
              b_number: number,
            },
            title,
            keywords,
            description,
            image: this.getRandomArticleImage(row.imgTypeName),
            content: this.replaceVars(template.content || template.text || '', contentTemplateMap, contentTemplatePools),
            createdAt,
            articleCompany: articleCompanyId,
          };

          if (strictMixedBlock && this.hasMixedBlockValues(result, replaceContentMap, openContentDimensions)) {
            skippedMixedCount++;
            continue;
          }

          const signature = this.articleJsonSignature(result);
          if (signatures.has(signature)) {
            skippedSignatureCount++;
            continue;
          }
          signatures.add(signature);

          const titleFileName = this.getUniqueJsonFileName(result.title, fileNames, number);
          result.nowName = path.basename(titleFileName, '.json');
          result.prevName = prevTitleName;
          result._nextTitleFileName = titleFileName;
          if (previous) {
            previous.nextName = path.basename(titleFileName, '.json');
            delete previous._nextTitleFileName;
            await pushDoc(previous);
          }
          previous = result;
          prevTitleName = result.nowName;
          number++;
        }
      }
    }

    if (previous) {
      previous.nextName = '';
      delete previous._nextTitleFileName;
      await pushDoc(previous);
    }

    if (batch.length) {
      const result = await ArticleCbdModel.insertMany(batch, { ordered: false });
      insertedCount += Array.isArray(result) ? result.length : batch.length;
    }
    const logger = this.ctx.logger || this.app.logger || console;
    logger.info(`[articleCompany] import cbd done: articleCompany=${articleCompanyId}, inserted=${insertedCount}, skippedMixed=${skippedMixedCount}, skippedSignature=${skippedSignatureCount}`);

    return {
      count: insertedCount,
      articleCompany: this.getArticleCompanyOutput(row),
    };
  }
}

module.exports = ArticleComapanyService;
