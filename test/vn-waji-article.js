'use strict';

// node test/vn-waji-article.js
const assert = require('assert');
const path = require('path');
const nunjucks = require('nunjucks');
const Article = require('../app/service/article');
const formatDate = require('../app/utils/vietnamArticleDate');
const id = number => number.toString(16).padStart(24, '0');
const records = Array.from({ length: 29 }, (_, i) => ({ _id: id(i + 1), title: 'Bài viết ' + (i + 1) }));
const matches = (row, query) => !query._id ||
  (query._id.$lt ? row._id < query._id.$lt : row._id > query._id.$gt);
function query(criteria, single) {
  let order = -1, limit = records.length;
  return {
    select() { return this; },
    sort(value) { order = value._id; return this; },
    limit(value) { limit = value; return this; },
    async lean() {
      const rows = records.filter(row => matches(row, criteria)).sort((a, b) => order * a._id.localeCompare(b._id)).slice(0, limit);
      return single ? rows[0] || null : rows;
    },
  };
}
const service = Object.create(Article.prototype);
service.ctx = { model: { Article: {
  find: criteria => query(criteria),
  findOne: criteria => query(criteria, true),
  exists: async criteria => records.some(row => matches(row, criteria)),
} } };

async function main() {
  const first = await service.publicCursorList();
  assert.deepStrictEqual(first.rows.map(row => row._id), records.slice(17).reverse().map(row => row._id));
  assert.strictEqual(first.hasPrev, false);
  assert.strictEqual(first.hasNext, true);
  const second = await service.publicCursorList({ cursor: first.rows[11]._id, direction: 'next' });
  const last = await service.publicCursorList({ cursor: second.rows[11]._id, direction: 'next' });
  assert.strictEqual(last.rows.length, 5);
  assert.strictEqual(last.hasNext, false);
  const back = await service.publicCursorList({ cursor: last.rows[0]._id, direction: 'prev' });
  assert.deepStrictEqual(back.rows, second.rows);
  const backFirst = await service.publicCursorList({ cursor: back.rows[0]._id, direction: 'prev' });
  assert.deepStrictEqual(backFirst, first);
  assert.deepStrictEqual([ ...first.rows, ...second.rows, ...last.rows ].map(row => row._id), records.slice().reverse().map(row => row._id));
  assert.deepStrictEqual(await service.publicCursorList({ cursor: 'bad-id' }), first);
  assert.deepStrictEqual((await service.publicCursorList({ cursor: id(1), direction: 'next' })).rows, []);
  assert.strictEqual((await service.publicNeighbors(id(29))).previous, null);
  assert.strictEqual((await service.publicNeighbors(id(1))).next, null);
  const neighbors = await service.publicNeighbors(id(15));
  assert.strictEqual(neighbors.previous._id, id(16));
  assert.strictEqual(neighbors.next._id, id(14));
  assert.strictEqual(formatDate({ createdAt: '2026-10-25T18:30:00Z' }).dateText, '26/10/2026 01:30');
  assert.strictEqual(formatDate({ createdAt: new Date('2026-10-25T18:30:00Z') }).dateISO, '2026-10-26T01:30:00+07:00');
  assert.strictEqual(formatDate({ time: '2026-10-25 10:30:00' }).dateText, '25/10/2026 10:30');
  assert.strictEqual(formatDate({ createdAt: 'invalid', time: '25/10/2026' }).dateText, '25/10/2026 00:00');
  assert.strictEqual(formatDate({ createdAt: 'invalid' }).dateText, '');
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(__dirname, '../app/view')), { autoescape: true });
  const domain = { sfurl: {}, agentLink: {}, tname: 'vn_waji_4', httpFullDomain: 'https://example.com' };
  const detail = formatDate({ ...records[14], description: 'Description', content: '<p>Actual content</p>', createdAt: '2026-10-25T18:30:00Z' });
  const html = env.render('template/vn_waji_4/detail.html', { domain, detail, articleList: first.rows, previousArticle: neighbors.previous, nextArticle: neighbors.next });
  assert(html.includes('<p>Actual content</p>'));
  assert(html.includes('26/10/2026 01:30'));
  assert(html.includes('/detail/' + id(16) + '.html'));
  assert(html.includes('/detail/' + id(14) + '.html'));
  const empty = env.render('template/vn_waji_4/article_list.html', { domain, articleList: [], pagination: {} });
  assert(empty.includes('Bài viết đang được cập nhật'));
  const list = env.render('template/vn_waji_4/article_list.html', { domain, articleList: [ detail ], pagination: { nextUrl: '/article.html?direction=next&cursor=' + id(15) } });
  assert(list.includes('26/10/2026 01:30'));
  assert(list.includes('direction=next&amp;cursor=' + id(15)));
  console.log('PASS: cursor round trips, boundaries, neighbors, Vietnam dates and template rendering');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
