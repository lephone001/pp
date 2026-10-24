
'use strict';

const Service = require('egg').Service;

class CacheService extends Service {
  async set (key, value) {
    const seconds = this.app.config.common.FILE_TIME
    if (this.app.redis) {
      await this.app.redis.set('nav-' + key, JSON.stringify(value), 'EX', seconds)
    }
  }

  async get (key) {
    if (this.app.redis) {
      var data = await this.app.redis.get('nav-' + key);
      if (!data) return;
      return JSON.parse(data)
    }
  }
  async del (key) {
    if (this.app.redis) {
      await this.app.redis.del('nav-' + key);
    }
  }
  async clearRedisKeyList (key) {
    if (!key || !this.app.redis) return;

    let cursor = '0'
    let deleted = 0
    const pattern = `nav-*${key}*`

    do {
      const result = await this.app.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      )
      cursor = String(result[0])
      const keys = result[1] || []

      if (keys.length) {
        deleted += await this.app.redis.del(...keys)
      }
    } while (cursor !== '0')

    return {
      code: 200,
      message: '缓存清除成功！',
      deleted
    }
  }
  async flushall () {
    if (this.app.redis) {
      await this.app.redis.flushall();
      return {
        code: 200,
        message: '全部缓存清除成功！'
      }
    }
  }
}

module.exports = CacheService;
