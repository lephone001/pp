'use strict';

const assert = require('assert');
const buildDownloadPortal = require('../app/utils/downloadPortal');

const portal = buildDownloadPortal({
  seed: 'tdk.example/index.html',
  domain: {
    title: '后台配置的网站标题',
    description: '后台配置的网站描述',
    keyWords: '关键词一,关键词二',
  },
});

assert.equal(portal.title, '后台配置的网站标题');
assert.equal(portal.description, '后台配置的网站描述');
assert.equal(portal.keywords, '关键词一,关键词二');

const explicit = buildDownloadPortal({
  seed: 'tdk.example/Article/1.html',
  title: '页面动态标题',
  description: '页面动态描述',
  keywords: '页面动态关键词',
  domain: {
    title: '后台配置的网站标题',
    description: '后台配置的网站描述',
    keyWords: '关键词一,关键词二',
  },
});

assert.equal(explicit.title, '页面动态标题');
assert.equal(explicit.description, '页面动态描述');
assert.equal(explicit.keywords, '页面动态关键词');

console.log('download portal TDK: PASS');
