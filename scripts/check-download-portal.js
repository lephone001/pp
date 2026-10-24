'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const nunjucks = require('nunjucks');
const cheerio = require('cheerio');
const Service = require('../app/service/fanmuluArticle');
const build = require('../app/utils/downloadPortal');
const root = path.resolve(__dirname, '..');
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader([
  path.join(root, 'app/view'), path.join(root, 'app/common_data/Article/templates'),
]), { autoescape: true });
const manifest = require('../app/common_data/Article/templates/manifest.json');

function fixture(host, pathname) {
  const ctx = { host, path: pathname, url: pathname, originalUrl: pathname, protocol: 'https',
    get: () => '', logger: { warn() {} }, app: { baseDir: root, config: {}, fanmuluArticleRuntimeReady: true } };
  const service = new Service(ctx);
  service.getSettings = async () => ({ enabled: true, enabledTemplates: [], friendLinksEnabled: false });
  service.getTemplateManifest = async () => manifest;
  service.getPool = async category => category === 'keyword' ? [ '灵感笔记', '清风天气', '时光日历' ] : [];
  service.categoryFiles = async () => [];
  service.getArticleSource = async () => ({ title: '灵感笔记', content: '<p>整理工作与生活中的每个灵感。</p>' });
  service.getPageState = (identity, templates) => service.createPageState(identity, templates);
  return { ctx, service };
}

function checkHtml(html) {
  const $ = cheerio.load(html);
  const downloadUrls = $('.download-buttons a').map((i, el) => $(el).attr('href')).get();
  assert.strictEqual(downloadUrls.length, 3);
  assert.strictEqual(new Set(downloadUrls).size, 3);
  downloadUrls.forEach(url => assert(/^\/Article\/download5\/[a-f0-9]{24}-[123]\.html$/.test(url)));
  assert.strictEqual($('.portal-body a[href]').length, 23);
  assert.strictEqual($('.intro-item').length, 5);
  assert.strictEqual($('.feature-item').length, 9);
  assert.strictEqual($('.characteristic-item').length, 6);
  assert.strictEqual($('.update-item').length, 6);
  assert.strictEqual($('.tutorial-figure img').length, 3);
  const friends = $('.portal-friend-links a');
  const backup = $('.portal-backup-domains');
  assert.strictEqual($('a[href]').length, 1867 + friends.length + backup.find('a').length);
  assert.strictEqual($('.left-column > .sidebar-more-panel').length, 1);
  assert.strictEqual($('.sidebar-more-panel').prev().find('.featured-list .app-card').length, 30);
  assert.strictEqual($('.sidebar-more-list .app-card').length, 60);
  $('.sidebar-more-list .app-card').each((i, el) => {
    const expected = [ /^\/v-nl\/list\.html\?\d+\.html$/, /^\/x-app\/\d+\.html$/, /^\/v-nl\/\d+\.html$/ ];
    assert(expected[i % 3].test($(el).find('.card-title').attr('href')));
    assert.strictEqual($(el).find('.card-title').attr('href'), $(el).find('.card-image').attr('href'));
    const match = /\/images\/article\/mn6\/(\d+)\.jpg$/.exec($(el).find('img').attr('src'));
    assert(match && Number(match[1]) < 10063);
  });
  if (backup.length) {
    assert(backup.prev().hasClass('portal-layout'));
    assert.strictEqual(backup.closest('.main-column').length, 0);
  }
  assert.strictEqual($('.main-column > .portal-friend-links a').length, friends.length);
  assert.strictEqual($('.directory-panel').length, 1);
  assert.strictEqual($('.main-column > .directory-panel a').length, 771);
  if (friends.length) assert.strictEqual($('.portal-friend-links').prev().hasClass('directory-panel'), true);
  assert.strictEqual($('img').length, 529);
  assert.strictEqual($('.screenshot-track img').length, 12);
  $('.screenshot-track img').each((i, el) => assert(/\/images\/article\/[a-zA-Z0-9_-]+\/-?\d+\.jpg$/.test($(el).attr('src'))));
  [ -2, 1, 2 ].forEach((delta, i) => assert.strictEqual($('.screenshot-track img').eq(i).attr('src'), $('.brand-image').attr('src').replace(/(\d+)\.jpg$/, (_, num) => (Number(num) + delta) + '.jpg')));
  assert.strictEqual($('.brand img.brand-image').length, 1);
  assert(/\/images\/article\/mn6\/\d+\.jpg$/.test($('.brand-image').attr('src')));
  assert.strictEqual($('h1').length, 1);
  assert.strictEqual($('a[href=""]').length, 0);
  assert.strictEqual($('base').length, 0);
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    assert(!/\.php|javascript:|undefined/.test(href));
    if ($(el).closest('.sidebar-more-list').length) return;
    if ($(el).closest('.portal-friend-links, .portal-backup-domains').length) {
      assert(/^(?:https?:\/\/|\/)[^\s"'<>]+$/.test(href));
      return;
    }
    if (href.charAt(0) === '#') assert($(href).length);
    else assert(/^\/Article\/download5\/.+\.html$/.test(href));
  });
  const logoSrc = $('.brand-image').attr('src');
  assert.strictEqual($('.product-icon').attr('src'), logoSrc.replace(/(\d+)\.jpg$/, (_, num) => (Number(num) - 1) + '.jpg'));
  const relatedImages = $('.related-grid img');
  assert.strictEqual(relatedImages.length, 93);
  relatedImages.each((i, el) => {
    if (i % 3 !== 0) return;
    const match = /\/images\/article\/mn6\/(\d+)\.jpg$/.exec($(el).attr('src'));
    assert(match && Number(match[1]) < 10063);
  });
  const companyImages = $('.company-grid img');
  assert.strictEqual(companyImages.length, 120);
  companyImages.each((i, el) => {
    if (i % 3 !== 0) return;
    const match = /\/images\/article\/mn6\/(\d+)\.jpg$/.exec($(el).attr('src'));
    assert(match && Number(match[1]) < 10063);
  });
  const isRandomCardImage = el => [ relatedImages, companyImages ].some(images => images.index(el) >= 0 && images.index(el) % 3 === 0);
  $('img:not(.brand-image):not(.product-icon)').filter((i, el) => !$(el).closest('.screenshot-track, .sidebar-more-list').length && !isRandomCardImage(el)).each((i, el) => assert(fs.existsSync(path.join(root, 'app/public', $(el).attr('src')))));
}

