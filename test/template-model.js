'use strict';

// node test/template-model.js: use Egg's real model loader, then mock database operations.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const FileLoader = require('egg-core/lib/loader/file_loader');
const source = fs.readFileSync(path.join(__dirname, '../app/service/template.js'), 'utf8');
const id = '6a868f38f80952a7e2609f97';
const defaultRows = [{ siteType: 4, label: 'Default template', value: 'default_template', disabled: false, sort: 0 }];
const dbRow = { _id: id, siteType: 4, label: 'Database template', value: 'db_template', disabled: false, sort: 1 };

function setup(options = {}) {
  const warnings = [];
  const calls = [];
  const app = {};
  const dbError = new Error('Connection failed: mongodb://test-user:test-password@example.test/test-db');
  dbError.code = 'ECONNREFUSED';
  const chain = (value, error) => {
    const query = {
      sort: () => query, skip: () => query, limit: () => query, select: () => query, lean: () => query,
      exec: async () => { if (error) throw error; return value; },
      then: (resolve, reject) => query.exec().then(resolve, reject),
    };
    return query;
  };
  const model = {
    exists: async criteria => {
      calls.push({ method: 'exists', criteria });
      if (options.seedError) throw dbError;
      if (options.seedTimeout) return new Promise(() => {});
      return options.empty ? null : { _id: id };
    },
    insertMany: async (rows, config) => { calls.push({ method: 'insertMany', rows, config }); return rows; },
    find: criteria => { calls.push({ method: 'find', criteria }); return chain([{ ...dbRow }], options.queryError && dbError); },
    countDocuments: criteria => { calls.push({ method: 'countDocuments', criteria }); return chain(1, options.queryError && dbError); },
    create: async row => { calls.push({ method: 'create', row }); return { _id: id, ...row }; },
    findByIdAndUpdate: (recordId, update, config) => {
      calls.push({ method: 'update', id: recordId, update, config });
      return chain({ ...dbRow, ...update.$set });
    },
    findByIdAndDelete: async recordId => { calls.push({ method: 'remove', id: recordId }); return { _id: recordId }; },
    bulkWrite: async (operations, config) => { calls.push({ method: 'bulkWrite', operations, config }); return { modifiedCount: 1 }; },
  };
  const mod = { exports: {} };
  vm.runInNewContext(source, {
    module: mod, setTimeout: (callback, delay) => setTimeout(callback, options.seedTimeout ? 10 : delay), clearTimeout,
    require: name => {
      if (name === 'egg') return { Service: class {} };
      if (name === '../common_data/templates.json') return defaultRows;
      throw new Error('Unexpected dependency: ' + name);
    },
  });
  const service = new mod.exports();
  service.app = app;
  service.ctx = { app, model: { Template: model }, logger: { warn: (...args) => warnings.push(args) } };
  return { service, warnings, calls };
}

async function main() {
  const mongoose = new (require('mongoose').Mongoose)();
  const models = {};
  new FileLoader({
    directory: path.join(__dirname, '../app/model'), match: 'template.js', target: models,
    inject: { mongoose }, caseStyle: 'upper',
    filter: model => typeof model === 'function' && model.prototype instanceof mongoose.Model,
  }).load();
  assert(models.Template, 'template.js must be registered as Template by Egg');
  assert.strictEqual(models.Templates, undefined);
  assert.strictEqual(models.Template.collection.name, 'templates');

  const options = setup();
  const optionResult = await options.service.options();
  assert.strictEqual(optionResult.code, 200);
  assert(optionResult.data.some(row => row.value === 'db_template'));
  assert(optionResult.data.some(row => row.value === 'default_template'));
  assert.strictEqual(options.warnings.length, 0);
  assert(options.calls.some(call => call.method === 'find'));

  const list = setup();
  const listResult = await list.service.list({ siteType: 4 });
  assert.strictEqual(listResult.data.rows[0].value, 'db_template');
  assert.strictEqual(listResult.data.count, 1);
  assert.strictEqual(list.warnings.length, 0);
  const all = setup();
  const allResult = await all.service.list({ all: true });
  assert.strictEqual(allResult.data.count, 1);
  assert(!all.calls.some(call => call.method === 'countDocuments'));

  const empty = setup({ empty: true });
  await empty.service.options();
  const insert = empty.calls.find(call => call.method === 'insertMany');
  assert.strictEqual(insert.rows[0].value, 'default_template');
  assert.strictEqual(insert.config.ordered, false);
  const concurrent = setup({ empty: true });
  await Promise.all([concurrent.service.options(), concurrent.service.options()]);
  assert.strictEqual(concurrent.calls.filter(call => call.method === 'insertMany').length, 1);

  const writes = setup();
  const created = await writes.service.create({ siteType: 4, label: 'New template', value: 'new_template' });
  assert.strictEqual(created.code, 200);
  assert.strictEqual(created.data.value, 'new_template');
  const updated = await writes.service.update(id, { label: 'Updated template' });
  assert.strictEqual(updated.code, 200);
  assert.strictEqual(updated.data.label, 'Updated template');
  assert.strictEqual((await writes.service.remove(id)).code, 200);
  const imported = await writes.service.importRows({ rows: [{ siteType: 4, label: 'Imported template', value: 'imported_template' }] });
  assert.strictEqual(imported.code, 200);
  assert.strictEqual(imported.data.count, 1);
  assert.strictEqual(writes.calls.find(call => call.method === 'bulkWrite').operations[0].updateOne.upsert, true);
  const exported = await writes.service.exportRows();
  assert.strictEqual(exported.code, 200);
  assert.strictEqual(exported.data[0].value, 'db_template');
  assert.strictEqual(writes.warnings.length, 0);

  for (const method of ['options', 'list']) {
    for (const failure of ['seedError', 'queryError', 'seedTimeout']) {
      const fallback = setup({ [failure]: true });
      const response = await fallback.service[method]({ siteType: 4 });
      const rows = method === 'options' ? response.data : response.data.rows;
      assert.strictEqual(response.code, 200);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].value, 'default_template');
      assert.strictEqual(fallback.warnings.length, 1);
      assert.strictEqual(fallback.warnings[0][1], failure === 'seedTimeout' ? 'timeout' : 'ECONNREFUSED');
      assert(!JSON.stringify(fallback.warnings).includes('test-password'));
    }
  }
  console.log('PASS: Egg registers Template; template options/list, initialization, CRUD/import/export and safe fallback diagnostics work. No database connection or writes.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
