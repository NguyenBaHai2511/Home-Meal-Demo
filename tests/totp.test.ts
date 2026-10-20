import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTotp } from '../server/totp.js';

test('TOTP accepts the RFC 6238 six digit code for the current time step', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(verifyTotp(secret, '287082', 59_000), true);
});

test('TOTP rejects invalid or malformed codes', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(verifyTotp(secret, '000000', 59_000), false);
  assert.equal(verifyTotp(secret, '12x456', 59_000), false);
});
