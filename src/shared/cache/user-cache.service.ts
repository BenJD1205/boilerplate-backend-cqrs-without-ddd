import { Injectable, Inject } from '@nestjs/common';
import { CacheService } from '@/core/services/cache.service.js';
import { USER_REPOSITORY } from '@/modules/user/interfaces/user.repository.interface.js';
import type { UserRepository } from '@/modules/user/interfaces/user.repository.interface.js';
import type { UserEntity } from '@/modules/user/entities/user.entity.js';

const USER_CACHE_KEY = (userId: string) => `user:${userId}`;
const USER_CACHE_TTL = 3600; // 1 hour

@Injectable()
export class UserCacheService {
  constructor(
    private readonly cache: CacheService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Get user by ID with cache. Only one request loads from DB,
   * others wait for cached result.
   */
  getUserById(userId: string): Promise<UserEntity | null> {
    return this.cache.getOrLoad(
      USER_CACHE_KEY(userId),
      () => this.userRepository.findById(userId),
      USER_CACHE_TTL,
    );
  }

  /**
   * Invalidate user cache
   */
  async invalidateUser(userId: string): Promise<void> {
    await this.cache.delete(USER_CACHE_KEY(userId));
  }

  /**
   * Set user cache (after create/update)
   */
  async cacheUser(
    user: UserEntity,
    ttl: number = USER_CACHE_TTL,
  ): Promise<void> {
    await this.cache.set(USER_CACHE_KEY(user.id), user, ttl);
  }
}
