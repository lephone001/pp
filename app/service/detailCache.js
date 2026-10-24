'use strict';

const Service = require('egg').Service;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_TTL_FALLBACK = 1000 * 60 * 60 * 24 * 3;
const CACHE_NAMESPACES = new Set([ 'miss', 'movie' ]);

function hashId(id) {
  return crypto.createHash('md5').update(String(id)).digest('hex');
}

class DetailCacheService extends Service {
  getCachePath(namespace, id) {
    if (!CACHE_NAMESPACES.has(namespace)) return '';
    const value = String(id || '').trim();
    if (!value || value === '.' || value === '..' || /[\\/:*?"<>|]/.test(value)) return '';

    const root = path.resolve(process.cwd(), 'cache', namespace);
    const hash = hashId(value);
    const filePath = path.resolve(root, hash.slice(0, 2), hash.slice(2, 4), `${value}.json`);
    return filePath.startsWith(`${root}${path.sep}`) ? filePath : '';
  }

  getTtl() {
    const common = this.ctx.app.config.common || {};
    const ttl = Number(common.VIDEO_TIME);
    return Number.isFinite(ttl) && ttl > 0 ? ttl : CACHE_TTL_FALLBACK;
  }

  async read(namespace, id) {
    const filePath = this.getCachePath(namespace, id);
    if (!filePath) return null;

    try {
      const payload = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
      const cacheTime = Number(payload && (payload.cacheTime || payload.updateCacheTime));
      if (!cacheTime || Date.now() - cacheTime >= this.getTtl() || Date.now() - cacheTime < 0) {
        return null;
      }
      return payload.data !== undefined ? payload.data : payload;
    } catch (error) {
      return null;
    }
  }

  async write(namespace, id, data) {
    const filePath = this.getCachePath(namespace, id);
    if (!filePath || data === undefined || data === null) return;

    try {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, JSON.stringify({
        cacheTime: Date.now(),
        data,
      }), 'utf8');
    } catch (error) {
      // 缓存写入失败不能影响正常页面响应。
    }
  }
}

module.exports = DetailCacheService;
