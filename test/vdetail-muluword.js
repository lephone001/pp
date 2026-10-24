'use strict';

// node test/vdetail-muluword.js: exercise the real controller with mocked files and database calls.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '../app/controller/page/video.js'), 'utf8');
const videoId = '6acc02763533e98bc8c234ac';
const categoryId = '6a868f38f80952a7e2609f97';
const goodWord = { title: 'Directory title', keywords: 'Directory keywords', description: 'Directory description', index: 5 };

function setup(options = {}) {
    const rendered = [];
    const writes = [];
    const calls = { word: 0, video: 0, lists: [] };
    const domain = Object.prototype.hasOwnProperty.call(options, 'domain') ? options.domain : {
        title: 'Site title', keyWords: 'Site keywords', description: 'Site description',
        fullDomain: 'www.luban7.cn', mcid: { _id: 'category', num: 3 }, isMuLu: true,
        isMobile: true, ispcpage: 1, isBaiduType: 0, browserType: options.browserType || 'normal',
        isBaiduSpider: false, fromNum: 0, tname: 'video_template', titleType: options.titleType || 0,
        agentLink: { isAgentPage: Boolean(options.agentPage), agentPageName: 'agent', gajs: '' },
        jumpIFrameHTML: '', urlNumber: 123, banBenNumber: 'V1', beiAnName: 'Site name',
    };
    const detail = { _id: videoId, cid: 'video-category', title: 'Original video title', video: 'https://media.example/video.m3u8' };
    const fakeFs = {
        existsSync: filename => !filename.includes('s-count-'),
        readFileSync: filename => {
            if (filename.includes('/app/public/html/')) return '<html><head><title>Agent</title><meta content="description"></head><body>HDESC</body></html>';
            if (options.cache !== undefined) return options.cache;
            const error = new Error('missing cache');
            error.code = 'ENOENT';
            throw error;
        },
        mkdirSync: () => {},
        writeFile: (filename, data) => writes.push({ filename, data: JSON.parse(data) }),
        unlinkSync: () => {},
    };
    const mod = { exports: {} };
    vm.runInNewContext(source, {
        module: mod, process: { cwd: () => '/server' },
        require: name => {
            if (name === 'egg') return { Controller: class {} };
            if (name === 'fs') return fakeFs;
            if (name === 'moment') return { locale: () => {} };
            if (name === 'axios' || name === 'lodash') return {};
            if (name === 'crypto') return require('crypto');
            throw new Error('Unexpected dependency: ' + name);
        },
    });
    const controller = new mod.exports();
    const chain = {
        sort: () => chain, populate: () => chain, select: () => chain, skip: () => chain, limit: () => chain,
        lean: async () => options.rows || [],
        then: (resolve, reject) => Promise.resolve(options.rows || []).then(resolve, reject),
    };
    controller.ctx = {
        params: { id: options.id || videoId, cid: categoryId, value: 'Search' }, query: {}, header: { host: 'www.luban7.cn' },
        url: options.url || '/vdetail/' + (options.id || videoId) + '/index.html',
        app: { config: { cacheFile: '/cache/', common: { VIDEO_TIME: 60000, JUMPHTML: () => '' } } },
        service: {
            utils: {
                getSiteInfo: async () => ({ site: { title: 'Site' }, domain }),
                getMuluItemOne: async () => {
                    calls.word += 1;
                    return Object.prototype.hasOwnProperty.call(options, 'word') ? options.word : goodWord;
                },
                strToNumber: () => 12345, urlToStr: () => 'letters', urlToemoj: () => 'symbol',
                allPage: async () => { throw new Error('Unexpected allPage fallback'); },
            },
            video: { findVideo: async () => { calls.video += 1; return options.missingVideo ? { code: -1 } : { data: detail }; } },
            cache: { get: async () => [{ _id: categoryId, name: 'Category', num: 98 }] },
        },
        model: { Video: {
            find: criteria => { calls.lists.push(criteria); return chain; },
            countDocuments: async () => 48,
        } },
        render: async (template, data) => { rendered.push({ template, data }); controller.ctx.body = 'rendered'; },
    };
    return { controller, domain, detail, rendered, writes, calls };
}

