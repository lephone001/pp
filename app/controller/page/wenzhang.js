'use strict';
const Controller = require('egg').Controller;
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const ArticleController = require('./fanmuluArticle');
const articleJump = require('../../middleware/jump')();
const publishTimeFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
class WenzhangPageController extends Controller {
  replaceMuluTokens(value, domain) {
    const { ctx } = this;
    return String(value || '').replace(/\[站名\]|站名/g, domain.beiAnName || '')
      .replace(/\[域名\]|域名/g, (ctx.header && ctx.header.host || ctx.host || '') + ctx.url)
      .replace(/\[数字\]|数字/g, domain.urlNumber || '')
      .replace(/\[字母\]|字母/g, ctx.service.utils.urlToStr(domain.fullDomain + ctx.url))
      .replace(/\[符号\]|符号/g, ctx.service.utils.urlToemoj(domain.fullDomain + ctx.url))
      .replace(/\[版本号\]|版本号/g, domain.banBenNumber || '');
  }
  async pageKeyword(domain, useMulu) {
    if (useMulu) {
      const muluIndex = this.ctx.service.utils.strToNumber(domain.fullDomain + this.ctx.url);
      const item = await this.ctx.service.utils.getMuluItemOne(muluIndex, domain.mcid);
      return this.replaceMuluTokens(item && item.keywords, domain).replace(/<[^>]*>/g, '').trim().slice(0, 300);
    }
    const words = await this.ctx.service.fanmuluArticle.getPool('keyword');
    if (!words.length) return '';
    const seed = (this.ctx.host || '') + (this.ctx.originalUrl || this.ctx.url || this.ctx.path);
    const index = crypto.createHash('sha256').update(seed).digest().readUInt32BE(0) % words.length;
    return String(words[index]).replace(/<[^>]*>/g, '').trim().slice(0, 300);
  }
  async fallbackArticle() {
    const { ctx } = this;
    const target = ctx.path.replace(/^\/WenZhang(?:MuLu)?\/?/i, '/Article/');
    const original = { path: ctx.path, url: ctx.url, originalUrl: ctx.originalUrl };
    try {
      // Internal dispatch only: Article selects its template and cache using this path.
      ctx.url = target + (ctx.querystring ? '?' + ctx.querystring : '');
      ctx.path = target;
      ctx.originalUrl = ctx.url;
      await articleJump(ctx, async () => new ArticleController(ctx).article());
    } finally {
      ctx.url = original.url;
      ctx.path = original.path;
      ctx.originalUrl = original.originalUrl;
    }
  }
  async index() {
    const { ctx } = this;
    const useMulu = /^\/WenZhangMuLu(?:\/|$)/i.test(ctx.path);
    const routeBase = useMulu ? '/WenZhangMuLu' : '/WenZhang';
    const tail = ctx.path.replace(/^\/WenZhang(?:MuLu)?\/?/i, '');
    const isList = !tail || /^(?:index|list)\.html$/i.test(tail);
    const id = tail.replace(/(?:\.html|\/index\.html)$/i, '');
    if (!isList && !/^[a-f0-9]{24}$/i.test(id)) return this.fallbackArticle();
    const info = await ctx.service.utils.getSiteInfo();
    const domain = info && info.domain || {};
    let detail = null, listing = { rows: [], hasPrev: false, hasNext: false };
    let neighbors = { previous: null, next: null };
    if (isList) {
      if (ctx.query.categoryId && !/^[a-f0-9]{24}$/i.test(ctx.query.categoryId)) { ctx.status = 404; return; }
      if ((ctx.query.id && !/^[a-f0-9]{24}$/i.test(ctx.query.id)) ||
        (ctx.query.direction && !['prev', 'next'].includes(ctx.query.direction))) { ctx.status = 404; return; }
      listing = await ctx.service.wenzhang.publicList(ctx.query);
    } else {
      detail = await ctx.service.wenzhang.detail(id);
      if (!detail) return this.fallbackArticle();
      neighbors = await ctx.service.wenzhang.neighbors(id);
      const published = detail.publishedAt ? new Date(detail.publishedAt) : null;
      detail = { ...detail, publishedAtText: published && Number.isFinite(published.getTime())
        ? publishTimeFormat.format(published) : '暂无' };
    }
    // Only real WenZhang pages reach here; Article fallbacks have already returned.
    const keyword = await this.pageKeyword(domain, useMulu);
    const prefix = value => keyword ? keyword + ' ' + String(value || '') : String(value || '');
    if (detail) detail = { ...detail, title: prefix(detail.title), description: prefix(detail.description) };
    const title = detail ? detail.title : prefix('文章');
    const description = detail ? detail.description : prefix('游戏与科技文章');
    let template = 'template/components/wenzhang.html';
    if (/^[a-zA-Z0-9_-]+$/.test(domain.tname || '')) {
      const custom = `template/${domain.tname}/wenzhang.html`;
      try { if ((await fs.stat(path.join(ctx.app.baseDir, 'app/view', custom))).isFile()) template = custom; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    ctx.set('Cache-Control', 'no-cache');
    ctx.type = 'text/html';
    const categoryQuery = ctx.query.categoryId ? '&categoryId=' + ctx.query.categoryId : '';
    await ctx.render(template, {
      domain, siteInfo: info && info.site || {}, detail, article: detail, isList,
      articleList: listing.rows,
      categories: isList ? await ctx.service.wenzhang.categories() : [],
      prevUrl: listing.hasPrev ? `${routeBase}/list.html?id=${listing.rows[0]._id}&direction=prev${categoryQuery}`
        : isList && ctx.query.id && !listing.rows.length ? `${routeBase}/list.html${ctx.query.categoryId ? '?categoryId=' + ctx.query.categoryId : ''}` : '',
      nextUrl: listing.hasNext ? `${routeBase}/list.html?id=${listing.rows[listing.rows.length - 1]._id}&direction=next${categoryQuery}` : '',
      title, description, keyword, routeBase,
      previousArticle: neighbors.previous, nextArticle: neighbors.next,
    });
  }
}
module.exports = WenzhangPageController;
