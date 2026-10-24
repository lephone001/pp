'use strict';

function stripHtml(value = '') {
  return String(value || '').replace(/<[^>]+>/g, '');
}

function getArticleRating(article = {}, domain = {}) {
  const digit = Math.abs(Number(domain.urlNumber || article.urlNumber || 0)) % 9;
  if (digit > 7) return '5.0';
  return `4.${digit}`;
}

function getArticleRatingCount(article = {}) {
  const now = new Date();
  const yearMonth = Number(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`);
  return yearMonth % 59998;
}

module.exports = {
  getArticleRating,
  getArticleRatingCount,
};
