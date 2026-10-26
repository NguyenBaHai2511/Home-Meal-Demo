import assert from 'node:assert/strict';
import { test } from 'node:test';
import app from '../api/index.js';

test('Vercel API entry imports without frontend assets', () => {
  assert.equal(typeof app, 'function');
});
