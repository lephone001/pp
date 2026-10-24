'use strict';

const path = require('path');
const { Application } = require('egg');

function parseArgs(argv = []) {
  const result = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;

    const eqIndex = arg.indexOf('=');
    if (eqIndex > -1) {
      result[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      result[key] = next;
      index++;
    } else {
      result[key] = true;
    }
  }
  return result;
}

function parseTemplateIndexes(value) {
  if (!value) return undefined;
  return String(value)
    .split(',')
    .map(item => Number(item.trim()))
    .filter(item => Number.isInteger(item) && item >= 0);
}

function normalizeGenerateMaxRunMs(value) {
  const defaultMs = 10 * 60 * 1000;
  const maxMs = 60 * 60 * 1000;
  const raw = Math.max(Number(value) || defaultMs, 0);
  if (!raw) return 0;
  return Math.min(raw, maxMs);
}

async function closeApp(app) {
  if (!app) return;
  try {
    await app.close();
  } catch (err) {
    console.error('[articleCompanyGenerate] close app failed', err);
  }
}

async function disconnectMongoose(app) {
  const mongoose = app && app.mongoose;
  if (!mongoose) return;

  try {
    if (typeof mongoose.disconnect === 'function') {
      await mongoose.disconnect();
      return;
    }

    if (mongoose.connection && typeof mongoose.connection.close === 'function') {
      await mongoose.connection.close(false);
    }
  } catch (err) {
    console.error('[articleCompanyGenerate] disconnect mongoose failed', err);
  }
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const id = argv.id || argv._id;
  if (!id) {
    throw new Error('id is required');
  }

  const baseDir = path.resolve(__dirname, '..');
  process.chdir(baseDir);

  const app = new Application({
    baseDir,
    mode: 'single',
  });

  let service;
  let cacheDir = '';
  let generateLockPath = '';
  try {
    await app.ready();
    const ctx = app.createAnonymousContext();
    service = ctx.service.articleComapany;
    generateLockPath = service.getArticleCompanyGenerateLockPath();

    const row = await service.articleCompanyModel.findById(id).lean();
    if (!row) {
      throw new Error(`article company not found: ${id}`);
    }

    const tdkList = Array.isArray(row.tdk) ? row.tdk : [];
    const contentList = Array.isArray(row.content) ? row.content : [];
    const templateIndexes = parseTemplateIndexes(argv.templateIndexes);
    const templates = service.getSelectedTemplates(
      Array.isArray(row.templates) ? row.templates : [],
      templateIndexes
    );
    const openContentList = contentList.filter(item => item && item.openzh);
    const openContentDimensions = openContentList
      .filter(item => item && item.field)
      .map(item => ({
        field: item.field,
        values: service.contentValueList(item),
      }))
      .filter(item => item.values.length);

    if (!tdkList.length) throw new Error('tdk is empty');
    if (!contentList.length) throw new Error('content is empty');
    if (!templates.length) throw new Error('templates is empty');

    const baseCacheDir = path.join(process.cwd(), 'cache', 'articlecompany');
    const safeFileName = service.safeDirName(row.fileName);
    cacheDir = safeFileName ? path.join(baseCacheDir, safeFileName) : baseCacheDir;
    const dirCacheName = safeFileName || 'root';
    const writeConcurrency = Math.max(Number(argv.writeConcurrency) || 3, 1);
    const generateDelayMs = Math.max(Number(argv.generateDelayMs) || 0, 0);
    const generateDelayStep = Math.max(Number(argv.generateDelayStep) || 100, 1);
    const generateMaxRunMs = normalizeGenerateMaxRunMs(argv.generateMaxRunMs);

    await disconnectMongoose(app);

    await service.generateArticleCompanyFiles({
      row,
      tdkList,
      templates,
      openContentDimensions,
      contentList,
      cacheDir,
      dirCacheName,
      writeConcurrency,
      generateDelayMs,
      generateDelayStep,
      generateMaxRunMs,
      templateIndexes,
      strictMixedBlock: argv.strictMixedBlock === true || argv.strictMixedBlock === 'true',
    });

  } catch (err) {
    if (service && cacheDir) {
      await service.writeArticleCompanyGenerateError(cacheDir, err, {
        articleCompanyId: String(id),
        cacheDir,
      });
    }
    throw err;
  } finally {
    if (service && generateLockPath) {
      try {
        await service.releaseArticleCompanyGenerateLock(generateLockPath);
      } catch (lockErr) {
        console.error('[articleCompanyGenerate] release lock failed', lockErr);
      }
    }
    await closeApp(app);
  }
}

main().catch(err => {
  console.error('[articleCompanyGenerate] failed', err);
  process.exit(1);
});
