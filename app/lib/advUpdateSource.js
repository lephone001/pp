'use strict';

const axios = require('axios');

function normalizeSource(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('缺少更新源地址 link');
  const url = new URL(value.trim());
  if (!/^https?:$/.test(url.protocol)) throw new Error('更新源必须使用 HTTP 或 HTTPS');
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/?$/, '/');
  return url.href;
}

function currentSource(ctx) {
  const configured = ctx.app.config.uplink && ctx.app.config.uplink.updateSource;
  return normalizeSource(configured || ctx.origin + '/html/');
}

async function download(value) {
  const source = normalizeSource(value);
  const names = ['sbb02.html', 'app.json', 'app.js'];
  const contents = await Promise.all(names.map(async name => {
    try {
      const response = await axios.get(source + name + '?v=' + Date.now(), {
        timeout: 30000,
        headers: {
          'Cache-Control': 'no-cache',
          'User-Agent': 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
        },
      });
      if (response.data === undefined || response.data === null || response.data === '') {
        throw new Error('返回文件内容为空');
      }
      return response.data;
    } catch (error) {
      throw new Error(name + ' 下载失败：' + (error.code || error.message));
    }
  }));
  const list = typeof contents[1] === 'string' ? JSON.parse(contents[1]) : contents[1];
  if (!Array.isArray(list)) throw new Error('app.json 内容不是数组，未覆盖本地文件');
  if (typeof contents[0] !== 'string' || typeof contents[2] !== 'string') {
    throw new Error('HTML 或 JS 文件内容格式错误，未覆盖本地文件');
  }
  // Generated pages embed app.js; reject a mix of versions (including old sources).
  const match = contents[2].match(/var JIAMIAPPJSONLIST\s*=\s*"([^"]*)"/);
  if (!match || !contents[0].includes(contents[2]) ||
      JSON.stringify(JSON.parse(decodeURIComponent(match[1]))) !== JSON.stringify(list.filter(item => item.status == 1))) {
    throw new Error('更新源的 HTML、JS、JSON 版本不一致，请等待保存完成后重试；未覆盖本地文件');
  }
  return { source, html: contents[0], list, js: contents[2] };
}

module.exports = { normalizeSource, currentSource, download };
