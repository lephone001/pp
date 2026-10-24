'use strict';

// Player controls and original HLS URLs without network requests or real media.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../app/public/article_static/moviex-player.js'), 'utf8');

function element(attributes = {}) {
  return {
    attributes: { ...attributes }, listeners: {}, textContent: '',
    getAttribute(name) { return this.attributes[name]; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    addEventListener(name, callback) { (this.listeners[name] || (this.listeners[name] = [])).push(callback); },
    emit(name, event) { (this.listeners[name] || []).forEach(callback => callback.call(this, event)); },
  };
}

function setup(options = {}) {
  const video = element({ 'data-video-url': options.url || 'https://media.example.test/test.m3u8', autoplay: '' });
  Object.assign(video, {
    paused: true, currentTime: 0, duration: 120, playCalls: 0, loadCalls: 0,
    canPlayType() { return options.native ? 'probably' : ''; },
    play() { this.playCalls++; this.paused = false; this.emit('play'); return Promise.resolve(); },
    pause() { this.paused = true; this.emit('pause'); },
    load() { this.loadCalls++; },
  });
  const toggle = element();
  const status = element();
  const seeks = [10, 60, 300, -10, -60, -300].map(value => element({ 'data-movie-seek': String(value) }));
  const hlsInstances = [];
  const playerOptions = [];
  class Hls {
    constructor(config) { this.config = config; this.events = {}; this.starts = 0; this.recoveries = 0; hlsInstances.push(this); }
    static isSupported() { return options.hlsSupported !== false; }
    on(name, callback) { this.events[name] = callback; }
    emit(name, data) { this.events[name](name, data); }
    loadSource(url) { this.source = url; }
    attachMedia(target) { this.video = target; }
    startLoad() { this.starts++; }
    stopLoad() { this.stopped = true; }
    recoverMediaError() { this.recoveries++; }
    destroy() { this.destroyed = true; }
  }
  Hls.Events = { MANIFEST_PARSED: 'manifest', ERROR: 'error' };
  Hls.ErrorTypes = { MEDIA_ERROR: 'media', NETWORK_ERROR: 'network' };
  const window = element();
  window.Hls = options.noHls ? undefined : Hls;
  window.Plyr = options.noPlyr ? undefined : function (target, config) {
    playerOptions.push(config);
    this.play = () => target.play();
    this.pause = () => target.pause();
  };
  const document = {
    getElementById(id) { return { MoviexVideo: video, 'moviex-play-toggle': toggle, 'moviex-play-status': status }[id]; },
    querySelectorAll() { return seeks; },
  };
  vm.runInNewContext(source, { window, document, encodeURIComponent, isFinite });
  return { video, toggle, status, seeks, hlsInstances, playerOptions, window, Hls };
}

const hls = setup();
assert.strictEqual(hls.video.autoplay, false);
assert.strictEqual(hls.video.playCalls, 0);
assert.strictEqual(hls.video.getAttribute('autoplay'), undefined);
assert.strictEqual(hls.playerOptions[0].autoplay, false);
assert.strictEqual(hls.playerOptions[0].iconUrl, '/article_static/moviex-player-icons.svg');
const first = hls.hlsInstances[0];
assert.strictEqual(first.config.autoStartLoad, false);
assert.strictEqual(first.starts, 0);
assert.strictEqual(first.source, 'https://media.example.test/test.m3u8');
first.emit('manifest');
assert.strictEqual(hls.video.playCalls, 0, 'manifest readiness does not autoplay');
hls.toggle.emit('click');
assert.strictEqual(hls.video.paused, false);
assert(first.starts > 0);
assert.strictEqual(hls.toggle.getAttribute('aria-pressed'), 'true');
hls.video.emit('playing');
assert.strictEqual(hls.status.textContent, '正在播放');
hls.toggle.emit('click');
assert.strictEqual(hls.video.paused, true);
assert.strictEqual(hls.toggle.getAttribute('aria-pressed'), 'false');
hls.seeks[0].emit('click');
assert.strictEqual(hls.video.currentTime, 10);
hls.seeks[2].emit('click');
assert.strictEqual(hls.video.currentTime, 119.9);
hls.seeks[5].emit('click');
assert.strictEqual(hls.video.currentTime, 0);
first.emit('error', { fatal: false, type: 'network' });
assert.strictEqual(hls.hlsInstances.length, 1);
first.emit('error', { fatal: true, type: 'network' });
assert.strictEqual(hls.hlsInstances.length, 1, 'network errors keep the original source');
assert.strictEqual(first.source, 'https://media.example.test/test.m3u8');
assert.strictEqual(first.stopped, true);
assert.strictEqual(hls.status.textContent, '视频暂时无法播放，请稍后重试');
hls.window.emit('pagehide', { persisted: true });
assert.strictEqual(first.destroyed, undefined);
hls.window.emit('pagehide', { persisted: false });
assert.strictEqual(first.destroyed, true);

const signedUrl = 'https://media.example.test/test.m3u8?token=abc%2Fdef&expires=123';
const mediaError = setup({ url: signedUrl });
const mediaSource = mediaError.hlsInstances[0];
mediaSource.emit('error', { fatal: true, type: 'media' });
assert.strictEqual(mediaSource.recoveries, 1);
assert.strictEqual(mediaSource.source, signedUrl, 'recovery preserves original URL and query encoding');
mediaSource.emit('error', { fatal: true, type: 'media' });
assert.strictEqual(mediaError.hlsInstances.length, 1);
assert.strictEqual(mediaSource.stopped, true);

const native = setup({ native: true });
assert.strictEqual(native.hlsInstances.length, 0, 'native HLS takes priority');
assert.strictEqual(native.video.src, 'https://media.example.test/test.m3u8');
assert.strictEqual(native.video.playCalls, 0);
native.video.emit('error');
assert.strictEqual(native.video.src, 'https://media.example.test/test.m3u8', 'native errors keep the original source');
assert.strictEqual(native.video.loadCalls, 1);
assert.strictEqual(native.status.textContent, '视频暂时无法播放，请稍后重试');
const mp4 = setup({ url: 'https://media.example.test/video.mp4', noPlyr: true });
assert.strictEqual(mp4.hlsInstances.length, 0);
assert.strictEqual(mp4.video.src, 'https://media.example.test/video.mp4');
assert.strictEqual(mp4.video.playCalls, 0);
mp4.toggle.emit('click');
assert.strictEqual(mp4.video.playCalls, 1);
const unsupported = setup({ noHls: true });
assert.strictEqual(unsupported.status.textContent, '当前浏览器不支持此视频格式，请更换浏览器播放');
assert.strictEqual(setup({ url: 'javascript:alert(1)' }).video.src, undefined);
console.log('PASS: native/HLS playback keeps original URLs on errors; media recovery, controls, seek bounds, no autoplay and cleanup verified.');
