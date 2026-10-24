'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
// Optional review dependency; can reuse the admin workspace's ws installation.
const WebSocket = require(process.env.PORTAL_WS_PATH || 'ws');
const assert = require('assert');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'download-portal-visual-'));
const previewPort = Number(process.env.PORTAL_PREVIEW_PORT || 17865);
const debugPort = Number(process.env.PORTAL_DEBUG_PORT || 17866);
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + debugPort, '--user-data-dir=' + path.join(output, 'profile'), 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function getTabs() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:' + debugPort + '/json', res => {
      let data = ''; res.on('data', value => { data += value; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (error) { reject(error); } });
    }).on('error', reject);
  });
}
async function main() {
  let tabs;
  for (let i = 0; i < 100; i++) {
    try { tabs = await getTabs(); if (tabs.length) break; } catch (_) { /* browser starting */ }
    await delay(100);
  }
  if (!tabs || !tabs.length) throw new Error('Chrome debugging endpoint unavailable');
  const socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.once('open', resolve));
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  socket.on('message', raw => {
    const message = JSON.parse(raw);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params);
    if (pending.has(message.id)) {
      const entry = pending.get(message.id); pending.delete(message.id);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result);
    }
  });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  }
  await send('Page.enable'); await send('Runtime.enable');
  for (const mode of [ { name: 'desktop', width: 1600, height: 1100, mobile: false, path: '/Article/download5/preview.html' }, { name: 'mobile', width: 390, height: 844, mobile: true, path: '/' } ]) {
    await send('Emulation.setDeviceMetricsOverride', { width: mode.width, height: mode.height, deviceScaleFactor: 1, mobile: mode.mobile });
    await send('Page.navigate', { url: 'http://127.0.0.1:' + previewPort + mode.path });
    await delay(1800);
    const metrics = await send('Runtime.evaluate', { expression: 'JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,links:document.querySelectorAll("a[href]").length,backups:document.querySelectorAll(".portal-backup-domains a[href]").length,images:document.images.length,loaded:Array.from(document.images).filter(i=>i.complete&&i.naturalWidth>0).length})', returnByValue: true });
    const value = JSON.parse(metrics.result.value);
    assert(value.scroll <= value.width, mode.name + ' horizontal overflow: ' + JSON.stringify(value));
    assert(value.links >= 1867 + value.backups && value.links <= 1877 + value.backups); assert.strictEqual(value.images, 529);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(output, mode.name + '.png'), Buffer.from(screenshot.data, 'base64'));
    await send('Runtime.evaluate', { expression: 'document.querySelector(".portal-body").scrollIntoView({behavior:"instant"})' });
    await delay(300);
    const bodyScreenshot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(output, mode.name + '-content.png'), Buffer.from(bodyScreenshot.data, 'base64'));
    const search = await send('Runtime.evaluate', { expression: 'document.getElementById("portal-search").value=document.querySelector(".card-title").textContent.trim().slice(0,2); document.querySelector(".search-form").dispatchEvent(new Event("submit",{cancelable:true}));document.querySelector(".search-result").textContent', returnByValue: true });
    assert(search.result.value.includes('匹配应用'));
    console.log(mode.name, JSON.stringify(value));
  }
  assert.strictEqual(errors.length, 0, 'Browser runtime errors');
  console.log('Screenshots: ' + output);
  await send('Browser.close'); socket.close();
}
main().catch(error => { console.error(error); browser.kill(); process.exitCode = 1; });
