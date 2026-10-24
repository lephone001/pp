'use strict';

// Text is escaped by Nunjucks. Library strings are never treated as executable HTML.
function plain(value) {
  return String(value || '').replace(/<[^>]*>/g, '').trim().slice(0, 8192);
}

function imageUrl(value) {
  const url = String(value || '').trim();
  return /^(https?:\/\/|\/(?!\/))[\S]+$/i.test(url) && !/[<>"'\\{}]/.test(url) ? url : '';
}

function articleUrl(value) {
  const candidate = imageUrl(value);
  if (!candidate || /\.php(?:[/?#]|$)/i.test(candidate)) return '';
  try {
    const parsed = new URL(candidate, 'https://portal.invalid');
    // A .html suffix inside a query string is not an HTML route.
    return /^\/Article\/.+\.html$/.test(parsed.pathname) ? candidate : '';
  } catch (_) {
    return '';
  }
}

module.exports = function downloadPortalContent(input, link, screenshots, title, description) {
  const render = typeof input.renderLibrary === 'function' ? input.renderLibrary : () => '';
  const read = (pattern, salt, fallback) => plain(render(pattern, 'portal-body-' + salt)) || fallback || '';
  const keyword = read('{关键词}', 'keyword', title);
  const descriptionText = read('{描述格式}', 'description', description);
  const bodyLink = i => articleUrl(render('{随机链接}', 'portal-body-link-' + i)) || link(1900 + i);
  const rows = (count, group) => Array.from({ length: count }, (_, i) => ({
    tag: read('{随机关键词2}', group + '-tag-' + i, '应用指南'),
    sentence: read('{随机句子}', group + '-sentence-' + i, descriptionText),
    version: read('{随机版本}', group + '-version-' + i, input.version || '版本信息见下载页'),
    url: bodyLink(({ intro: 0, features: 5, characteristics: 14, related: 20 }[group]) + i),
  }));
  const introductions = rows(5, 'intro');
  introductions[4].sentence = descriptionText;
  return {
    keyword, description: descriptionText,
    address: bodyLink(21), more: bodyLink(22), download: bodyLink(23),
    introductions, features: rows(9, 'features'), characteristics: rows(6, 'characteristics'),
    related: rows(1, 'related')[0],
    tutorials: [
      [ '打开应用', '根据设备平台完成安装后打开应用，按提示完成初始设置。' ],
      [ '选择功能', '在主界面选择需要使用的功能，按实际需要配置选项与权限。' ],
      [ '开始使用', '确认设置后开始操作，完成后及时保存结果并备份重要资料。' ],
    ].map((step, i) => ({ title: step[0], text: step[1],
      image: imageUrl(render('{随机自定义2}', 'portal-tutorial-image-' + i)) || screenshots[i + 6].image,
    })),
    updates: Array.from({ length: 6 }, (_, i) => read('{随机自定义}', 'update-' + i,
      [ '完善应用功能与操作提示', '改善界面显示与交互体验', '优化资源加载', '修复已知兼容问题', '完善数据保存与恢复', '更新使用帮助' ][i])),
  };
};
