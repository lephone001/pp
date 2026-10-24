document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('menuBtn');
  const nav = document.getElementById('nav');
  let menuAnimationTimer;
  btn && btn.addEventListener('click', function () {
    const isOpen = nav ? nav.classList.toggle('open') : false;
    btn.textContent = isOpen ? '\u00D7' : '\u2630';
    btn.classList.remove('menu-btn-animating');
    void btn.offsetWidth;
    btn.classList.add('menu-btn-animating');
    window.clearTimeout(menuAnimationTimer);
    menuAnimationTimer = window.setTimeout(function () {
      btn.classList.remove('menu-btn-animating');
    }, 760);
  });
});
