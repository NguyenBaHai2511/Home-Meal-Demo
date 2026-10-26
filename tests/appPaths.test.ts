import assert from 'node:assert/strict';
import test from 'node:test';
import { appBasePath, appPath } from '../server/appPaths.js';

test('normalizes the configured public base path', () => {
  assert.equal(appBasePath(), '');
  assert.equal(appBasePath('HomeMeal/'), '/HomeMeal');
  assert.equal(appBasePath('https://home-meal-liart.vercel.app/'), '');
  assert.equal(appBasePath('///'), '');
  assert.equal(appBasePath('/'), '');
});

test('builds application routes under the configured base path', () => {
  assert.equal(appPath('/verify-email', '/HomeMeal'), '/HomeMeal/verify-email');
  assert.equal(appPath('/api', '/HomeMeal'), '/HomeMeal/api');
  assert.equal(appPath('/api', ''), '/api');
});

test('rejects query strings and fragments in the configured base path', () => {
  assert.throws(() => appBasePath('/HomeMeal?next=/login'), /APP_BASE_PATH/);
  assert.throws(() => appBasePath('/HomeMeal#section'), /APP_BASE_PATH/);
  assert.throws(() => appBasePath('/../HomeMeal'), /APP_BASE_PATH/);
});
