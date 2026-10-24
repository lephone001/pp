'use strict';
const assert = require('assert');
const { exclusionReason } = require('../app/lib/wenzhangPolicy');
for (const title of ['新款显卡游戏性能评测', '独立游戏开发入门教程', '软件工具使用指南', 'iPhone 17 Pro 使用体验']) {
  assert.equal(exclusionReason({ title, content: '<p>中文产品介绍与使用方法。</p>' }), '');
}
for (const item of [
  { title: 'Xbox latest news', content: '<p>English article.</p>' },
  { title: '民生新闻：养老金调整' },
  { title: '国际新闻：总统选举结果' },
  { title: '今日新闻', content: '<p>警方通报交通事故伤亡情况。</p>' },
  { title: '新软件介绍', content: '<p>国务院发布住房公积金政策。</p>' },
]) assert(exclusionReason(item));
const sources = require('../app/lib/wenzhangSources');
assert(sources.length > 4);
assert.equal(new Set(sources.map(s => s.url)).size, sources.length);
assert(sources.every(s => /中文/.test(s.name)));
console.log('PASS: Chinese source presets and article filtering');
