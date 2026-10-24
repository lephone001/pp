(function () {
  'use strict';
  var buttons = document.querySelectorAll('[data-copy-url]');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function () {
      var button = this;
      var done = function () {
        var old = button.textContent;
        button.textContent = '已复制';
        setTimeout(function () { button.textContent = old; }, 1200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(location.href).then(done).catch(function () {});
      }
    });
  }
}());
