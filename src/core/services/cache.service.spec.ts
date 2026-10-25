import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheService } from '../../services/cache.service.js';
import { RedisService } from './redis.module.js';

describe('CacheService - Get or Load Pattern', () => {
  let cacheService: CacheService;
  let redisService: RedisService;

  beforeEach(() => {
    redisService = new RedisService({
      get: (key: string) => {
        if (key === 'REDIS_HOST') return 'localhost';
        if (key === 'REDIS_PORT') return '6379';
        return undefined;
      },
    } as any);
    cacheService = new CacheService(redisService);
  });

  afterEach(async () => {
    await redisService.flushdb();
    redisService.disconnect();
  });

  it('should return cached value if exists', async () => {
    const key = 'test:user:1';
    const cached = { id: '1', name: 'John' };

    await cacheService.set(key, cached, 10);
    const result = await cacheService.get(key);

    expect(result).toEqual(cached);
  });

  it('should load from provider if cache miss', async () => {
    const key = 'test:user:2';
    const data = { id: '2', name: 'Jane' };
    const provider = vi.fn().mockResolvedValue(data);

    const result = await cacheService.getOrLoad(key, provider, 10);

    expect(result).toEqual(data);
    expect(provider).toHaveBeenCalledOnce();
  });

  it('should cache result from provider', async () => {
    const key = 'test:user:3';
    const data = { id: '3', name: 'Bob' };
    const provider = vi.fn().mockResolvedValue(data);

    await cacheService.getOrLoad(key, provider, 10);
    const cached = await cacheService.get(key);

    expect(cached).toEqual(data);
  });

  it('should prevent cache stampede with concurrent requests', async () => {
    const key = 'test:user:4';
    const data = { id: '4', name: 'Alice' };
    let providerCalls = 0;
    const provider = vi.fn(async () => {
      providerCalls++;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return data;
    });

    const promises = Array.from({ length: 5 }, () =>
      cacheService.getOrLoad(key, provider, 10),
    );
    const results = await Promise.all(promises);

    expect(results).toEqual([data, data, data, data, data]);
    expect(providerCalls).toBe(1);
  });

  it('should delete cache key', async () => {
    const key = 'test:user:5';
    const data = { id: '5', name: 'Charlie' };

    await cacheService.set(key, data, 10);
    await cacheService.delete(key);
    const result = await cacheService.get(key);

    expect(result).toBeNull();
  });

  it('should delete multiple cache keys', async () => {
    const keys = ['test:a', 'test:b', 'test:c'];

    await Promise.all(keys.map((k) => cacheService.set(k, { id: k }, 10)));
    await cacheService.deleteMany(keys);
    const results = await Promise.all(keys.map((k) => cacheService.get(k)));

    expect(results).toEqual([null, null, null]);
  });

  it('should delete keys matching pattern', async () => {
    await cacheService.set('user:1', { id: '1' }, 10);
    await cacheService.set('user:2', { id: '2' }, 10);
    await cacheService.set('post:1', { id: '1' }, 10);

    await cacheService.deletePattern('user:*');
    const userKeys = await cacheService.getKeys('user:*');
    const postKeys = await cacheService.getKeys('post:*');

    expect(userKeys).toHaveLength(0);
    expect(postKeys).toHaveLength(1);
  });

  it('should handle provider errors gracefully', async () => {
    const key = 'test:error';
    const error = new Error('Provider failed');
    const provider = vi.fn().mockRejectedValue(error);

    await expect(cacheService.getOrLoad(key, provider, 10)).rejects.toThrow(
      'Provider failed',
    );
  });

  it('should not cache if provider throws', async () => {
    const key = 'test:error:2';
    const provider = vi
      .fn()
      .mockRejectedValueOnce(new Error('Temp failure'))
      .mockResolvedValueOnce({ id: '6', name: 'David' });

    await expect(cacheService.getOrLoad(key, provider, 10)).rejects.toThrow();

    const result = await cacheService.getOrLoad(key, provider, 10);
    expect(result).toEqual({ id: '6', name: 'David' });
  });
});
