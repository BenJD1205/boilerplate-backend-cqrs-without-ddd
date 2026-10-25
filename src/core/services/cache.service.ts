import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../infrastructure/cache/redis.module.js';

const LOCK_KEY = (key: string) => `lock:${key}`;
const LOCK_TTL_MS = 10000;
const POLL_INTERVAL_MS = 50;
const MAX_WAIT_MS = 30000;

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Get from cache or load if missing. Only one request loads from provider,
   * others wait for cached result.
   */
  async getOrLoad<T>(
    key: string,
    provider: () => Promise<T>,
    ttlSeconds: number,
  ): Promise<T> {
    const cached = await this.redis.getex(key, 'EX', ttlSeconds);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    const lockKey = LOCK_KEY(key);
    const lockValue = this.generateLockId();

    const acquiredLock = await this.acquireLock(lockKey, lockValue);
    if (acquiredLock) {
      try {
        const cachedAgain = await this.redis.get(key);
        if (cachedAgain) {
          return JSON.parse(cachedAgain) as T;
        }

        const data = await provider();
        await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
        return data;
      } finally {
        await this.releaseLock(lockKey, lockValue);
      }
    }

    return this.waitForCache<T>(key, lockKey);
  }

  /**
   * Set cache with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
  }

  /**
   * Get from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? (JSON.parse(cached) as T) : null;
  }

  /**
   * Delete cache
   */
  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Delete multiple cache keys
   */
  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Get all keys matching pattern
   */
  async getKeys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  /**
   * Delete all keys matching pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.getKeys(pattern);
    await this.deleteMany(keys);
  }

  private async acquireLock(
    lockKey: string,
    lockValue: string,
  ): Promise<boolean> {
    const result = await this.redis.set(
      lockKey,
      lockValue,
      'PX',
      LOCK_TTL_MS,
      'NX',
    );
    return result === 'OK';
  }

  private async releaseLock(lockKey: string, lockValue: string): Promise<void> {
    const stored = await this.redis.get(lockKey);
    if (stored === lockValue) {
      await this.redis.del(lockKey);
    }
  }

  private async waitForCache<T>(key: string, lockKey: string): Promise<T> {
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_WAIT_MS) {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }

      const lockExists = await this.redis.exists(lockKey);
      if (lockExists === 0) {
        const retryCache = await this.redis.get(key);
        if (retryCache) {
          return JSON.parse(retryCache) as T;
        }
      }

      await this.sleep(POLL_INTERVAL_MS);
    }

    this.logger.warn(
      `Cache wait timeout for key: ${key}. Max wait: ${MAX_WAIT_MS}ms`,
    );
    throw new Error(`Cache not available after ${MAX_WAIT_MS}ms: ${key}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateLockId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
