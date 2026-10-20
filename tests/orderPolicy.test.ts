import test from 'node:test';
import assert from 'node:assert/strict';
import { canCookTransition, canReadOrder } from '../server/orderPolicy.js';

test('an available cook can claim an unassigned order', () => {
  assert.equal(canCookTransition('awaiting_cook', 'confirmed', false, true), true);
});

test('an order cannot be claimed after another cook is assigned', () => {
  assert.equal(canCookTransition('awaiting_cook', 'confirmed', false, false), false);
});

test('only the assigned cook can advance an order', () => {
  assert.equal(canCookTransition('confirmed', 'shopping_in_progress', true, false), true);
  assert.equal(canCookTransition('confirmed', 'shopping_in_progress', false, false), false);
});

test('cook transitions cannot skip workflow steps', () => {
  assert.equal(canCookTransition('shopping_in_progress', 'preparing_meal', true, false), false);
  assert.equal(canCookTransition('evidence_submitted', 'preparing_meal', true, false), true);
});

test('customers can only read their own orders and cooks only assigned or claimable orders', () => {
  assert.equal(canReadOrder('customer', 'customer-a', 'customer-a', null, 'awaiting_cook'), true);
  assert.equal(canReadOrder('customer', 'customer-b', 'customer-a', null, 'awaiting_cook'), false);
  assert.equal(canReadOrder('cook', 'cook-a', 'customer-a', 'cook-a', 'shopping_in_progress'), true);
  assert.equal(canReadOrder('cook', 'cook-b', 'customer-a', 'cook-a', 'shopping_in_progress'), false);
  assert.equal(canReadOrder('cook', 'cook-b', 'customer-a', null, 'awaiting_cook'), true);
  assert.equal(canReadOrder('cook', 'cook-b', 'customer-a', null, 'cancelled'), false);
  assert.equal(canReadOrder('admin', 'admin-a', 'customer-a', 'cook-a', 'paid'), true);
});
