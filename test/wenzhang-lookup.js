'use strict';
const assert = require('assert');
const { pinnedLookup } = require('../app/lib/wenzhangFeed');
const lookup = pinnedLookup([{ address: '8.8.8.8', family: 4 }, { address: '1.1.1.1', family: 4 }]);
lookup('example.test', { all: true }, (error, addresses) => {
  assert.ifError(error);
  assert.deepEqual(addresses, [{ address: '8.8.8.8', family: 4 }, { address: '1.1.1.1', family: 4 }]);
});
lookup('example.test', { all: false }, (error, address, family) => {
  assert.ifError(error); assert.equal(address, '8.8.8.8'); assert.equal(family, 4);
});
console.log('PASS: custom DNS lookup supports single and all-address Node modes');
