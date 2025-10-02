import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyItemsBatched,
  translateItemsBatched,
  MAX_CLASSIFICATION_BATCH_SIZE,
  MAX_TRANSLATION_BATCH_SIZE
} from './openai.js';

function buildItems(count) {
  return Array.from({ length: count }, (_, idx) => ({
    url: `https://example.com/${idx}`,
    title_zh: `标题${idx}`,
    dek_zh: `副标题${idx}`,
    section_hint: idx % 2 === 0 ? 'politics' : 'business'
  }));
}

test('classifyItemsBatched splits items and merges responses in order', async () => {
  const items = buildItems(5);
  const singleBatchFn = mock.fn(async (_model, chunk) => ({
    items: chunk.map(it => ({
      url: it.url,
      category: 'society',
      confidence: 0.5
    }))
  }));

  const result = await classifyItemsBatched('gpt-test', items, { batchSize: 2, singleBatchFn });

  assert.equal(singleBatchFn.mock.callCount(), 3);
  assert.equal(result.items.length, items.length);
  assert.deepEqual(result.items.map(r => r.url), items.map(it => it.url));
});

test('classifyItemsBatched never exceeds maximum batch size', async () => {
  const items = buildItems(MAX_CLASSIFICATION_BATCH_SIZE + 5);
  const singleBatchFn = mock.fn(async (_model, chunk) => {
    assert.ok(chunk.length <= MAX_CLASSIFICATION_BATCH_SIZE);
    return {
      items: chunk.map(it => ({ url: it.url, category: 'society', confidence: 0.4 }))
    };
  });

  const result = await classifyItemsBatched('gpt-test', items, { batchSize: MAX_CLASSIFICATION_BATCH_SIZE * 5, singleBatchFn });

  assert.equal(result.items.length, items.length);
  assert.ok(singleBatchFn.mock.callCount() >= 2);
});

test('translateItemsBatched splits items and preserves order', async () => {
  const items = buildItems(6);
  const singleBatchFn = mock.fn(async (_model, chunk) => ({
    translations: chunk.map(it => ({
      url: it.url,
      title_en: `Title ${it.url.split('/').pop()}`,
      dek_en: `Dek ${it.url.split('/').pop()}`
    }))
  }));

  const result = await translateItemsBatched('gpt-test', items, { batchSize: 3, singleBatchFn });

  assert.equal(singleBatchFn.mock.callCount(), 2);
  assert.equal(result.translations.length, items.length);
  assert.deepEqual(result.translations.map(r => r.url), items.map(it => it.url));
});

test('translateItemsBatched clamps oversized batch requests', async () => {
  const items = buildItems(MAX_TRANSLATION_BATCH_SIZE + 4);
  const singleBatchFn = mock.fn(async (_model, chunk) => {
    assert.ok(chunk.length <= MAX_TRANSLATION_BATCH_SIZE);
    return {
      translations: chunk.map(it => ({ url: it.url, title_en: 'T', dek_en: 'D' }))
    };
  });

  await translateItemsBatched('gpt-test', items, { batchSize: MAX_TRANSLATION_BATCH_SIZE * 10, singleBatchFn });

  assert.ok(singleBatchFn.mock.callCount() >= 2);
});
