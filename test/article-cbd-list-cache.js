'use strict';

// node test/article-cbd-list-cache.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const PageController = require('../app/controller/page/articleCbd');

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'article-cbd-pagination-'));
  const homePath = path.join(dir, 'list_home.json');
  const pagePath = path.join(dir, 'next.json');
  const controller = Object.create(PageController.prototype);
  controller.getListCachePath = () => homePath;
  controller.getListPageCachePath = () => pagePath;

  try {
    const refreshedAt = Date.now() - 5000;
    fs.writeFileSync(homePath, JSON.stringify({ cacheTime: refreshedAt }));
    fs.writeFileSync(pagePath, JSON.stringify({ list: [], cacheTime: refreshedAt - 3600000 }));
    assert.strictEqual(await controller.readListPageCache({ lastId: 'old-cursor' }), null);

    const currentPage = { list: [{ _id: 'article-13', image: '/example.jpg' }], cacheTime: Date.now() };
    fs.writeFileSync(pagePath, JSON.stringify(currentPage));
    assert.deepStrictEqual(await controller.readListPageCache({ lastId: 'current-cursor' }), currentPage);

    fs.writeFileSync(pagePath, JSON.stringify({ list: [], cacheTime: Date.now() - 61000 }));
    assert.strictEqual(await controller.readListPageCache({ lastId: 'empty-cursor' }), null);
  } finally {
    fs.unlinkSync(homePath);
    fs.unlinkSync(pagePath);
    fs.rmdirSync(dir);
  }
  console.log('PASS: refreshed article lists invalidate stale and empty pagination caches');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
