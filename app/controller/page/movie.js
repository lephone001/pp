'use strict';

const Controller = require('egg').Controller;

class MoviePageController extends Controller {
  async getDomain() {
    const info = await this.ctx.service.utils.getSiteInfo();
    return info || {};
  }

  validDomain(domain) {
    return !domain || !domain._id || Number(domain.siteType) === 11;
  }

  baseResult(domain, extra = {}) {
    return {
      siteInfo: extra.siteInfo,
      domain,
      userConfig: this.ctx.app.config.MY_USER_CONFIG,
      movieSiteType: 11,
      ...extra,
    };
  }

  async render(name, result) {
    return this.ctx.render(`template/movie_01/${name}.html`, result).catch(() => this.ctx.render('error.html'));
  }

  async index() {
    const info = await this.getDomain();
    const domain = info.domain;
    if (!this.validDomain(domain)) return this.ctx.render('404.html');
    const data = await this.ctx.service.movie.homeData();
    return this.render('index', this.baseResult(domain, { siteInfo: info.site, ...data }));
  }

  async category() {
    const info = await this.getDomain();
    const domain = info.domain;
    if (!this.validDomain(domain)) return this.ctx.render('404.html');
    const data = await this.ctx.service.movie.listPage({
      typeId: this.ctx.params.id === 'all' ? '' : this.ctx.params.id,
      keyword: this.ctx.query.keyword || this.ctx.query.q,
      page: this.ctx.query.page,
      limit: this.ctx.query.limit,
    });
    return this.render('category', this.baseResult(domain, { siteInfo: info.site, ...data }));
  }

  async search() {
    const info = await this.getDomain();
    const domain = info.domain;
    if (!this.validDomain(domain)) return this.ctx.render('404.html');
    const data = await this.ctx.service.movie.listPage({
      keyword: this.ctx.params.value || this.ctx.query.q,
      page: this.ctx.query.page,
      limit: this.ctx.query.limit,
    });
    return this.render('category', this.baseResult(domain, { siteInfo: info.site, ...data, isSearch: true }));
  }

  async detail() {
    const info = await this.getDomain();
    const domain = info.domain;
    if (!this.validDomain(domain)) return this.ctx.render('404.html');
    const detailId = this.ctx.params.id;
    const cachedData = await this.ctx.service.detailCache.read('movie', detailId);
    if (cachedData) return this.render('detail', this.baseResult(domain, { siteInfo: info.site, ...cachedData }));

    const data = await this.ctx.service.movie.detailPage(detailId);
    if (!data) return this.ctx.render('404.html');
    const result = await this.render('detail', this.baseResult(domain, { siteInfo: info.site, ...data }));
    await this.ctx.service.detailCache.write('movie', detailId, data);
    return result;
  }

  async play() {
    const info = await this.getDomain();
    const domain = info.domain;
    if (!this.validDomain(domain)) return this.ctx.render('404.html');
    const data = await this.ctx.service.movie.playPage(this.ctx.params.id, this.ctx.query.episode, this.ctx.query.source);
    if (!data) return this.ctx.render('404.html');
    const firstPlay = data.playList && data.playList[0];
    data.playerSourceJson = JSON.stringify(firstPlay ? {
      src: firstPlay.url,
      type: /m3u8/i.test(firstPlay.url) ? 'application/x-mpegURL' : 'video/mp4',
    } : null).replace(/<\//g, '<\\/');
    return this.render('play', this.baseResult(domain, { siteInfo: info.site, ...data }));
  }
}

module.exports = MoviePageController;
