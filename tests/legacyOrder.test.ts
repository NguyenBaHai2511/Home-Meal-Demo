import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLegacyOrder, readLegacyOrders } from '../src/utils/normalizeLegacyOrder.js';

const legacy = {
  id: 'order-1', orderCode: 'HM-1', status: 'awaiting_cook', statusHistory: [], items: [], deliveryFee: 50000,
};

test('legacy snapshots can be read while retired delivery fee is excluded', () => {
  const order = normalizeLegacyOrder(legacy);
  assert.ok(order);
  assert.equal('deliveryFee' in order, false);
  assert.equal(order.id, 'order-1');
});

test('malformed and non-order localStorage entries are ignored safely', () => {
  assert.equal(normalizeLegacyOrder({ ...legacy, statusHistory: 'invalid' }), null);
  assert.deepEqual(readLegacyOrders('{broken'), []);
  assert.deepEqual(readLegacyOrders(JSON.stringify([legacy, null, { id: 'x' }] )).map((order) => order.id), ['order-1']);
});
