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

async function closeApp(app) {
  if (!app) return;
  try {
    await app.close();
  } catch (err) {
    console.error('[articleCompanyImport] close app failed', err);
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
  try {
    await app.ready();
    const ctx = app.createAnonymousContext();
    service = ctx.service.articleComapany;

    const row = await service.articleCompanyModel.findById(id).lean();
    if (!row) {
      throw new Error(`article company not found: ${id}`);
    }

    const ArticleCbdModel = ctx.model.ArticleCbd || ctx.model.ArticleCBD || ctx.model.articleCbd;
    if (!ArticleCbdModel) {
      throw new Error('articleCbd model not found');
    }

    const cacheInfo = service.getArticleCompanyCacheDir(row);
    cacheDir = cacheInfo.cacheDir;
    if (!cacheDir) {
      throw new Error('fileName is required');
    }

    await service.importArticleCompanyCbdFromCache({
      row,
      ArticleCbdModel,
      cacheDir,
      batchSize: Math.max(Number(argv.batchSize) || 1000, 1),
      clearExisting: argv.clearExisting === true || argv.clearExisting === 'true',
    });

    await closeApp(app);
  } catch (err) {
    if (service && cacheDir) {
      await service.writeArticleCompanyImportError(cacheDir, err, {
        articleCompanyId: String(id),
        cacheDir,
      });
    }
    await closeApp(app);
    throw err;
  }
}

main().catch(err => {
  console.error('[articleCompanyImport] failed', err);
  process.exit(1);
});
