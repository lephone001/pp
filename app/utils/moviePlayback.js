'use strict';

function normalizeVideoUrl(value) {
  if (typeof value !== 'string') return '';
  const link = value.trim();
  if (!link || link.length > 4096 || /[\s\\<>"']/.test(link)) return '';
  try {
    const target = new URL(link);
    return /^https?:$/.test(target.protocol) && target.hostname && !target.username && !target.password ? link : '';
  } catch (error) {
    return '';
  }
}

module.exports = { normalizeVideoUrl };
