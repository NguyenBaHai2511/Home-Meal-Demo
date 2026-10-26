import test from 'node:test';
import assert from 'node:assert/strict';
import { isDatabaseSchemaError } from '../server/dbErrors.js';

test('recognizes PostgreSQL errors that indicate unapplied or incomplete schema', () => {
  for (const code of ['42P01', '42703', '42704', '3F000']) {
    assert.equal(isDatabaseSchemaError({ code }), true);
  }
});

test('does not classify unrelated or malformed errors as schema failures', () => {
  for (const error of [null, {}, { code: '23505' }, { code: 503 }]) {
    assert.equal(isDatabaseSchemaError(error), false);
  }
});
