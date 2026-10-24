'use strict';

const crypto = require('crypto');
const resourceConfig = require('../confi');
const buildContent = require('./downloadPortalContent');
const media = require('../common_data/Article/download_portal_media.json');
const FALLBACK = '/article_static/download_portal/fallback.svg';
const CATEGORIES = [ '安卓软件', '安卓游戏', '苹果应用', '电脑软件', '实用工具' ];
const WORDS = [ '轻记笔记', '云端相册', '清风天气', '时光日历', '灵感画板', '文件管家', '乐读书房', '专注时钟', '旅行地图', '桌面助手', '音频编辑', '像素工坊' ];

function text(value, limit = 220) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
    .slice(0, limit);
}

function safeUrl(value) {
  const url = String(value || '').trim();
  return /^(https?:\/\/|\/(?!\/))[\S]+$/i.test(url) ? url : '';
}

// All lists are produced in memory only for this theme. No per-card file/DB reads.
module.exports = function buildDownloadPortal(input = {}) {
  const domain = input.domain || {};
  const detail = input.detail || {};
  const seed = String(input.seed || input.hash || domain.fullDomain || input.host || 'download');
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const offset = parseInt(hash.slice(0, 8), 16);
  const suppliedNumber = input.urlNumber !== undefined ? input.urlNumber : domain.urlNumber;
  const urlNumber = Number.isFinite(Number(suppliedNumber)) && suppliedNumber !== null && suppliedNumber !== ''
    ? Math.abs(Math.trunc(Number(suppliedNumber))) : offset;
  const staticUrl = String(domain.sfurl && typeof domain.sfurl.staticUrl === 'string'
    ? domain.sfurl.staticUrl : resourceConfig.staticUrl || '').replace(/\/+$/, '');
  const profileStaticUrl = (typeof input.staticUrl === 'string' ? input.staticUrl : staticUrl).replace(/\/+$/, '');
  const profileImageNumber = urlNumber % 10063;
  const logoImage = profileStaticUrl + '/images/article/mn6/' + profileImageNumber + '.jpg';
  const profileImage = profileStaticUrl + '/images/article/mn6/' + (profileImageNumber - 1) + '.jpg';
  const sourceWords = input.words && input.words.length ? input.words : WORDS;
  const related = Array.isArray(input.related) ? input.related : [];
  const getTitle = i => text(related[i] && related[i].title || sourceWords[(offset + i * 37) % sourceWords.length]) || WORDS[i % WORDS.length];
  const link = i => '/Article/download5/' + hash.slice(0, 12) + '-' + (i + 1) + '.html';
  const downloadSeed = crypto.randomBytes(12).toString('hex');
  const downloadUrls = Array.from({ length: 3 }, (_, i) => '/Article/download5/' + downloadSeed + '-' + (i + 1) + '.html');
  const image = i => (media.length ? media[i % media.length].url : FALLBACK);
  const date = input.date || new Date().toISOString().slice(0, 10);
  const items = Array.from({ length: 452 }, (_, i) => ({
    title: getTitle(i), url: link(i), image: image(i),
    version: 'v' + (1 + (offset + i) % 9) + '.' + i % 10 + '.' + i % 7,
    size: (12 + (offset + i * 13) % 150) + '.0 MB', category: CATEGORIES[i % CATEGORIES.length], date,
  }));
  // Replace one image per three related cards; generate all numbers in one memory-only batch.
  const relatedRandom = crypto.randomBytes(31 * 4);
  for (let i = 0; i < 31; i++) {
    items[150 + i * 3].image = profileStaticUrl + '/images/article/mn6/' + (relatedRandom.readUInt32BE(i * 4) % 10063) + '.jpg';
  }
  const companyRandom = crypto.randomBytes(40 * 4);
  for (let i = 0; i < 40; i++) {
    items[30 + i * 3].image = profileStaticUrl + '/images/article/mn6/' + (companyRandom.readUInt32BE(i * 4) % 10063) + '.jpg';
  }
  const sidebarRandom = crypto.randomBytes(60 * 8);
  const sidebarMore = Array.from({ length: 60 }, (_, i) => {
    const number = 10000000 + sidebarRandom.readUInt32BE(i * 8) % 90000000;
    const paths = [ '/v-nl/list.html?', '/x-app/', '/v-nl/' ];
    return Object.assign({}, items[i], {
      title: getTitle(1800 + i),
      url: paths[i % 3] + number + '.html',
      image: profileStaticUrl + '/images/article/mn6/' + (sidebarRandom.readUInt32BE(i * 8 + 4) % 10063) + '.jpg',
    });
  });
  // 普通站点首页只会向模板传入 domain；与其他模板一致，首页 TDK
  // 应优先使用后台配置的域名标题、描述和关键词，固定文字仅用于无配置场景。
  const title = text(
    input.title || input.articleTitle || detail.name || detail.title || domain.title || domain.titleText,
    300
  ) || '应用下载与使用指南';
  const description = text(input.description || detail.description || domain.description, 260) ||
    '发现实用应用，了解软件功能、平台兼容性与使用方法。';
  const content = String(input.contentHtml || detail.content || detail.description || description)
    .replace(/<\/(?:p|h[1-6]|div|li)>/gi, '\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  const paragraphs = content.split(/\n+/).map(value => text(value, 8192)).filter(Boolean)
    .slice(0, 18);
  const logoUrl = link(1800);
  const artwork = media.filter(item => item.local && /\/pic\//.test(item.source)).slice(1);
  const tutorialMedia = Array.from({ length: 9 }, (_, i) => ({ image: artwork[i] ? artwork[i].url : image(443 + i) }));
  const imgTypeName = /^[a-zA-Z0-9_-]+$/.test(domain.imgTypeName || '') ? domain.imgTypeName : 'mn7';
  const suppliedImageNumber = Number(domain.imageNums);
  const defaultImageNumber = imgTypeName === 'mn7' ? Math.min(69995, Math.max(4, urlNumber % 70000)) : 10;
  const imageNums = domain.imageNums !== undefined && domain.imageNums !== null && domain.imageNums !== '' && Number.isSafeInteger(suppliedImageNumber)
    ? Math.max(4, suppliedImageNumber) : defaultImageNumber;
  const screenshots = Array.from({ length: 9 }, (_, i) => ({
    image: staticUrl + '/images/article/' + imgTypeName + '/' + (imageNums + i - 4) + '.jpg',
    url: link(1700 + i), title: getTitle(443 + i),
  }));
  screenshots.unshift(...[ -2, 1, 2 ].map((delta, i) => ({
    image: profileStaticUrl + '/images/article/mn6/' + (profileImageNumber + delta) + '.jpg',
    url: link(1710 + i), title: getTitle(452 + i),
  })));
  const body = buildContent(input, link, tutorialMedia, title, description);
  const siteName = text(input.siteName || domain.titleText || domain.beiAnName) || '应用下载中心';
  const selectHeaderText = (pool, index, salt) => {
    if (!Array.isArray(pool) || !pool.length) return '';
    const raw = pool[index % pool.length];
    return text(typeof input.renderLibrary === 'function' ? input.renderLibrary(raw, salt) : raw);
  };
  const headerSiteName = selectHeaderText(input.siteNames, urlNumber, 'portal-header-name') || siteName;
  const headerSubtitles = [];
  for (let i = 0; i < Math.min(2, (input.headerWords || []).length); i++) {
    const word = selectHeaderText(input.headerWords, urlNumber + i, 'portal-header-word-' + i);
    if (word) headerSubtitles.push(word);
  }
  return {
    title, description, keywords: text(input.keywords || domain.keyWords || domain.keywords, 260), siteName, headerSiteName, headerSubtitles,
    date, year: String(date).slice(0, 4), version: text(input.version || detail.version) || '版本信息见下载页',
    size: text(input.fileSize || detail.size) || '以安装包为准',
    canonical: safeUrl(input.canonical) || '', logoUrl, logoImage,
    icon: profileImage,
    downloadUrls,
    body,
    screenshots,
    featured: items.slice(0, 30), sidebarMore, company: items.slice(30, 150), related: items.slice(150, 243), ranking: items.slice(243),
    directory: Array.from({ length: 771 }, (_, i) => ({ title: getTitle(i + 452), url: link(i + 452) })),
    backupDomains: input.backupDomains || [],
    friendLinks: (input.friendLinks || []).filter(item => item && /^(?:https?:\/\/|\/)[^\s"'<>]+$/i.test(item.url || '')).map((item, i) => ({
      url: item.url, title: siteName + (i + 1),
    })),
    utility: [ '最近更新', '安卓应用', '安卓游戏', '电脑版', '移动版' ].map((title, i) => ({ title, url: link(1300 + i) })),
    nav: CATEGORIES.map((title, i) => ({ title, url: link(1310 + i) })),
    hot: Array.from({ length: 6 }, (_, i) => ({ title: getTitle(1320 + i), url: link(1320 + i) })),
    tags: [ '应用介绍', '功能特点', '使用教程', '更新说明' ].map((title, i) => ({ title, url: link(1330 + i) })),
    footer: [ '关于我们', '意见反馈', '版权声明', '合作伙伴', '友情链接', '联系我们', '网站导航' ].map((title, i) => ({ title, url: link(1340 + i) })),
    paragraphs: paragraphs.length ? paragraphs : [ description ],
  };
};
