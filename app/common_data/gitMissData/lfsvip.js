'use strict';

// 在 new-seo 目录运行：node app/common_data/gitMissData/lfsvip.js
// 也可在命令末尾传入一个需要检测的 URL。仅检测公开响应，不携带登录凭证。
const axios = require('axios');

const TARGET_URL = 'https://vip.lfsvip.com/';
// 可在这里调整普通请求头。不需要复制浏览器的响应头或 HTTP/2 伪头。
const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Accept-Encoding': 'gzip, deflate',
};

function summarize(response) {
  const headers = response.headers || {};
  const contentType = headers['content-type'] || '';
  const body = Buffer.isBuffer(response.data)
    ? response.data : Buffer.from(response.data || '');
  let login = '无法判断';
  const location = String(headers.location || '');
  const redirectsToLogin = response.status >= 300 && response.status < 400
    && /(?:\/login|\/signin|[?&](?:mod|action)=login)(?:[/?&#=]|$)/i.test(location);

  if (response.status === 401 || redirectsToLogin) {
    login = '需要登录';
  } else if (/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    // 仅检查访问限制标记，不提取、打印或保存正文与联系信息。
    const html = body.toString('utf8');
    if (/cf-chl-|<title>\s*Just a moment|captcha|人机验证|验证码/i.test(html)) {
      login = '无法判断（存在验证提示）';
    } else if (/contact-gate|仅对\s*VIP\s*用户开放|开通任意级别\s*VIP|会员可见/i.test(html)) {
      login = '部分内容需要会员权限（公开页面可访问）';
    } else if (/<input\b[^>]*type\s*=\s*["']password["']/i.test(html)
      || /您需要登录后才可以|请先登录后查看|登录后(?:可|才可)查看|登录后阅读全文/.test(html)) {
      login = '检测到登录限制提示';
    } else if (response.status >= 200 && response.status < 300) {
      login = '未发现登录限制提示（不保证全部内容公开）';
    }
  }

  return {
    'HTTP 状态码': response.status,
    '响应类型': contentType || '未提供',
    '页面大小（解压后字节）': body.length,
    '是否需要登录': login,
  };
}

async function checkPage(url = TARGET_URL) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('INVALID_URL');
  }
  const response = await axios.get(parsed.href, {
    headers: REQUEST_HEADERS,
    timeout: 25000,
    // 保留原始重定向状态，避免把登录页的 200 当成目标页成功。
    maxRedirects: 0,
    maxContentLength: 5 * 1024 * 1024,
    responseType: 'arraybuffer',
    validateStatus: () => true,
  });
  return summarize(response);
}

if (require.main === module) {
  checkPage(process.argv[2] || TARGET_URL)
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(() => {
      // 不打印请求对象、凭证或服务器响应正文。
      console.log(JSON.stringify({
        'HTTP 状态码': null,
        '响应类型': null,
        '页面大小（解压后字节）': null,
        '是否需要登录': '无法判断（请求失败，请检查地址、网络或响应大小限制）',
      }, null, 2));
      process.exitCode = 1;
    });
}

module.exports = { checkPage, summarize };
