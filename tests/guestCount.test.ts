import test from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { createOrder } from '../server/orderService.js';
import { SERVER_DISHES } from '../server/catalog.js';
import { calculateLaborFee } from '../src/utils/pricing.js';
import { parseRequest } from '../server/smart-menu/validation.js';
import { createSampleMenus } from '../src/utils/smartMenuSamples.js';
import { smartMealToDraft, type Preferences } from '../shared/smartMenu.js';

const preferences: Preferences = {
  goal: 'healthy', activity: 'moderate', guests: 9, mealsPerDay: 1, days: 1, planCount: 1,
  budget: 1000000, budgetPeriod: 'meal', allergies: [], dislikes: [], diet: 'balanced',
  cuisine: 'vietnamese', maxMinutes: 45, specialNeeds: 'none',
};

test('orders for 10 or more guests are persisted as parties awaiting quotation', async () => {
  for (const guestCount of [3, 4, 5, 9, 10, 11, 100]) {
    for (const serviceType of ['cook_at_home', 'party_at_home']) {
      let savedOrder;
      const client = { query: async (sql: string, values?: unknown[]) => {
        if (sql.startsWith('INSERT INTO orders')) savedOrder = JSON.parse(values![4] as string);
        return { rows: [], rowCount: 0 };
      } } as unknown as PoolClient;
      const order = await createOrder({ id: 'customer-test', name: 'Test', role: 'customer' }, {
        guestCount, serviceType,
        date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        servingTime: '18:00', estimatedGroceryBudget: 1000000,
        items: [{ dish: { id: SERVER_DISHES[0].id }, quantity: 1 }],
      }, client);
      assert.equal(order.serviceType, guestCount >= 10 ? 'party_at_home' : 'cook_at_home');
      assert.equal(order.status, guestCount >= 10 ? 'awaiting_quotation' : 'awaiting_cook');
      assert.equal(order.guestCount, guestCount);
      assert.deepEqual(savedOrder, order);
      if (guestCount < 10) assert.equal(order.totalLaborFee, guestCount <= 4 ? 200000 : 340000);
    }
  }
});

test('party-sized estimates require quotation even with a stale family service type', () => {
  assert.equal(calculateLaborFee(9, [], 'cook_at_home').requiresQuotation, false);
  for (const guests of [10, 11, 100]) {
    const fee = calculateLaborFee(guests, [], 'cook_at_home');
    assert.equal(fee.requiresQuotation, true);
    assert.deepEqual(fee, calculateLaborFee(guests, [], 'party_at_home'));
  }
});

test('smart menus allow nine guests and route saved ten-person meals to parties', () => {
  assert.equal(parseRequest({ action: 'generate', preferences }).preferences.guests, 9);
  const meal = createSampleMenus(preferences).plans[0].days[0].meals[0];
  assert.equal(smartMealToDraft(meal, 9, [], 'sample').serviceType, 'cook_at_home');
  for (const guests of [10, 11]) {
    assert.throws(() => parseRequest({ action: 'generate', preferences: { ...preferences, guests } }));
    assert.throws(() => createSampleMenus({ ...preferences, guests }));
    const draft = smartMealToDraft(meal, guests, [], 'sample');
    assert.equal(draft.serviceType, 'party_at_home');
    assert.equal(draft.guestCount, guests);
  }
});
