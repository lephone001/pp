'use strict';

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

function directory(app) { return path.join(app.baseDir, 'app/local_data/collect_schedule'); }
async function read(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return fallback;
    throw error;
  }
}
async function write(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = file + '.' + crypto.randomBytes(12).toString('hex') + '.tmp';
  try {
    await fs.writeFile(temp, JSON.stringify(value));
    await fs.rename(temp, file);
  } finally { await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
async function invalidate(app) {
  await write(path.join(directory(app), 'revision.json'), crypto.randomBytes(16).toString('hex'));
}
async function sources(ctx, now = new Date()) {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.MOVIE_COLLECT_TIMEZONE || 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const dir = directory(ctx.app);
  const revisionPath = path.join(dir, 'revision.json');
  const revision = await read(revisionPath, 'initial');
  const cached = await read(path.join(dir, 'sources.json'), null);
  if (cached && cached.revision === revision && cached.date === date && Array.isArray(cached.sources)) return cached.sources;
  const model = ctx.model.CollectSource;
  if (!model.db || model.db.readyState !== 1) return null;
  // Shared claim: even rotating Egg workers query only once per day/revision.
  // Keep the claim on failure too, so a timeout does not turn into minute polling.
  const claimId = crypto.createHash('sha256').update(date + ':' + revision).digest('hex');
  const claims = path.join(dir, 'checks');
  await fs.mkdir(claims, { recursive: true });
  try {
    const handle = await fs.open(path.join(claims, claimId + '.json'), 'wx');
    try { await handle.writeFile(JSON.stringify({ date, revision })); }
    finally { await handle.close(); }
  } catch (error) {
    if (error.code === 'EEXIST') return null;
    throw error;
  }
  const rows = await model.find({ siteType: { $in: [ 8, 11 ] }, status: 1, scheduleEnabled: 1 })
    .select('_id name siteType scheduleTime schedulePages').lean();
  // Concurrent edits cannot make an old snapshot valid for a new revision.
  if (await read(revisionPath, 'initial') !== revision) return null;
  await write(path.join(dir, 'sources.json'), { revision, date, sources: rows });
  return rows;
}
module.exports = { invalidate, sources };
