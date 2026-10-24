'use strict';

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const LOCK_FILE = '.adv-update.lock';
const LOCK_WAIT_MS = 30000;
const LOCK_RETRY_MS = 50;
const INVALID_LOCK_GRACE_MS = 60000;
const updateQueues = new Map();

// Advertising updates deliberately avoid disk locks. Serialization is per worker.
async function withUpdateQueue(directory, action) {
  const key = path.resolve(directory);
  const previous = updateQueues.get(key) || Promise.resolve();
  const pending = previous.then(async () => {
    await fs.mkdir(directory, { recursive: true });
    return action();
  });
  const settled = pending.then(() => {}, () => {});
  updateQueues.set(key, settled);
  try {
    return await pending;
  } finally {
    if (updateQueues.get(key) === settled) updateQueues.delete(key);
  }
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}

async function clearStaleLock(lock) {
  try {
    const [ raw, stat ] = await Promise.all([
      fs.readFile(lock, 'utf8'),
      fs.stat(lock),
    ]);
    let owner;
    try { owner = JSON.parse(raw); } catch (error) { owner = null; }

    const ownerPid = owner && Number(owner.pid);
    const deadOwner = Number.isInteger(ownerPid) && ownerPid > 0 && !processIsAlive(ownerPid);
    const invalidOldLock = (!owner || !Number.isInteger(ownerPid) || ownerPid <= 0)
      && Date.now() - stat.mtimeMs >= INVALID_LOCK_GRACE_MS;
    if (!deadOwner && !invalidOldLock) return false;

    await fs.unlink(lock).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return true;
    return false;
  }
}

// One lock shared by all Egg workers. Dead owners are removed automatically;
// a live writer's lock is never expired by age alone.
async function withLock(directory, action) {
  await fs.mkdir(directory, { recursive: true });
  const lock = path.join(directory, LOCK_FILE);
  const deadline = Date.now() + LOCK_WAIT_MS;
  let handle;
  while (!handle) {
    try {
      handle = await fs.open(lock, 'wx');
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (await clearStaleLock(lock)) continue;
      if (Date.now() >= deadline) throw new Error('更新正在执行，请稍后重试');
      await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_MS));
    }
  }
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid, started: new Date().toISOString() }));
    return await action();
  } finally {
    try {
      await handle.close();
    } finally {
      await fs.unlink(lock).catch(error => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  }
}

// Prepare every file before publishing; rename prevents readers seeing truncated files.
// Caller must serialize writes. Restore previous files if publication fails.
async function publish(directory, files) {
  const token = crypto.randomBytes(12).toString('hex');
  const entries = Object.entries(files).map(([ name, text ]) => ({
    target: path.join(directory, name), temp: path.join(directory, '.' + name + '.' + token), text,
  }));
  const changed = [];
  try {
    for (const entry of entries) {
      try { entry.previous = await fs.readFile(entry.target); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      await fs.writeFile(entry.temp, entry.text, { flag: 'wx' });
    }
    for (const entry of entries) {
      await fs.rename(entry.temp, entry.target);
      changed.push(entry);
    }
  } catch (error) {
    for (const entry of changed.reverse()) {
      if (entry.previous === undefined) await fs.unlink(entry.target);
      else {
        await fs.writeFile(entry.temp, entry.previous);
        await fs.rename(entry.temp, entry.target);
      }
    }
    throw error;
  } finally {
    for (const entry of entries) await fs.unlink(entry.temp).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

module.exports = { withLock, withUpdateQueue, publish };
