import test from 'node:test';
import assert from 'node:assert/strict';

import { searchWeatherCity } from '../src/services/weatherService.js';

test('weather city search maps a place name to coordinates', async () => {
  let requestedUrl = '';
  const result = await searchWeatherCity('杭州', async url => {
    requestedUrl = String(url);
    return {
      ok: true,
      json: async () => ({
        results: [{
          name: '杭州市',
          admin1: '浙江省',
          latitude: 30.2741,
          longitude: 120.1551
        }]
      })
    };
  });

  assert.match(requestedUrl, /language=zh/);
  assert.deepEqual(result, {
    city: '杭州市 · 浙江省',
    latitude: 30.2741,
    longitude: 120.1551
  });
});

test('weather city search reports missing results in Chinese', async () => {
  await assert.rejects(
    () => searchWeatherCity('不存在的地方', async () => ({
      ok: true,
      json: async () => ({ results: [] })
    })),
    /没有找到这个城市/
  );
});
