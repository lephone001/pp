'use strict';

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { setDomainHostList } = require('../lib/domainHostCache');

const LOCK_WAIT_MS = 30000;
const LOCK_STALE_MS = 5 * 60 * 1000;

async function removeFile(filename) {
  try {
    await fs.unlink(filename);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function acquireLock(filename) {
  const startedAt = Date.now();
  while (true) {
    try {
      return await fs.open(filename, 'wx');
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const stat = await fs.stat(filename);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          await removeFile(filename);
          continue;
        }
      } catch (statError) {
        if (statError.code === 'ENOENT') continue;
        throw statError;
      }
      if (Date.now() - startedAt >= LOCK_WAIT_MS) {
        throw new Error('域名清单正在更新，请稍后重试');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

async function updateDomainListFile(model, baseDir) {
  const filename = path.join(baseDir, 'app', 'local_data', 'allDomainList.txt');
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const lockPath = filename + '.lock';
  const lock = await acquireLock(lockPath);
  const tempPath = filename + '.tmp-' + process.pid + '-' + crypto.randomBytes(6).toString('hex');
  try {
    // 在锁内读取，避免多进程把较早的数据库快照覆盖到新清单上。
    const rows = await model.find({}).select('link -_id').sort({ link: 1 }).lean();
    const links = rows.map(item => typeof item.link === 'string' ? item.link.trim() : '').filter(Boolean);
    const content = links.length ? links.join('\n') + '\n' : '';
    await fs.writeFile(tempPath, content, 'utf8');
    await fs.rename(tempPath, filename);
    setDomainHostList(baseDir, content);
    return links.length;
  } finally {
    try {
      await removeFile(tempPath);
    } finally {
      await lock.close();
      await removeFile(lockPath);
    }
  }
}

module.exports = { updateDomainListFile };
