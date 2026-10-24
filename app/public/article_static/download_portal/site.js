'use strict';
(function () {
  var track = document.querySelector('.screenshot-track');
  document.querySelectorAll('[data-gallery]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (track) track.scrollBy({ left: track.clientWidth * (button.dataset.gallery === 'next' ? 0.85 : -0.85), behavior: 'smooth' });
    });
  });
  var form = document.querySelector('.search-form');
  var cards = Array.prototype.slice.call(document.querySelectorAll('[data-search]'));
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var word = document.querySelector('#portal-search').value.trim().toLowerCase();
    var matches = [];
    cards.forEach(function (card) {
      var match = word && card.dataset.search.toLowerCase().indexOf(word) !== -1;
      card.classList.toggle('search-match', Boolean(match));
      if (match) matches.push(card);
    });
    document.querySelector('.search-result').textContent = word ? (matches.length ? '本页找到 ' + matches.length + ' 项匹配应用' : '本页没有匹配应用，请尝试其他关键词') : '';
    if (matches.length) matches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.querySelectorAll('.section-tabs a').forEach(function (link) {
    link.addEventListener('click', function () {
      document.querySelectorAll('.section-tabs a').forEach(function (tab) { tab.classList.remove('active'); });
      link.classList.add('active');
    });
  });
  document.addEventListener('error', function (event) {
    var img = event.target;
    if (img.tagName === 'IMG' && !img.dataset.fallback) {
      img.dataset.fallback = '1';
      img.src = '/article_static/download_portal/fallback.svg';
    }
  }, true);
  document.querySelector('.back-top').addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
})();
