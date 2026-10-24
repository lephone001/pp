'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const { withLock, withUpdateQueue, publish } = require('../app/lib/advFileStore');

async function main() {
  if (process.argv[2]) {
    const directory = process.argv[2];
    for (let i = 0; i < 8; i++) {
      await withLock(directory, async () => {
        const count = Number(await fs.promises.readFile(path.join(directory, 'count'), 'utf8'));
        await new Promise(resolve => setTimeout(resolve, 5));
        await publish(directory, { count: String(count + 1), mirror: String(count + 1) });
      });
    }
    return;
  }
  const directory = fs.mkdtempSync(path.join(__dirname, '.adv-lock-test-'));
  try {
    fs.writeFileSync(path.join(directory, 'count'), '0');
    await Promise.all(Array.from({ length: 4 }, () => new Promise((resolve, reject) => {
      const child = fork(__filename, [ directory ], { stdio: 'inherit' });
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve() : reject(new Error('worker failed: ' + code)));
    })));
    assert.strictEqual(fs.readFileSync(path.join(directory, 'count'), 'utf8'), '32');
    assert.strictEqual(fs.readFileSync(path.join(directory, 'mirror'), 'utf8'), '32');

    fs.writeFileSync(path.join(directory, '.adv-update.lock'), JSON.stringify({
      pid: 2147483647,
      started: new Date(0).toISOString(),
    }));
    await withLock(directory, async () => publish(directory, { count: '33', mirror: '33' }));
    assert.strictEqual(fs.readFileSync(path.join(directory, 'count'), 'utf8'), '33');
    assert.strictEqual(fs.existsSync(path.join(directory, '.adv-update.lock')), false);

    const rename = fs.promises.rename;
    let calls = 0;
    fs.promises.rename = async (...args) => {
      if (++calls === 2) throw new Error('simulated publish failure');
      return rename(...args);
    };
    try {
      await assert.rejects(() => withLock(directory, () => publish(directory, { count: 'bad', mirror: 'bad' })), /simulated publish failure/);
    } finally { fs.promises.rename = rename; }
    assert.strictEqual(fs.readFileSync(path.join(directory, 'count'), 'utf8'), '33');
    assert.strictEqual(fs.readFileSync(path.join(directory, 'mirror'), 'utf8'), '33');
    assert.deepStrictEqual(fs.readdirSync(directory).sort(), [ 'count', 'mirror' ]);

    await withUpdateQueue(directory, () => {
      assert.strictEqual(fs.existsSync(path.join(directory, '.adv-update.lock')), false);
    });
    // A leftover lock owned by a live process must not block advertising updates.
    const oldLock = path.join(directory, '.adv-update.lock');
    const oldContents = JSON.stringify({ pid: process.pid });
    fs.writeFileSync(oldLock, oldContents);
    const brokenUpdate = withUpdateQueue(directory, () => { throw new Error('update failed'); });
    const updates = Array.from({ length: 8 }, () => withUpdateQueue(directory, async () => {
      const count = Number(await fs.promises.readFile(path.join(directory, 'count'), 'utf8'));
      await new Promise(resolve => setTimeout(resolve, 5));
      await publish(directory, { count: String(count + 1), mirror: String(count + 1) });
    }));
    await Promise.all([ assert.rejects(() => brokenUpdate, /update failed/), ...updates ]);
    assert.strictEqual(fs.readFileSync(path.join(directory, 'count'), 'utf8'), '41');
    assert.strictEqual(fs.readFileSync(path.join(directory, 'mirror'), 'utf8'), '41');
    assert.strictEqual(fs.readFileSync(oldLock, 'utf8'), oldContents);
    fs.unlinkSync(oldLock);
    await withUpdateQueue(directory, () => publish(directory, { count: '42', mirror: '42' }));
    assert.deepStrictEqual(fs.readdirSync(directory).sort(), [ 'count', 'mirror' ]);
    console.log('PASS: file locks, rollback, disk-free update queue, failure recovery and ignored leftover lock.');
  } finally {
    assert.strictEqual(path.dirname(fs.realpathSync(directory)), fs.realpathSync(__dirname));
    fs.rmdirSync(directory, { recursive: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
