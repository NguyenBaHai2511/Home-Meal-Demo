import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWithOpenAI } from '../server/smart-menu/provider.js';
import { SmartMenuError } from '../server/smart-menu/validation.js';
import { createSampleMenus } from '../src/utils/smartMenuSamples.js';
import type { Preferences } from '../shared/smartMenu.js';

const preferences: Preferences = {
  goal: 'healthy', activity: 'moderate', guests: 3, mealsPerDay: 1, days: 1, planCount: 1,
  budget: 200000, budgetPeriod: 'meal', allergies: [], dislikes: [], diet: 'balanced',
  cuisine: 'vietnamese', maxMinutes: 45, specialNeeds: 'none',
};
const fixture = createSampleMenus(preferences).plans;

test('missing or placeholder OpenAI key is rejected without a network call', async () => {
  const original = process.env.OPENAI_API_KEY;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { assert.fail('must not make request without key'); };
  try {
    for (const key of [undefined, 'YOUR_OPENAI_API_KEY']) {
      if (key === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = key;
      await assert.rejects(() => generateWithOpenAI(preferences), (error: SmartMenuError) => error.code === 'AI_NOT_CONFIGURED' && error.status === 503);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  }
});

test('OpenAI Responses request uses GPT-6 Luna and omits body measurements', async () => {
  const original = process.env.OPENAI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'unit-test-only';
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    assert.equal(new URL(request.url).href, 'https://api.openai.com/v1/responses');
    assert.equal(request.headers.get('authorization'), 'Bearer unit-test-only');
    const payload = await request.json() as { model: string; input: string };
    assert.equal(payload.model, 'gpt-6-luna');
    const sent = JSON.parse(payload.input);
    assert.equal(sent.preferences.height, undefined);
    assert.equal(sent.preferences.weight, undefined);
    return new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ plans: fixture }) }] }] }));
  };
  try {
    const generated = await generateWithOpenAI({ ...preferences, age: 35, height: 165, weight: 60 });
    assert.deepEqual(generated, { plans: fixture });
  } finally {
    globalThis.fetch = originalFetch;
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  }
});

test('invalid key, unavailable model, and quota failures map to actionable safe errors', async () => {
  const original = process.env.OPENAI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'unit-test-only';
  try {
    for (const [status, code] of [[401, 'AI_ACCESS_DENIED'], [404, 'AI_MODEL_UNAVAILABLE'], [429, 'AI_QUOTA_EXCEEDED']] as const) {
      globalThis.fetch = async () => new Response('private provider detail', { status });
      await assert.rejects(() => generateWithOpenAI(preferences), (error: SmartMenuError) => error.code === code && !error.message.includes('private'));
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  }
});
