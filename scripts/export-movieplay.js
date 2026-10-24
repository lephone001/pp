'use strict';

// Read only from local MongoDB. Replace the URL library after staging and validation;
// keep the complete previous directory in backups so it can be restored.
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const { normalizeVideoUrl } = require('../app/utils/moviePlayback');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'app/common_data/Article/data/movieplay');
const backups = path.join(root, 'backups');
const FILE_COUNT = 10;
const LINES_PER_FILE = 1000;

function assertInside(parent, child) {
  const relative = path.relative(parent, child);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('Export path is outside the intended workspace');
  }
}

async function main() {
  const repoReal = await fs.realpath(root);
  assertInside(repoReal, await fs.realpath(path.dirname(target)));
  let previousExists = false;
  try {
    const stat = await fs.lstat(target);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('movieplay must be a normal directory');
    assertInside(repoReal, await fs.realpath(target));
    previousExists = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await fs.mkdir(backups, { recursive: true });
  const backupReal = await fs.realpath(backups);
  assertInside(repoReal, backupReal);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid;
  const stage = await fs.mkdtemp(path.join(backupReal, 'movieplay-stage-'));
  const backup = path.join(backupReal, 'movieplay-' + stamp);
  assertInside(backupReal, stage);
  assertInside(backupReal, backup);

  const client = await MongoClient.connect('mongodb://127.0.0.1:27017', {
    useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 5000,
  });
  const seen = new Set();
  const hash = crypto.createHash('sha256');
  const files = [];
  let examined = 0;
  let invalid = 0;
  let duplicates = 0;
  let lines = [];
  try {
    const cursor = client.db('seo-smart').collection('video_video')
      .find({ video: { $type: 'string' } }).project({ _id: 1, video: 1 })
      .sort({ _id: -1 }).batchSize(1000);
    try {
      while (seen.size < FILE_COUNT * LINES_PER_FILE && await cursor.hasNext()) {
        const row = await cursor.next();
        examined++;
        const link = normalizeVideoUrl(row.video);
        if (!link) { invalid++; continue; }
        if (seen.has(link)) { duplicates++; continue; }
        seen.add(link);
        lines.push(link);
        hash.update(link + '\n');
        if (lines.length === LINES_PER_FILE) {
          const name = 'link' + (files.length + 1) + '.txt';
          await fs.writeFile(path.join(stage, name), lines.join('\r\n') + '\r\n', 'utf8');
          files.push({ name, lines: lines.length });
          lines = [];
        }
      }
    } finally {
      await cursor.close();
    }
  } finally {
    await client.close();
  }
  if (files.length !== FILE_COUNT || seen.size !== FILE_COUNT * LINES_PER_FILE) {
    throw new Error('Not enough valid video URLs; existing movieplay directory was kept');
  }
  const digest = hash.digest('hex');
  const checkHash = crypto.createHash('sha256');
  for (const file of files) {
    const rows = (await fs.readFile(path.join(stage, file.name), 'utf8')).split(/\r?\n/).filter(Boolean);
    if (rows.length !== LINES_PER_FILE) throw new Error('Export line count mismatch');
    rows.forEach(link => checkHash.update(link + '\n'));
  }
  if (checkHash.digest('hex') !== digest) throw new Error('Export checksum mismatch');

  if (previousExists) await fs.rename(target, backup);
  try {
    await fs.rename(stage, target);
  } catch (error) {
    if (previousExists) await fs.rename(backup, target);
    throw error;
  }
  const report = {
    source: 'mongodb://127.0.0.1:27017/seo-smart.video_video', field: 'video', sort: { _id: -1 },
    exportedAt: new Date().toISOString(), count: seen.size, examined, invalid, duplicates, files, sha256: digest,
    previousDirectory: previousExists ? backup : null,
  };
  await fs.writeFile(path.join(backupReal, 'movieplay-export-' + stamp + '.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error.name + ': ' + error.message); process.exitCode = 1; });
