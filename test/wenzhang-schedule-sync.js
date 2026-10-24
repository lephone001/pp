'use strict';

const assert = require('assert');
const Service = require('../app/service/wenzhangSync');
const Domain = require('../app/service/domain');
const schedule = require('../app/schedule/tongbucaijiwenzhang');

async function main() {
  const stored = {};
  const submitted = [];
  const service = Object.create(Service.prototype);
  service.ctx = {
    service: {
      localData: {
        async readJson(name, fallback) { return stored[name] || fallback; },
        async writeJson(name, value) { stored[name] = JSON.parse(JSON.stringify(value)); },
      },
      domain: {
        async tongbuScheduledContentSync(settings) {
          submitted.push(settings);
          return { code: 200, message: 'submitted' };
        },
      },
    },
  };

  assert.equal((await service.run('wenzhang')).skipped, true, 'disabled schedule must skip');
  const publicSettings = await service.save('wenzhang', {
    enabled: true,
    serverUrl: 'https://source.example/',
    receiveUrl: 'https://receiver.example/',
    password: 'secret',
    all: true,
    limit: 500,
  });
  assert.equal(publicSettings.password, undefined, 'API must not return saved password');
  assert.equal(publicSettings.passwordConfigured, true);
  assert.equal(stored.wenzhang_sync.serverUrl, 'https://source.example');
  assert.equal(stored.wenzhang_sync.receiveUrl, 'https://receiver.example');
  assert.equal(stored.wenzhang_sync.all, undefined, 'scheduled sync must not persist all=true');
  await service.run('wenzhang');
  assert.equal(submitted[0].limit, 500);
  assert.equal(submitted[0].all, false);
  assert.equal(stored.wenzhang_sync.lastSuccess, true);
  assert.equal(stored.wenzhang_sync.lastResult, 'submitted');
  await service.save('articleCbd', {
    enabled: true,
    serverUrl: 'https://cbd-source.example/',
    receiveUrl: 'https://receiver.example/',
    password: 'secret',
    limit: 200,
  });
  await service.run('articleCbd');
  assert.equal(submitted[1].type, 'articleCbd');
  assert.equal(submitted[1].limit, 200);
  assert(stored.article_cbd_sync, 'CBD schedule must use an independent settings file');
  await service.save('video', {
    enabled: true,
    serverUrl: 'https://video-source.example/',
    receiveUrl: 'https://receiver.example/',
    password: 'secret',
    limit: 300,
  });
  await service.run('video');
  assert.equal(submitted[2].type, 'video');
  assert.equal(submitted[2].limit, 300);
  assert.equal(submitted[2].all, false);
  assert(stored.video_sync, 'video schedule must use an independent settings file');
  await service.save('app', {
    enabled: true,
    serverUrl: 'https://app-source.example/',
    receiveUrl: 'https://receiver.example/',
    password: 'secret',
    limit: 400,
  });
  await service.run('app');
  assert.equal(submitted[3].type, 'app');
  assert.equal(submitted[3].limit, 400);
  assert.equal(submitted[3].all, false);
  assert(stored.app_sync, 'app schedule must use an independent settings file');
  await service.save('article', {
    enabled: true,
    serverUrl: 'https://article-source.example/',
    receiveUrl: 'https://receiver.example/',
    password: 'secret',
    limit: 500,
  });
  await service.run('article');
  assert.equal(submitted[4].type, 'article');
  assert.equal(submitted[4].limit, 500);
  assert.equal(submitted[4].all, false);
  assert(stored.article_sync, 'article schedule must use an independent settings file');
  assert.equal(schedule.schedule.cron, '0 30 4 * * *');
  assert.equal(schedule.schedule.cronOptions.tz, 'Asia/Shanghai');
  assert.equal(schedule.schedule.type, 'worker');

  let request = null;
  const domain = Object.create(Domain.prototype);
  domain.ctx = {
    model: {
      Wenzhang: {}, WenzhangCate: {}, ArticleCbd: {},
      Video: {}, VideoCategory: {}, VideoPlatform: {},
      App: {}, AppCategory: {}, Article: {}, ArticleCategory: {},
    },
  };
  domain.triggerRemoteContentPush = async options => { request = options; };
  const queued = await domain.tongbuScheduledContentSync({
    type: 'articleCbd',
    serverUrl: 'https://source.example/',
    receiveUrl: 'https://receiver.example/',
    password: 'secret',
    limit: 500,
    all: true,
  });
  assert.equal(queued.code, 200);
  assert.equal(request.remoteUrl, 'https://source.example/api/tongbuContentPush');
  assert.equal(request.callbackUrl, 'https://receiver.example/api/tongbuContentReceive');
  assert.equal(request.type, 'articleCbd');
  assert.equal(request.uid, 'articleCbd-schedule');
  assert.equal(request.syncLimit, 500);
  assert.equal(request.syncAll, false, 'scheduled sync must ignore all=true');
  assert.equal(domain.getContentSyncConfig('articleCbd').batchSize, 100);
  assert.equal(domain.getContentSyncConfig('video').categoryModel, domain.ctx.model.VideoCategory);
  assert.equal(domain.getContentSyncConfig('video').platformModel, domain.ctx.model.VideoPlatform);
  assert.equal(domain.getContentSyncConfig('app').categoryModel, domain.ctx.model.AppCategory);
  assert.equal(domain.getContentSyncConfig('article').categoryModel, domain.ctx.model.ArticleCategory);
  const videoQueued = await domain.tongbuScheduledContentSync({
    type: 'video',
    serverUrl: 'https://video-source.example/',
    receiveUrl: 'https://receiver.example/',
    password: 'secret',
    limit: 300,
  });
  assert.equal(videoQueued.code, 200);
  assert.equal(request.type, 'video');
  assert.equal(request.syncLimit, 300);
  assert.equal(request.syncAll, false);

  const scheduledTypes = [];
  await schedule.task({
    service: { wenzhangSync: { async run(type) { scheduledTypes.push(type); return { skipped: true }; } } },
    logger: { info() {}, error() {} },
  });
  assert.deepEqual(scheduledTypes, [ 'wenzhang', 'articleCbd', 'video', 'app', 'article' ]);
  console.log('content scheduled sync: PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
