import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesAllowedOrigin } from '../server/originPolicy.js';

test('allows the current site origin and a configured canonical origin', () => {
  const allowed = ['https://preview.example.vercel.app', 'https://www.example.com'];
  assert.equal(matchesAllowedOrigin('https://preview.example.vercel.app', allowed), true);
  assert.equal(matchesAllowedOrigin('https://www.example.com', allowed), true);
});

test('rejects unrelated, malformed, and non-web origins', () => {
  const allowed = ['https://www.example.com'];
  assert.equal(matchesAllowedOrigin('https://attacker.example', allowed), false);
  assert.equal(matchesAllowedOrigin('null', allowed), false);
  assert.equal(matchesAllowedOrigin('javascript://www.example.com', allowed), false);
});
