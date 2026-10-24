'use strict';

const Controller = require('egg').Controller;

class MissPageController extends Controller {
  async getDomain() { return this.ctx.service.utils.getSiteInfo(); }

  validDomain(domain) { return !domain || !domain._id || Number(domain.siteType) === 12; }

  templateName(domain) {
    return String(domain && domain.tname || '').trim();
  }

  baseResult(info, extra = {}) {
    return {
      siteInfo: info.site,
      domain: info.domain,
      userConfig: this.ctx.app.config.MY_USER_CONFIG,
      missSiteType: 12,
      missTemplateName: this.templateName(info.domain),
      ...extra,
    };
  }

  async render(name, result) {
    const templateName = result.missTemplateName;
    if (!templateName) return this.ctx.render('error.html');
    return this.ctx.render(`template/${templateName}/${name}.html`, result).catch(() => {
      if (templateName !== 'miss_02') return this.ctx.render(`template/miss_02/${name}.html`, result);
      return this.ctx.render('error.html');
    });
  }

  async index() {
    const info = await this.getDomain();
    if (!this.validDomain(info.domain)) return this.ctx.render('404.html');
    const data = await this.ctx.service.missPage.homeData();
    return this.render('index', this.baseResult(info, data));
  }

  async category() {
    const info = await this.getDomain();
    if (!this.validDomain(info.domain)) return this.ctx.render('404.html');
    const data = await this.ctx.service.missPage.categoryPage(this.ctx.params.id === 'all' ? '' : this.ctx.params.id, {
      page: this.ctx.query.page,
      limit: this.ctx.query.limit,
      provinceId: this.ctx.query.provinceId,
      cityId: this.ctx.query.cityId,
      keyword: this.ctx.query.keyword || this.ctx.query.q,
    });
    return this.render('category', this.baseResult(info, data));
  }

  async detail() {
    const info = await this.getDomain();
    if (!this.validDomain(info.domain)) return this.ctx.render('404.html');
    const detailId = this.ctx.params.id;
    const cachedData = await this.ctx.service.detailCache.read('miss', detailId);
    if (cachedData) return this.render('detail', this.baseResult(info, cachedData));

    const data = await this.ctx.service.missPage.detailPage(detailId);
    if (!data) return this.ctx.render('404.html');
    const result = await this.render('detail', this.baseResult(info, data));
    await this.ctx.service.detailCache.write('miss', detailId, data);
    return result;
  }

  async leaders() {
    const info = await this.getDomain();
    if (!this.validDomain(info.domain)) return this.ctx.render('404.html');
    const data = await this.ctx.service.missPage.leaderListPage();
    return this.render('leaders', this.baseResult(info, data));
  }

  async leader() {
    const info = await this.getDomain();
    if (!this.validDomain(info.domain)) return this.ctx.render('404.html');
    const data = await this.ctx.service.missPage.leaderPage(this.ctx.params.id, {
      page: this.ctx.query.page,
      limit: this.ctx.query.limit,
    });
    if (!data) return this.ctx.render('404.html');
    return this.render('leader', this.baseResult(info, data));
  }
}

module.exports = MissPageController;
