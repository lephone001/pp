'use strict';
const assert = require('assert');
const cheerio = require('cheerio');
const { cleanContent } = require('../app/lib/wenzhangFeed');
const html = `<link rel="stylesheet" href="https://outside.test/style.css">
  <style>body{color:red}</style><script src="https://outside.test/a.js"></script>
  <iframe src="https://outside.test/frame"></iframe>
  <p style="background:url(https://outside.test/bg.png)" onclick="alert(1)">正文</p>
  <a href="https://outside.test/missing/page.html?q=1#part">绝对路径</a>
  <a href="//outside.test/post">协议相对路径</a>
  <a href="../next.html">相对路径</a><a href="/WenZhang/local.html">本站</a>
  <a href="#part">锚点</a><a href="javascript:alert(1)">无效链接</a>
  <a href="https://outside.test//evil.test/path">双斜杠路径</a>
  <img src="/images/photo.jpg" onerror="alert(1)">`;
const result = cleanContent(html, 'https://source.test/articles/item.html');
const $ = cheerio.load(result);
assert.equal($('script,style,link,iframe,[style],[onclick],[onerror]').length, 0);
assert.deepEqual($('a').map((i, el) => $(el).attr('href')).get(), [
  '/missing/page.html?q=1#part', '/post', '/next.html', '/WenZhang/local.html', '#part', '/WenZhang/list.html', '/evil.test/path',
]);
assert.equal($('img').attr('src'), 'https://source.test/images/photo.jpg');
assert.equal(cleanContent(result, 'https://source.test/articles/item.html'), result, 'repeated sanitation preserves local links');
console.log('PASS: CSS/JS/iframe removal and local article hyperlinks');
