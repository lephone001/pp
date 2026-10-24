'use strict';

const Controller = require('egg').Controller;
const fs = require('fs');
const path = require('path');
const domainDir = path.resolve(__dirname, '../../public/html/domain');

class UplinkDomainController extends Controller {
  async multipleDomainCreate() {
    const { ctx } = this;
    const utils = ctx.service.uplink.utils;
    let domains;
    try {
      if (!ctx.request.body.password || utils.jiemiFn(ctx.request.body.password) !== '888') {
        ctx.body = { code: -1, message: '无效！' };
        return;
      }
      domains = utils.jiemiFn(ctx.request.body.domainList);
      if (!Array.isArray(domains)) throw new Error('invalid domain list');
    } catch (error) {
      ctx.body = { code: -1, message: '无效！' };
      return;
    }
    await fs.promises.mkdir(domainDir, { recursive: true });
    const result = { success: [], filed: [] };
    for (const item of domains) {
      const summary = { title: item.title, link: item.link };
      // 旧接口以域名为文件名，禁止越过隔离目录。
      if (!item.title || typeof item.link !== 'string' || !/^[a-z0-9][a-z0-9.-]*$/i.test(item.link)
          || item.link.indexOf('..') !== -1) {
        result.filed.push(summary);
        continue;
      }
      try {
        await fs.promises.writeFile(path.join(domainDir, item.link + '.json'), JSON.stringify({
          link: item.link, description: item.description, keywords: item.keywords,
          title: item.title, isJump: item.isJump,
        }));
        result.success.push(summary);
      } catch (error) {
        result.filed.push(summary);
      }
    }
    ctx.body = { code: 200, data: utils.jiamiFn(result) };
  }
}

module.exports = UplinkDomainController;
