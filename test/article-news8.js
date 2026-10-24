'use strict';

// News layout keeps its content and image rules; movie navigation reads no words.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const nunjucks = require('nunjucks');
const cheerio = require('cheerio');
const Service = require('../app/service/fanmuluArticle');
const helpers = require('../app/extend/helper');
const root = path.resolve(__dirname, '..');
const templateRoot = path.join(root, 'app/view/template/fanmulu_article8');
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader([
  path.join(root, 'app/view'), path.join(root, 'app/common_data/Article/templates'),
]), { autoescape: false });

function setup(pathname = '/detail/news.html') {
  const ctx = { app: { baseDir: root }, state: {}, host: 'news.example.test', path: pathname, protocol: 'https', logger: { warn() {} } };
  const service = new Service(ctx);
  service.getMovieTitlePool = () => { throw new Error('News templates must not read movie words'); };
  ctx.service = { fanmuluArticle: service };
  return { ctx, service, helper: Object.assign({ ctx }, helpers) };
}

function checkImages(html, maximum, folder = 'mn9') {
  const $ = cheerio.load(html);
  assert.strictEqual($('.topic-image').attr('src'), 'https://static.example.test/images/article/' + folder + '/' + maximum + '.jpg');
  const images = $('main img,.brand-image');
  assert.strictEqual(images.length, 529);
  images.each((index, element) => {
    const image = $(element);
    const url = new URL(image.attr('src'));
    assert.strictEqual(url.origin, 'https://static.example.test');
    const filename = path.posix.basename(url.pathname);
    assert.strictEqual(url.pathname, '/images/article/' + folder + '/' + filename);
    assert(/^\d+\.jpg$/.test(filename));
    const number = Number(filename.slice(0, -4));
    if (image.hasClass('topic-image')) assert.strictEqual(number, Number(maximum));
    else assert(number >= 0 && number < Number(maximum), image.attr('src'));
  });
  assert.strictEqual($('#cinema,.cinema-panel,.article-cover,.footer-brand').length, 0);
  const movieLink = $('.main-nav a.online-movie');
  assert.strictEqual(movieLink.length, 1);
  assert.strictEqual(movieLink.text(), '在线影视');
  assert(/^\/Article\/Movie\/[1-9]\d{11}\.html$/.test(movieLink.attr('href')));
  assert.strictEqual(movieLink.next('.online-news').length, 1);
  assert.strictEqual($('.main-nav .online-news').attr('href'), '/WenZhang/list.html');
  assert.strictEqual($('.main-nav a').length, 7);
  assert.deepStrictEqual($('.main-nav a').slice(0, 5).map((index, el) => $(el).clone().children().remove().end().text()).get(),
    ['安卓软件', '安卓游戏', '苹果应用', '电脑软件', '实用工具']);
  assert.strictEqual($('.editorial-layout > .main-column').length, 1);
  assert.strictEqual($('.editorial-layout > .side-column').length, 1);
  assert.strictEqual($('.directory-grid a').length, 771);
  assert.strictEqual($('.article-grid .article-card').length, 213);
  $('a[href^="#"]').each((index, element) => assert.strictEqual($($(element).attr('href')).length, 1));
  return $;
}

function main() {
  const probe = setup();
  const domain = { tname: 'fanmulu_article8', title: 'News title', description: 'News description', imgTypeName: 'mn9', imageNums: 100,
    sfurl: { staticUrl: 'https://static.example.test/' }, themeColor: '#a52d32' };
  const data = { domain, ctx: probe.ctx, helper: probe.helper, detail: { name: 'News article' } };
  const entries = fs.readdirSync(templateRoot).filter(name => name.endsWith('.html')
    && !['frame.html', 'cards.html', 'content.html', 'images.html'].includes(name));
  for (const entry of entries) {
    const html = env.render('template/fanmulu_article8/' + entry, data);
    const $ = checkImages(html, 100);
    assert.strictEqual($('title').text(), 'News article');
    assert.strictEqual($('.search-form input').attr('placeholder'), '输入关键词，查找本页文章');
  }
  for (const maximum of [1, 2, 10, '1500']) checkImages(env.render('template/fanmulu_article8/index.html', {
    ...data, domain: { ...domain, imageNums: maximum },
  }), maximum);
  const home = setup('/');
  const homeHtml = env.render('template/fanmulu_article8/index.html', { domain, helper: home.helper, ctx: home.ctx });
  const homeDom = checkImages(homeHtml, 100);
  assert.strictEqual(homeDom('.home-banner h1').text(), 'News title');
  const empty = env.render('template/fanmulu_article8/index.html', { ...data, domain: {} });
  assert.strictEqual(cheerio.load(empty)('.topic-image').length, 1);
  const repeat = cheerio.load(env.render('template/fanmulu_article8/index.html', data));
  const first = cheerio.load(env.render('template/fanmulu_article8/index.html', data));
  assert.deepStrictEqual(first('main img,.brand-image').map((index, el) => first(el).attr('src')).get(),
    repeat('main img,.brand-image').map((index, el) => repeat(el).attr('src')).get());

  let errorHandler;
  const document = { querySelector: () => null, querySelectorAll: () => [], addEventListener: (type, callback) => { if (type === 'error') errorHandler = callback; } };
  vm.runInNewContext(fs.readFileSync(path.join(templateRoot, 'static/site.js'), 'utf8'), { document, window: {} });
  const image = { tagName: 'IMG', src: 'https://static.example.test/images/article/mn9/99.jpg', classList: { add() {} } };
  errorHandler({ target: image });
  assert.strictEqual(image.src, 'https://static.example.test/images/article/mn9/99.jpg');
  console.log('PASS: article8 entries, Movie/News navigation, image bounds and no movie-word reads verified.');
}

try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
