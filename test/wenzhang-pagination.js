'use strict';
const assert = require('assert');
const Service = require('../app/service/wenzhang');
const id = n => n.toString(16).padStart(24, '0');
let data = Array.from({ length: 45 }, (_, i) => ({ _id: id(i + 1), status: 1, categoryId: id(100) }));
const match = (row, filter) => row.status === filter.status && (!filter.categoryId || row.categoryId === filter.categoryId) &&
  (!filter._id || (filter._id.$gt ? row._id > filter._id.$gt : row._id < filter._id.$lt));
const service = Object.create(Service.prototype);
const singleQuery = (filter, value) => {
  let order = -1;
  return { select() { return this; }, sort(sort) { order = sort._id; return this; }, async lean() {
    return data.filter(row => match(row, filter)).sort((a, b) => a._id.localeCompare(b._id) * order)[0] || value || null;
  } };
};
service.ctx = { model: { Wenzhang: {
  find(filter) {
    let order, limit;
    return { select() { return this; }, sort(value) { order = value._id; return this; }, limit(value) { limit = value; return this; },
      async lean() { return data.filter(row => match(row, filter)).sort((a, b) => a._id.localeCompare(b._id) * order).slice(0, limit); } };
  },
  findOne: filter => singleQuery(filter),
  exists: async filter => data.some(row => match(row, filter)),
  countDocuments() { throw new Error('Public pagination must not count all articles'); },
} } };
async function main() {
  const first = await service.publicList();
  assert.equal(first.rows.length, 20); assert(!first.hasPrev); assert(first.hasNext);
  const second = await service.publicList({ id: first.rows[19]._id, direction: 'next' });
  assert.deepEqual(second.rows.map(r => r._id), Array.from({ length: 20 }, (_, i) => id(25 - i)));
  assert(second.hasPrev && second.hasNext);
  const back = await service.publicList({ id: second.rows[0]._id, direction: 'prev' });
  assert.deepEqual(back, first);
  const last = await service.publicList({ id: second.rows[19]._id, direction: 'next' });
  assert.equal(last.rows.length, 5); assert(last.hasPrev); assert(!last.hasNext);
  assert.deepEqual(await service.publicList({ id: last.rows[0]._id, direction: 'prev' }), second);
  assert.equal((await service.publicList({ categoryId: id(101) })).rows.length, 0);
  data = data.filter(r => r._id !== first.rows[19]._id);
  assert.deepEqual(await service.publicList({ id: first.rows[19]._id, direction: 'next' }), second, 'deleted cursor still works');
  await assert.rejects(() => service.publicList({ id: '../bad' }));
  const middle = await service.neighbors(id(23));
  assert.equal(middle.previous._id, id(24));
  assert.equal(middle.next._id, id(22));
  const newest = await service.neighbors(id(45));
  assert.equal(newest.previous, null); assert.equal(newest.next._id, id(44));
  const oldest = await service.neighbors(id(1));
  assert.equal(oldest.previous._id, id(2)); assert.equal(oldest.next, null);
  console.log('PASS: cursor pagination forward/back, boundaries, categories and deleted cursor');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
