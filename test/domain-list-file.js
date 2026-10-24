'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { updateDomainListFile } = require('../app/utils/domainListFile');
const { getDomainHostList, normalizeHost } = require('../app/lib/domainHostCache');

function loadService(filename, ctx) {
  const sandbox = {
    module: { exports: {} }, console, process, URL, setTimeout, clearTimeout,
    require(name) {
      if (name === 'egg') return { Service: class { constructor(context) { this.ctx = context; } } };
      if (name === '../confi/index') return {};
      if (name === './datajson/citycompanyname') return {
        cityCompanyName: () => 'test', conpmayName: () => 'test', getCityName: () => 'test',
      };
      if (name === '../utils/domainListFile') return { updateDomainListFile };
      return require(name);
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', filename), 'utf8'), sandbox);
  return new sandbox.module.exports(ctx);
}

async function main() {
  const baseDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'domain-list-file-'));
  const filename = path.join(baseDir, 'app', 'local_data', 'allDomainList.txt');
  let rows = [
    { _id: '1', link: 'owner.test', uid: 'owner', uname: 'owner', status: 1 },
    { _id: '2', link: 'other.test:7001', uid: 'other', uname: 'other', status: 0 },
  ];
  let serial = 2;
  let queryError = false;
  const queries = [];
  const matches = (row, criteria) => Object.entries(criteria).every(([ key, value ]) =>
    value && value.$in ? value.$in.includes(row[key]) : row[key] === value);
  function Model(data) {
    this.toObject = () => ({ _id: String(++serial), ...data });
  }
  Model.find = criteria => {
    const query = { criteria };
    queries.push(query);
    return {
      select(fields) { query.fields = fields; return this; },
      sort(sort) { query.sort = sort; return this; },
      async lean() {
        if (queryError) throw new Error('database unavailable');
        let selected = rows.filter(row => matches(row, criteria));
        if (query.sort) selected = selected.slice().sort((a, b) => a.link.localeCompare(b.link));
        return selected.map(row => ({ ...row }));
      },
      then(resolve, reject) { return this.lean().then(resolve, reject); },
    };
  };
  Model.findOne = criteria => ({
    select() { return this; },
    async lean() { const row = rows.find(row => matches(row, criteria)); return row ? { ...row } : null; },
    then(resolve, reject) { return this.lean().then(resolve, reject); },
  });
  Model.findOneAndUpdate = (criteria, updates) => {
    const row = rows.find(row => matches(row, criteria));
    if (row) Object.assign(row, updates.$set);
    return {
      populate() { return this; },
      then(resolve, reject) { return Promise.resolve(row ? { ...row } : null).then(resolve, reject); },
    };
  };
  Model.updateMany = async (criteria, updates) => {
    for (const row of rows.filter(row => matches(row, criteria))) Object.assign(row, updates.$set);
  };
  Model.update = async (criteria, updates) => {
    const row = rows.find(row => matches(row, criteria));
    if (row) Object.assign(row, updates.$set);
  };
  Model.findById = async id => ({ ...rows.find(row => row._id === id) });
  Model.create = async data => {
    if (rows.some(row => row.link === data.link)) throw new Error('duplicate');
    const row = { _id: String(++serial), ...data };
    rows.push(row);
    return row;
  };
  Model.findByIdAndDelete = async criteria => {
    const index = rows.findIndex(row => row._id === criteria._id && row.uid === criteria.uid && row.uname === criteria.uname);
    return index < 0 ? null : rows.splice(index, 1)[0];
  };
  Model.findOneAndDelete = async criteria => {
    const index = rows.findIndex(row => row.link === criteria.link && row.uid === criteria.uid && row.uname === criteria.uname);
    return index < 0 ? null : rows.splice(index, 1)[0];
  };
  Model.collection = {
    async insertOne(data) { rows.push(data); },
  };
  const warnings = [];
  const notifications = [];
  const ctx = {
    app: { baseDir, messenger: { sendToApp: (...args) => notifications.push(args) } },
    model: { Domain: Model, DelDomain: { create: async () => ({}) } },
    logger: { error: (...args) => warnings.push(args) },
    service: {
      utils: { getTokenInfo: () => 'owner', jiamiFn: value => value },
      counters: { set: async () => ({}) },
    },
  };
  const domain = loadService('app/service/domain.js', ctx);
  const site = loadService('app/service/site.js', ctx);
  ctx.service.domain = domain;
  let updates = 0;
  const update = domain.updateAllDomainList.bind(domain);
  domain.updateAllDomainList = async () => { updates++; return update(); };
  function assertCurrentFile() {
    const expected = rows.map(row => row.link.trim()).filter(Boolean).sort();
    const content = fs.readFileSync(filename, 'utf8');
    assert.deepStrictEqual(content ? content.trimEnd().split('\n').sort() : [], expected);
    assert(!content.includes('uid') && !content.includes('status'));
    assert.deepStrictEqual(Array.from(getDomainHostList(baseDir).domains).sort(),
      expected.map(link => normalizeHost(link).hostname).sort());
  }

  try {
    const initial = await domain.updateAllDomainList();
    assert.strictEqual(initial.code, 200);
    assert.strictEqual(initial.data.count, 2);
    assert.strictEqual(notifications[0][0], 'all-domain-list-updated');
    assert.strictEqual(notifications[0][1].sourcePid, process.pid);
    assert.deepStrictEqual(queries[0].criteria, {});
    assert.strictEqual(queries[0].fields, 'link -_id');
    assertCurrentFile(); // Includes disabled domains belonging to another owner.

    await domain.createDomain({ link: 'created.test' });
    assert.strictEqual(updates, 2);
    assertCurrentFile();
    assert.strictEqual((await domain.createDomain({ link: 'created.test' })).code, -2);
    assert.strictEqual(updates, 2);

    await site.copyNewSite({ id: '1', link: 'copied.test' });
    assert.strictEqual(updates, 3);
    assertCurrentFile();

    const batch = await site.multipleDomainCreate([
      { link: 'batch-a.test' }, { link: 'batch-b.test' }, { link: 'created.test' },
    ]);
    assert.strictEqual(batch.code, 200);
    assert.strictEqual(updates, 4); // One full refresh for the batch, including partial success.
    assertCurrentFile();

    const created = rows.find(row => row.link === 'created.test');
    assert.strictEqual((await domain.delDomain(created._id)).code, 200);
    assert.strictEqual(updates, 5);
    assertCurrentFile();
    const deleted = await domain.mutDelDomain([ 'batch-a.test', 'absent.test' ]);
    assert.strictEqual(deleted.code, 200);
    assert.strictEqual(updates, 6);
    assertCurrentFile();
    await domain.mutDelDomain([ 'absent.test' ]);
    assert.strictEqual(updates, 6);

    domain.getSyncRelationMap = async () => new Map();
    domain.createUniqueSyncDomainId = async () => 100;
    domain.refreshDomain = async () => ({ code: 200 });
    const imported = await domain.executeDomainSyncImport({
      remoteRows: [ { _id: 'remote', link: 'imported.test' } ], normalizedLinks: [],
      syncAllDomains: true, uid: 'owner', uname: 'owner', sourceServer: 'http://source.test',
    });
    assert.strictEqual(imported.code, 200);
    assert.strictEqual(updates, 7);
    assertCurrentFile();

    domain.refreshDomain = async () => { throw new Error('cache unavailable'); };
    await domain.executeDomainSyncImport({
      remoteRows: [ { _id: 'remote-2', link: 'inserted-before-cache-error.test' } ], normalizedLinks: [],
      syncAllDomains: true, uid: 'owner', uname: 'owner', sourceServer: 'http://source.test',
    });
    assert.strictEqual(updates, 8);
    assertCurrentFile();

    const previous = fs.readFileSync(filename, 'utf8');
    const previousCache = getDomainHostList(baseDir);
    const previousNotifications = notifications.length;
    queryError = true;
    assert.strictEqual((await domain.updateAllDomainList()).code, -1);
    assert.strictEqual(fs.readFileSync(filename, 'utf8'), previous);
    assert.strictEqual(getDomainHostList(baseDir), previousCache);
    assert.strictEqual(notifications.length, previousNotifications);
    await domain.createDomain({ link: 'saved-during-export-failure.test' });
    assert(rows.some(row => row.link === 'saved-during-export-failure.test'));
    assert.strictEqual(fs.readFileSync(filename, 'utf8'), previous);
    assert(warnings.length >= 2); // Export errors do not change existing CRUD success behavior.
    queryError = false;

    // A concurrent newer snapshot must run after the older snapshot has finished writing.
    let releaseFirst, firstStarted;
    const started = new Promise(resolve => { firstStarted = resolve; });
    const gate = new Promise(resolve => { releaseFirst = resolve; });
    const delayedModel = { find() { return {
      select() { return this; }, sort() { return this; },
      async lean() { firstStarted(); await gate; return [ { link: 'old.test' } ]; },
    }; } };
    const first = updateDomainListFile(delayedModel, baseDir);
    await started;
    let secondQueried = false;
    const newerModel = { find() { secondQueried = true; return {
      select() { return this; }, sort() { return this; },
      async lean() { return [ { link: 'new.test' } ]; },
    }; } };
    const second = updateDomainListFile(newerModel, baseDir);
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.strictEqual(secondQueried, false);
    releaseFirst();
    await Promise.all([ first, second ]);
    assert.strictEqual(fs.readFileSync(filename, 'utf8'), 'new.test\n');
    assert.deepStrictEqual(Array.from(getDomainHostList(baseDir).domains), [ 'new.test' ]);

    // Rename failure preserves the previous complete file and releases the lock/temp file.
    const rename = fs.promises.rename;
    fs.promises.rename = async () => { throw new Error('rename failed'); };
    try {
      await assert.rejects(updateDomainListFile(Model, baseDir), /rename failed/);
    } finally {
      fs.promises.rename = rename;
    }
    assert.strictEqual(fs.readFileSync(filename, 'utf8'), 'new.test\n');
    assert.deepStrictEqual(Array.from(getDomainHostList(baseDir).domains), [ 'new.test' ]);
    assert.deepStrictEqual(fs.readdirSync(path.dirname(filename)), [ 'allDomainList.txt' ]);

    await fs.promises.writeFile(filename + '.lock', '');
    const old = new Date(Date.now() - 6 * 60 * 1000);
    await fs.promises.utimes(filename + '.lock', old, old);
    await domain.updateAllDomainList();
    assertCurrentFile();

    domain.refreshDomain = async () => ({ code: 200 });
    let updatesBeforeRename = updates;
    assert.strictEqual((await domain.updateDomain('1', { link: 'renamed-owner.test' })).code, 200);
    assert.strictEqual(updates, updatesBeforeRename + 1);
    assertCurrentFile();
    assert(!getDomainHostList(baseDir).domains.has('owner.test'));
    updatesBeforeRename = updates;
    await domain.updateDomain('1', { title: 'new title' });
    await domain.updateDomain('1', { link: 'renamed-owner.test' });
    assert.strictEqual((await domain.updateDomain('missing', { link: 'absent.test' })).code, -2);
    assert.strictEqual(updates, updatesBeforeRename, 'Unchanged domain links must not trigger a full export');

    domain.refreshDomain = async () => { throw new Error('cache refresh failed after rename'); };
    await assert.rejects(domain.updateDomain('1', { link: 'saved-before-cache-error.test' }), /cache refresh failed/);
    assertCurrentFile();
    domain.refreshDomain = async () => ({ code: 200 });

    updatesBeforeRename = updates;
    await domain.mutUpdateDomain({ links: [ 'saved-before-cache-error.test' ], updates: { link: 'bulk-renamed.test' }, isAll: false });
    assert.strictEqual(updates, updatesBeforeRename + 1);
    assertCurrentFile();
    await domain.mutUpdateReplaceDomain({
      links: [ 'bulk-renamed.test' ], updates: [ { key: 'link', bval: 'bulk-renamed', aval: 'batch-replaced' } ], type: 'replace', isAll: false,
    });
    assertCurrentFile();
    await domain.mutUpdateReplaceDomain({
      links: [ 'batch-replaced.test' ], updates: [ { link: 'batch-replaced.test', update: { link: 'batch-explicit.test' } } ], type: 'update', isAll: false,
    });
    assert.strictEqual(updates, updatesBeforeRename + 3);
    assertCurrentFile();
    await domain.mutUpdateDomain({ links: [ 'batch-explicit.test' ], updates: { title: 'another title' }, isAll: false });
    assert.strictEqual(updates, updatesBeforeRename + 3);

    rows = [];
    await domain.updateAllDomainList();
    assert.strictEqual(fs.readFileSync(filename, 'utf8'), '');
    assert.strictEqual(getDomainHostList(baseDir).domains.size, 0);
    console.log('PASS: full export, create/copy/batch/import/rename/delete cache updates, worker notifications, concurrency and failure preservation');
  } finally {
    // Only remove the temporary directory created by this test.
    assert(path.resolve(baseDir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.promises.rm(baseDir, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