async function main() {
    for (const word of [null, undefined, {}, [], { title: null, description: {}, keywords: [] }]) {
        const probe = setup({ word });
        await probe.controller.vdetail();
        assert.strictEqual(probe.rendered[0].template, 'template/video_template/vdetail.html');
        assert.strictEqual(probe.detail.title, 'Original video title');
        assert.strictEqual(probe.detail.now_title, 'Site title');
        assert.strictEqual(probe.detail.now_keywords, 'Site keywords');
        assert.strictEqual(probe.detail.now_description, 'Site description');
        assert.strictEqual(probe.calls.video, 1);
    }

    const word = { title: '[\u7ad9\u540d] [\u6570\u5b57] [\u57df\u540d]', keywords: 'Keywords', description: '[\u5173\u952e\u5b57] [\u7b26\u53f7]', index: 5 };
    const ordinary = setup({ word });
    await ordinary.controller.vdetail();
    assert.strictEqual(ordinary.detail.now_title, 'Site name 123 www.luban7.cn/vdetail/' + videoId + '/index.html');
    assert.strictEqual(ordinary.detail.now_description, 'Keywords symbol');
    assert.strictEqual(ordinary.rendered[0].data.f_item.index, 5);
    assert.strictEqual(word.title, '[\u7ad9\u540d] [\u6570\u5b57] [\u57df\u540d]');

    const document = setup({ word: { toObject: () => ({ ...goodWord, _id: 'word-id' }) } });
    await document.controller.vdetail();
    assert.strictEqual(document.detail.now_title, goodWord.title);
    assert.strictEqual(document.rendered[0].data.f_item._id, 'word-id');

    const cachedDetail = JSON.stringify({ detail: { _id: videoId, title: 'Cached video title' }, updateCacheTime: Date.now() });
    for (const word of [null, goodWord, { title: 'Partial title' }, { description: 'Partial description' }]) {
        const cached = setup({ word, cache: cachedDetail });
        await cached.controller.vdetail();
        assert.strictEqual(cached.calls.video, 0);
        assert.strictEqual(cached.rendered[0].data.detail.now_title, word && word.title || 'Site title');
        assert.strictEqual(cached.writes.length, 0);
    }
    for (const cache of ['null', '[]', '{}', '{bad json', '{"detail":null}', '{"detail":{"title":"Missing id"}}']) {
        const broken = setup({ word: null, cache });
        await broken.controller.vdetail();
        assert.strictEqual(broken.calls.video, 1);
        assert.strictEqual(broken.rendered.length, 1);
        assert.strictEqual(broken.writes.length, 1);
        assert.strictEqual(broken.writes[0].data.detail._id, videoId);
    }

    for (const cache of [undefined, cachedDetail]) {
        const urlTitle = setup({ word: null, cache, titleType: 1 });
        await urlTitle.controller.vdetail();
        assert.strictEqual(urlTitle.rendered[0].data.detail.title, 'www.luban7.cn' + urlTitle.controller.ctx.url);
        assert.strictEqual(urlTitle.rendered[0].data.detail.now_title, '');
    }

    for (const browserType of ['baidu01', 'baidu02']) {
        for (const agentPage of [false, true]) {
            for (const word of [null, { title: 'Partial title' }]) {
                const browser = setup({ browserType, agentPage, word });
                await browser.controller.vdetail();
                assert.strictEqual(browser.calls.video, 0);
                assert(browser.controller.ctx.body.includes(word && word.title || 'Site title'));
                assert(browser.controller.ctx.body.includes('Site description'));
                assert(!browser.controller.ctx.body.includes('undefined'));
            }
        }
    }

    for (const isMuLu of [true, false]) {
        const missing = setup({ missingVideo: true, word: null });
        missing.domain.isMuLu = isMuLu;
        await missing.controller.vdetail();
        assert.strictEqual(missing.rendered[0].template, isMuLu ? '/ml/index.html' : '404v.html');
        assert.strictEqual(missing.writes.length, 0);
    }
    const directoryPath = setup({ id: 'sadfasd', word: null });
    await directoryPath.controller.vdetail();
    assert.strictEqual(directoryPath.rendered[0].template, '/ml/index.html');
    assert.strictEqual(directoryPath.rendered[0].data.detail.title, 'Site title');

    for (const id of [videoId, 'sadfasd']) {
        const noDomain = setup({ id, domain: null });
        await noDomain.controller.vdetail();
        assert.strictEqual(noDomain.controller.ctx.body, '404');
        assert.strictEqual(noDomain.calls.word, 0);
    }
    for (const method of ['vcategory', 'vsearchlist']) {
        const url = method === 'vcategory' ? '/vcategory/' + categoryId : '/vsearchlist/Search';
        for (const cache of [undefined, JSON.stringify({ rows: [], count: 48, updateCacheTime: Date.now() })]) {
            for (const word of [null, undefined, {}, [], { title: null }, { title: 'Partial title' }, goodWord]) {
                const page = setup({ word, url, cache });
                await page.controller[method]();
                const rendered = page.rendered[0];
                assert.strictEqual(rendered.template, 'template/video_template/' + method + '.html');
                assert.strictEqual(rendered.data.f_item.title, word && word.title || 'Site title');
                assert.strictEqual(rendered.data.f_item.description, word && word.description || 'Site description');
                assert.strictEqual(rendered.data.f_item.keywords, word && word.keywords || 'Site keywords');
                assert.strictEqual(rendered.data.videoList.length, 0);
                assert.strictEqual(rendered.data.pageSize, 48);
                assert.strictEqual(page.calls.lists.length, cache === undefined ? 1 : 0);
                if (method === 'vcategory') {
                    assert.strictEqual(rendered.data.nowCategory._id, categoryId);
                    assert.strictEqual(rendered.data.count, 98);
                } else {
                    assert.strictEqual(rendered.data.searchTitle, 'Search');
                    assert.strictEqual(rendered.data.count, 48);
                }
            }
        }
        const absentSite = setup({ domain: null, url });
        await absentSite.controller[method]();
        assert.strictEqual(absentSite.rendered[0].template, '404.html');
        assert.strictEqual(absentSite.calls.word, 0);

        const options = { url, word: null, rows: [{ _id: videoId, title: 'First request' }] };
        const repeated = setup(options);
        await repeated.controller[method]();
        const firstResult = repeated.rendered[0].data;
        assert.strictEqual(firstResult.offset, videoId);
        options.rows = [];
        await repeated.controller[method]();
        const secondResult = repeated.rendered[1].data;
        assert.notStrictEqual(firstResult, secondResult);
        assert.strictEqual(firstResult.videoList[0].title, 'First request');
        assert.strictEqual(secondResult.videoList.length, 0);
        assert.strictEqual(secondResult.offset, undefined);
    }
    const invalidCategory = setup();
    invalidCategory.controller.ctx.params.cid = 'invalid';
    await invalidCategory.controller.vcategory();
    assert.strictEqual(invalidCategory.rendered[0].template, 'error.html');
    assert.strictEqual(invalidCategory.calls.word, 0);
    const invalidSearch = setup();
    invalidSearch.controller.ctx.params.value = '';
    await invalidSearch.controller.vsearchlist();
    assert.strictEqual(invalidSearch.rendered[0].template, 'notfind.html');
    assert.strictEqual(invalidSearch.calls.word, 0);
    console.log('PASS: video detail, category and search handle missing words; caches, page modes and request data remain correct.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