function checkSeo(name, data) {
  const reference = cheerio.load(env.render('appx_download.html', data));
  const actual = cheerio.load(env.render(name, data));
  assert.strictEqual(actual('head title').text(), reference('head title').text(), name + ': composed title');
  [ 'keywords', 'description' ].forEach(field => {
    assert.strictEqual(actual('meta[name="' + field + '"]').attr('content'), reference('meta[name="' + field + '"]').attr('content'), name + ': ' + field);
  });
  assert.strictEqual(actual('h1').text(), reference('h1').text(), name + ': primary heading');
}

async function main() {
  const homeWords = [ '首页标题词甲', '首页标题词乙', '首页标题词丙' ];
  for (const host of [ 'a.com', 'www.a.com', 'c.a.com' ]) {
    const homeFixture = fixture(host, '/');
    const originalGetPool = homeFixture.service.getPool.bind(homeFixture.service);
    const baseline = await homeFixture.service.buildPage(homeFixture.ctx, { globalRoute: true });
    homeFixture.service.getPool = async category => category === 'keyword_home' ? homeWords : originalGetPool(category);
    const home = await homeFixture.service.buildPage(homeFixture.ctx, { globalRoute: true });
    assert(home.data.browserTitle && !/[A-Za-z]/.test(home.data.browserTitle));
    assert(home.data.browserTitle && !/\d/.test(home.data.browserTitle));
    assert(home.data.browserTitle.length > 0);
    [ 'articleTitle', 'contentHtml', 'siteName' ].forEach(field => assert.strictEqual(home.data[field], baseline.data[field]));
    assert.strictEqual(home.data.title, home.data.browserTitle);
    assert(home.data.keywords && home.data.description);
    const homeTemplates = [ 'home/home_portal.html', 'home/home_magazine.html', 'home/home_directory.html', 'home/home_download_portal.html' ];
    for (const name of homeTemplates) {
      const data = Object.assign({}, home.data, { downloadPortal: build(home.data) });
      const before = cheerio.load(env.render(name, Object.assign({}, data, { browserTitle: data.title })));
      const after = cheerio.load(env.render(name, data));
      assert.strictEqual(after('title').text(), home.data.browserTitle);
      assert.strictEqual(after('h1').first().text(), home.data.title);
      assert.strictEqual(after('body').html(), before('body').html());
      assert.strictEqual(after('meta[name="keywords"]').attr('content'), before('meta[name="keywords"]').attr('content'));
      assert.strictEqual(after('meta[name="description"]').attr('content'), before('meta[name="description"]').attr('content'));
    }
    homeFixture.ctx.path = '/index.html';
    homeFixture.ctx.url = homeFixture.ctx.originalUrl = '/index.html?source=test';
    assert.strictEqual((await homeFixture.service.buildPage(homeFixture.ctx, { globalRoute: true })).data.browserTitle, home.data.browserTitle);
    homeFixture.service.getPool = async category => category === 'keyword_home' ? [ '测试APP2026版' ] : originalGetPool(category);
    const tokenHome = await homeFixture.service.buildPage(homeFixture.ctx, { globalRoute: true });
    assert(/^测试[a-z]{1,7}\d{1,7}版$/.test(tokenHome.data.browserTitle));
    const tokenAgain = await homeFixture.service.buildPage(homeFixture.ctx, { globalRoute: true });
    assert.strictEqual(tokenHome.data.browserTitle, tokenAgain.data.browserTitle);
    homeFixture.ctx.path = homeFixture.ctx.url = homeFixture.ctx.originalUrl = '/other.html';
    const tokenDetail = await homeFixture.service.buildPage(homeFixture.ctx, { globalRoute: true });
    assert.strictEqual(tokenDetail.data.browserTitle, undefined);
    homeFixture.ctx.path = homeFixture.ctx.url = homeFixture.ctx.originalUrl = '/';
    homeFixture.ctx.path = homeFixture.ctx.url = homeFixture.ctx.originalUrl = '/Article/test.html';
    const detail = await homeFixture.service.buildPage(homeFixture.ctx, { globalRoute: true });
    assert.strictEqual(detail.data.browserTitle, undefined);
    homeFixture.ctx.path = homeFixture.ctx.url = homeFixture.ctx.originalUrl = '/';
    assert.strictEqual((await homeFixture.service.buildPage(homeFixture.ctx, { globalRoute: false })).data.browserTitle, undefined);
    homeFixture.service.getPool = originalGetPool;
    const emptyHome = await homeFixture.service.buildPage(homeFixture.ctx, { globalRoute: true });
    assert.strictEqual(emptyHome.data.browserTitle, emptyHome.data.title);
  }
  const relatedInput = { seed: 'related-images', staticUrl: 'https://related.example/' };
  const firstRelated = build(relatedInput);
  const nextRelated = build(relatedInput);
  assert.strictEqual(firstRelated.sidebarMore.length, 60);
  assert.notDeepStrictEqual(firstRelated.sidebarMore.map(item => item.url), nextRelated.sidebarMore.map(item => item.url));
  assert.notDeepStrictEqual(firstRelated.sidebarMore.map(item => item.image), nextRelated.sidebarMore.map(item => item.image));
  firstRelated.sidebarMore.forEach(item => assert(/^https:\/\/related\.example\/images\/article\/mn6\/\d+\.jpg$/.test(item.image)));
  assert.notDeepStrictEqual(firstRelated.related.map(item => item.image), nextRelated.related.map(item => item.image));
  const sourceMedia = require('../app/common_data/Article/download_portal_media.json');
  firstRelated.related.forEach((item, i) => {
    if (i % 3 === 0) assert(/^https:\/\/related\.example\/images\/article\/mn6\/\d+\.jpg$/.test(item.image));
    else assert.strictEqual(item.image, sourceMedia[(150 + i) % sourceMedia.length].url);
    assert.strictEqual(item.url, nextRelated.related[i].url);
    assert.strictEqual(item.title, nextRelated.related[i].title);
  });
  assert.notDeepStrictEqual(firstRelated.company.map(item => item.image), nextRelated.company.map(item => item.image));
  assert.strictEqual(firstRelated.company.length, 120);
  firstRelated.company.forEach((item, i) => {
    if (i % 3 === 0) assert(/^https:\/\/related\.example\/images\/article\/mn6\/\d+\.jpg$/.test(item.image));
    else assert.strictEqual(item.image, sourceMedia[(30 + i) % sourceMedia.length].url);
    assert.deepStrictEqual(Object.assign({}, item, { image: '' }), Object.assign({}, nextRelated.company[i], { image: '' }));
  });
  [ 'featured', 'ranking' ].forEach(key => assert.deepStrictEqual(firstRelated[key], nextRelated[key]));
  const downloadInput = { seed: 'same-page', detail: { url: 'https://old.example/app.apk' } };
  const firstDownloads = build(downloadInput).downloadUrls;
  const nextDownloads = build(downloadInput).downloadUrls;
  assert(firstDownloads.every(url => !nextDownloads.includes(url)));
  const galleryInput = { urlNumber: 10300, domain: { sfurl: { staticUrl: 'https://images.example/' }, imgTypeName: 'mn6', imageNums: 100 } };
  const galleryPortal = build(galleryInput);
  assert.strictEqual(galleryPortal.icon, 'https://images.example/images/article/mn6/236.jpg');
  assert.strictEqual(build(Object.assign({}, galleryInput, { detail: { image: 'https://old.example/icon.jpg' } })).icon, galleryPortal.icon);
  assert.deepStrictEqual(galleryPortal.screenshots.slice(0, 3).map(item => item.image), [ 235, 238, 239 ].map(num => 'https://images.example/images/article/mn6/' + num + '.jpg'));
  assert.deepStrictEqual(galleryPortal.screenshots.slice(3).map(item => item.image), Array.from({ length: 9 }, (_, i) => 'https://images.example/images/article/mn6/' + (96 + i) + '.jpg'));
  assert.strictEqual(build({ domain: { sfurl: { staticUrl: '' }, imgTypeName: 'mn7', imageNums: 4 } }).screenshots[3].image, '/images/article/mn7/0.jpg');
  assert(build({ domain: { imageNums: 0 } }).screenshots.slice(3).every(item => !/\/-\d/.test(item.image)));
  assert.strictEqual(build({ urlNumber: 69999 }).screenshots[11].image.split('/').pop(), '69999.jpg');
  assert.deepStrictEqual(build({ staticUrl: 'https://prefix.example/', urlNumber: 10063 }).screenshots.slice(0, 3).map(item => item.image), [ -2, 1, 2 ].map(num => 'https://prefix.example/images/article/mn6/' + num + '.jpg'));
  assert.deepStrictEqual(galleryPortal.body.tutorials, build({}).body.tutorials);
  const headerInput = { urlNumber: 7, siteName: '原站名', title: '网页组合标题', description: '网页描述', keywords: '网页关键词', siteNames: [ '站甲', '站乙', '站丙' ], headerWords: [ '实时对战', '厂商直供', '独家首发' ] };
  const headerPortal = build(headerInput);
  assert.strictEqual(headerPortal.headerSiteName, '站乙');
  assert.deepStrictEqual(headerPortal.headerSubtitles, [ '厂商直供', '独家首发' ]);
  assert.strictEqual(headerPortal.siteName, '原站名');
  assert.strictEqual(headerPortal.title, headerInput.title);
  assert.strictEqual(headerPortal.description, headerInput.description);
  assert.strictEqual(headerPortal.keywords, headerInput.keywords);
  assert.deepStrictEqual(build(headerInput).headerSubtitles, headerPortal.headerSubtitles);
  assert.strictEqual(build(Object.assign({}, headerInput, { urlNumber: 8 })).headerSiteName, '站丙');
  assert.deepStrictEqual(build({ headerWords: [ '唯一词条' ] }).headerSubtitles, [ '唯一词条' ]);
  const headerHtml = cheerio.load(env.render('download_portal.html', { downloadPortal: headerPortal }));
  assert.strictEqual(headerHtml('.site-header .brand-name').text(), '站乙');
  assert.strictEqual(headerHtml('.site-header .brand-subtitle').text(), '厂商直供 · 独家首发');
  assert.strictEqual(build({ domain: { sfurl: { staticUrl: 'https://cdn.example/' } }, urlNumber: 10068 }).logoImage, 'https://cdn.example/images/article/mn6/5.jpg');
  assert.strictEqual(build({ domain: { sfurl: { staticUrl: '' } }, urlNumber: 0 }).logoImage, '/images/article/mn6/0.jpg');
  assert.strictEqual(build({ staticUrl: 'https://static.example/', domain: { sfurl: { staticUrl: 'https://domain.example' } }, urlNumber: 5 }).logoImage, 'https://static.example/images/article/mn6/5.jpg');
  assert.strictEqual(build({ domain: { sfurl: { staticUrl: 'https://assets.example' }, urlNumber: 10064 } }).logoImage, 'https://assets.example/images/article/mn6/1.jpg');
  assert.strictEqual(build({ urlNumber: 10063 }).logoImage, require('../app/confi').staticUrl.replace(/\/+$/, '') + '/images/article/mn6/0.jpg');
  assert.strictEqual(build({ staticUrl: '', urlNumber: 10063 }).icon, '/images/article/mn6/-1.jpg');
  const memoryFixture = fixture('library.example', '/Article/download5/library.html');
  const library = {
    keyword: [ '词库应用' ], keyword2: [ '功能标签' ], description: [ '描述正文' ],
    miaoshu: [ '{关键词}：{描述}；{随机句子}' ],
    juzi: [ '句子内容'.repeat(100) ], banben: [ 'v{随机数字2}.{随机数字2}' ],
    zidingyi: [ '更新了{关键词}的功能' ], zidingyi2: [ '不是图片地址' ],
    url: [ '/Article/?{随机数字6}.html' ],
  };
  memoryFixture.ctx.app.fanmuluArticlePools = Object.fromEntries(Object.entries(library).map(([ k, value ]) => [ k, { value } ]));
  // Any attempt to reload files on the synchronous helper path fails this test.
  memoryFixture.service.getPool = () => { throw new Error('Unexpected library I/O'); };
  const options = { hash: 'library-seed', date: '2026-09-08', articleTitle: '文章标题', contentHtml: '<p>' + '原文'.repeat(300) + '</p>' };
  const composed = memoryFixture.service.downloadPortal(options);
  assert.strictEqual(composed.body.keyword, '词库应用');
  assert(composed.body.description.includes('词库应用：描述正文；句子内容'));
  assert.strictEqual(composed.body.introductions[0].sentence.length, 400);
  assert.strictEqual(composed.paragraphs[0].length, 600);
  assert(/^v\d{2}\.\d{2}$/.test(composed.body.features[0].version));
  assert(composed.body.updates.every(value => value === '更新了词库应用的功能'));
  assert.deepStrictEqual(memoryFixture.service.downloadPortal(options).body, composed.body);
  checkHtml(env.render('download_portal.html', { downloadPortal: composed }));
  assert(!/\{(?:关键词|随机|描述|版本)/.test(JSON.stringify(composed.body)));
  memoryFixture.ctx.app.fanmuluArticlePools.url.value = [ '/Article/fixture-{随机数字6}.html' ];
  memoryFixture.ctx.app.fanmuluArticlePools.zidingyi2.value = [ 'https://example.test/tutorial.png' ];
  const configured = memoryFixture.service.downloadPortal(options);
  assert(/^\/Article\/fixture-\d{6}\.html$/.test(configured.body.more));
  assert(configured.body.tutorials.every(step => step.image === 'https://example.test/tutorial.png'));
  memoryFixture.ctx.app.fanmuluArticlePools.url.value = [ 'javascript:alert(1)' ];
  memoryFixture.ctx.app.fanmuluArticlePools.zidingyi2.value = [ 'javascript:alert(1)' ];
  memoryFixture.ctx.app.fanmuluArticlePools.zidingyi.value = [ '<img src=x onerror=alert(1)><script>alert(1)</script>' ];
  const escaped = env.render('download_portal.html', { downloadPortal: memoryFixture.service.downloadPortal(options) });
  assert.strictEqual(cheerio.load(escaped)('.portal-body script, .portal-body [onerror]').length, 0);
  checkHtml(escaped);
  memoryFixture.ctx.app.fanmuluArticlePools.links = { value: [ '//friend.example/Article/{随机数字9}.html' ] };
  const withFriends = memoryFixture.service.downloadPortal(Object.assign({}, options, { siteName: '测试站' }));
  assert.strictEqual(withFriends.friendLinks.length, 10);
  assert.strictEqual(withFriends.friendLinks[0].title, '测试站1');
  assert(withFriends.friendLinks.every(item => /^\/\/friend\.example\/Article\/\d{9}\.html$/.test(item.url)));
  assert.notDeepStrictEqual(memoryFixture.service.downloadPortal(options).friendLinks.map(item => item.url), withFriends.friendLinks.map(item => item.url));
  checkHtml(env.render('download_portal.html', { downloadPortal: withFriends }));
  memoryFixture.ctx.app.fanmuluArticleSettings = { value: { friendLinksEnabled: false } };
  assert.strictEqual(memoryFixture.service.downloadPortal(options).friendLinks.length, 0);
  memoryFixture.ctx.app.fanmuluArticlePools.fan = { value: [ 'h5-{随机数字5}', 'app{随机字符3}', 'av{随机数字5}' ] };
  const backupOptions = Object.assign({}, options, { host: 'www.download.example.com.cn', siteName: '测试站' });
  const withBackup = memoryFixture.service.downloadPortal(backupOptions);
  assert.strictEqual(withBackup.backupDomains.length, 9);
  withBackup.backupDomains.forEach(item => {
    assert(!item.pending);
    const address = new URL(item.url);
    assert(address.hostname.endsWith('.example.com.cn'));
    assert(!address.hostname.includes('.download.'));
    assert.strictEqual(address.pathname, '/');
    assert.strictEqual(item.title + '.example.com.cn', address.hostname);
  });
  assert(withBackup.backupDomains.slice(0,3).every(item => /^https:\/\/h5-\d{5}\./.test(item.url)));
  const simpleDomain = memoryFixture.service.downloadPortal(Object.assign({}, options, { host: 'www.a.com' }));
  [ /^h5-\d{5}$/, /^app[a-z0-9]{3}$/, /^av\d{5}$/ ].forEach((rule, index) => {
    const group = simpleDomain.backupDomains.slice(index * 3, index * 3 + 3);
    assert.strictEqual(group.length, 3);
    group.forEach(item => {
      assert(rule.test(item.title));
      assert.strictEqual(item.url, 'https://' + item.title + '.a.com/');
      assert(!/[{}]/.test(item.title));
    });
  });
  assert.notDeepStrictEqual(memoryFixture.service.downloadPortal(backupOptions).backupDomains, withBackup.backupDomains);
  checkHtml(env.render('download_portal.html', { downloadPortal: withBackup }));
  const localBackup = memoryFixture.service.downloadPortal(Object.assign({}, options, { host: '127.0.0.1:17865' }));
  assert.strictEqual(localBackup.backupDomains.length, 9);
  assert(localBackup.backupDomains.every(item => !item.pending && item.url === 'https://' + item.title + '.127.0.0.1:17865/'));
  const localBackupHtml = env.render('download_portal.html', { downloadPortal: localBackup });
  checkHtml(localBackupHtml);
  assert.strictEqual(cheerio.load(localBackupHtml)('.portal-backup-domains a').length, 9);
  assert(!localBackupHtml.includes('待绑定主域名'));
  memoryFixture.ctx.app.fanmuluArticlePools.fan.value = [ 'https://backup.example/Article/{随机数字5}.html', 'javascript:alert(1)', 'https://user:password@example.com/' ];
  const fullBackup = memoryFixture.service.downloadPortal(options);
  assert.strictEqual(fullBackup.backupDomains.length, 3);
  assert(fullBackup.backupDomains.every(item => /^https:\/\/backup\.example\/Article\/\d{5}\.html$/.test(item.url)));
  memoryFixture.ctx.app.fanmuluArticlePools.fan.value = [];
  delete memoryFixture.ctx.app.fanmuluArticleSettings;
  memoryFixture.ctx.app.fanmuluArticlePools.links.value = [ 'javascript:alert(1)' ];
  assert.strictEqual(memoryFixture.service.downloadPortal(options).friendLinks.length, 0);
  const names = [ 'download_portal.html', 'home/home_download_portal.html' ].concat(
    fs.readdirSync(path.join(root, 'app/view/template/fanmulu_article5')).filter(n => n.endsWith('.html')).map(n => 'template/fanmulu_article5/' + n)
  );
  const portal = build({ siteName: '青禾下载站', articleTitle: '灵感笔记', description: '从容记录，轻松整理。' });
  const started = process.hrtime();
  names.forEach(name => checkHtml(env.render(name, { downloadPortal: portal })));
  const seoData = {
    title: '组合标题 &amp; "测试" ' + '长'.repeat(260),
    keywords: '主关键词,扩展关键词,格式词', description: '组合描述 &amp; "测试" ' + '述'.repeat(240),
    downloadPortal: portal, related: [ { url: '/Article/example.html' } ],
  };
  names.forEach(name => checkSeo(name, seoData));
  checkSeo('download_portal.html', Object.assign({}, seoData, { keywords: '', description: '' }));
  const business = env.render('template/fanmulu_article5/app_download.html', {
    domain: { titleText: '应用之家' }, detail: { name: '测试应用', url: 'https://example.test/app.apk' },
    ctx: { path: '/x-app/123.html' }, helper: { downloadPortal: build },
  });
  assert.strictEqual(cheerio.load(business)('a[href="https://example.test/app.apk"]').length, 0);
  checkHtml(business);
  let paired = 0, unchanged = 0;
  for (let i = 0; i < 12; i++) {
    const { ctx, service } = fixture('preview' + i + '.example', '/');
    const home = await service.buildPage(ctx, { globalRoute: true });
    ctx.path = ctx.url = ctx.originalUrl = '/index.html';
    assert.strictEqual((await service.buildPage(ctx, { globalRoute: true })).template, home.template);
    ctx.path = ctx.url = ctx.originalUrl = '/Article/download5/123.html';
    const detail = await service.buildPage(ctx, { globalRoute: true });
    if (home.template === 'home/home_download_portal.html') {
      paired++;
      assert.strictEqual(detail.template, 'download_portal.html');
      checkHtml(env.render(detail.template, detail.data));
      checkSeo(detail.template, detail.data);
      checkSeo(home.template, home.data);
    } else {
      unchanged++;
      assert.strictEqual(home.template, service.homeTemplate(ctx.host).file);
      assert(!detail.data.downloadPortal);
    }
  }
  assert(paired && unchanged);
  const { ctx, service } = fixture('default.example', '/Article/download5/123.html');
  const defaultPage = await service.buildPage(ctx);
  assert.strictEqual(defaultPage.template, 'template/fanmulu_article5/index.html');
  checkHtml(env.render(defaultPage.template, defaultPage.data));
  checkSeo(defaultPage.template, defaultPage.data);
  service.getSettings = async () => ({ enabled: true, enabledTemplates: [ 'download_portal' ] });
  ctx.path = ctx.url = ctx.originalUrl = '/';
  assert.strictEqual((await service.buildPage(ctx, { globalRoute: true })).template, 'home/home_download_portal.html');
  const sibling = fs.readdirSync(path.join(root, 'app/view/template/fanmulu_article2')).sort();
  assert.deepStrictEqual(fs.readdirSync(path.join(root, 'app/view/template/fanmulu_article5')).sort(), sibling);
  const elapsed = process.hrtime(started);
  console.log('PASS: 10 templates; 60 sidebar cards; three route formats; 529 images; original gallery and recommendations retained; SEO parity; home pairing; business routes. ' + (elapsed[0] * 1000 + elapsed[1] / 1e6).toFixed(0) + 'ms');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
