'use strict';
// Optional read-only network check. Does not import data into MongoDB.
const { fetchFeed, parseFeed } = require('../app/lib/wenzhangFeed');
async function main() {
  for (const { url } of require('../app/lib/wenzhangSources')) {
    try {
    const response = await fetchFeed(url);
    const rows = parseFeed(response.text, response.url, 20);
    if (!rows.length) throw new Error('No articles: ' + url);
    console.log(url + ': ' + rows.length + ' articles parsed');
    } catch (error) { console.error(url + ': ' + error.message); process.exitCode = 1; }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
