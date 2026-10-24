(function () {
  'use strict';
  var video = document.getElementById('MoviexVideo');
  if (!video) return;
  var url = video.getAttribute('data-video-url') || '';
  var toggle = document.getElementById('moviex-play-toggle');
  var status = document.getElementById('moviex-play-status');
  var hls = null;
  var player = null;
  var mediaRecovered = false;
  var wantsPlay = false;
  var failed = false;
  var isHls = /\.m3u8(?:[?#]|$)/i.test(url);
  var nativeHls = video.canPlayType('application/vnd.apple.mpegurl') || video.canPlayType('application/x-mpegURL');

  function message(text) { if (status) status.textContent = text; }
  function updateToggle() {
    if (!toggle) return;
    toggle.textContent = video.paused ? '开始播放' : '暂停播放';
    toggle.setAttribute('aria-pressed', video.paused ? 'false' : 'true');
  }
  function fail() {
    failed = true;
    if (hls) hls.stopLoad();
    video.pause();
    message('视频暂时无法播放，请稍后重试');
    updateToggle();
  }
  function play() {
    if (failed) return;
    wantsPlay = true;
    if (hls) hls.startLoad();
    var result = player ? player.play() : video.play();
    if (result && typeof result.catch === 'function') result.catch(function (error) {
      if (error && error.name === 'NotSupportedError') fail();
      else if (!error || error.name !== 'AbortError') message('请点击播放按钮开始观看');
      updateToggle();
    });
  }
  function attachHls(source) {
    if (hls) hls.destroy();
    var instance = new window.Hls({ autoStartLoad: false, maxBufferLength: 30 });
    hls = instance;
    instance.on(window.Hls.Events.MANIFEST_PARSED, function () {
      if (hls !== instance) return;
      failed = false;
      message('点击播放按钮开始观看');
      if (wantsPlay) play();
    });
    instance.on(window.Hls.Events.ERROR, function (event, data) {
      if (hls !== instance || !data || !data.fatal) return;
      if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR && !mediaRecovered) {
        mediaRecovered = true;
        instance.recoverMediaError();
      } else {
        fail();
      }
    });
    instance.loadSource(source);
    instance.attachMedia(video);
  }

  video.autoplay = false;
  video.removeAttribute('autoplay');
  if (typeof window.Plyr === 'function') {
    try {
      player = new window.Plyr(video, {
        autoplay: false, clickToPlay: true, ratio: '16:9', seekTime: 10,
        iconUrl: '/article_static/moviex-player-icons.svg',
        fullscreen: { enabled: true, fallback: true, iosNative: true },
        controls: [ 'play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'fullscreen' ],
        i18n: { play: '播放', pause: '暂停', seek: '播放进度', currentTime: '当前时间', duration: '总时长',
          mute: '静音', unmute: '取消静音', volume: '音量', enterFullscreen: '全屏', exitFullscreen: '退出全屏' },
      });
    } catch (error) {
      video.controls = true;
    }
  }
  video.addEventListener('play', function () {
    wantsPlay = true;
    if (hls) hls.startLoad();
    updateToggle();
  });
  video.addEventListener('playing', function () { failed = false; message('正在播放'); updateToggle(); });
  video.addEventListener('pause', function () { wantsPlay = false; updateToggle(); });
  video.addEventListener('ended', function () { wantsPlay = false; message('播放结束'); updateToggle(); });
  video.addEventListener('waiting', function () { message('视频缓冲中…'); });
  video.addEventListener('canplay', function () { message(video.paused ? '点击播放按钮开始观看' : '正在播放'); });
  video.addEventListener('error', function () {
    if (hls) return;
    fail();
  });
  if (toggle) toggle.addEventListener('click', function () {
    if (failed) {
      message('视频暂时无法播放，请稍后重试');
      return;
    }
    if (video.paused) play();
    else if (player) player.pause();
    else video.pause();
    updateToggle();
  });
  var seekButtons = document.querySelectorAll('[data-movie-seek]');
  for (var i = 0; i < seekButtons.length; i++) {
    seekButtons[i].addEventListener('click', function () {
      var delta = Number(this.getAttribute('data-movie-seek'));
      var current = Number(video.currentTime) || 0;
      var duration = Number(video.duration);
      var target = Math.max(0, current + delta);
      if (isFinite(duration) && duration > 0) target = Math.min(target, Math.max(0, duration - 0.1));
      try { video.currentTime = target; } catch (error) { /* Wait for metadata before seeking. */ }
    });
  }

  if (!/^https?:\/\//i.test(url)) {
    fail();
  } else if (isHls && nativeHls) {
    video.src = url;
    video.load();
  } else if (isHls && window.Hls && window.Hls.isSupported()) {
    attachHls(url);
  } else if (isHls) {
    message('当前浏览器不支持此视频格式，请更换浏览器播放');
    failed = true;
  } else {
    video.src = url;
    video.load();
  }
  updateToggle();
  window.addEventListener('pagehide', function (event) {
    if (event && event.persisted) return;
    if (hls) { hls.destroy(); hls = null; }
  });
})();
