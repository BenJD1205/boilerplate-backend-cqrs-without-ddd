# Redis Cache Infrastructure

## Overview

Redis-based caching layer with two key components:

1. **CacheService** - Generic cache operations with "get or load" pattern to prevent cache stampede
2. **AuthSessionService** - User session management with atomic Lua operations

## CacheService: Get or Load Pattern

Prevents cache stampede (thundering herd) where multiple concurrent requests fetch the same missing cache.

### How It Works

```
Request 1: Cache miss → Acquires lock → Fetches from DB
Request 2: Cache miss → Waits for lock
Request 3: Cache miss → Waits for lock
...
Request 1: Completes → Saves to cache → Releases lock
Request 2,3,...: Lock released → Get from cache
```

### Mechanism

1. **Lock Acquisition**: First request tries to set lock with `SET key value PX 10000 NX` (atomic, only if not exists)
2. **Provider Call**: Lock holder calls the provider (DB query, API call, etc.)
3. **Cache Population**: Result stored in Redis with TTL
4. **Lock Release**: Lock deleted (with verification to avoid accidental release)
5. **Waiting Requests**: Poll for cache availability with 50ms intervals, max 30 second wait

### Configuration

Tunable constants in `cache.service.ts`:
- `LOCK_TTL_MS` (10000) - Lock expires if holder crashes
- `POLL_INTERVAL_MS` (50) - Check cache availability interval
- `MAX_WAIT_MS` (30000) - Maximum wait before throwing error

## Usage Examples

### Basic Cache Operations

```typescript
@Injectable()
export class UserCacheService {
  constructor(
    private readonly cache: CacheService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  // Get with automatic load and cache
  async getUserById(userId: string): Promise<UserEntity | null> {
    return this.cache.getOrLoad(
      `user:${userId}`,
      () => this.userRepository.findById(userId),
      3600, // 1 hour TTL
    );
  }

  // Invalidate after update
  async updateUser(userId: string, data: UpdateUserDto): Promise<void> {
    const updated = await this.userRepository.update(userId, data);
    await this.cache.delete(`user:${userId}`);
    return updated;
  }

  // Pre-populate cache after create
  async createUser(data: CreateUserDto): Promise<UserEntity> {
    const user = await this.userRepository.create(data);
    await this.cache.set(`user:${user.id}`, user, 3600);
    return user;
  }
}
```

### Pattern-Based Invalidation

```typescript
// Invalidate all user-related caches
await this.cache.deletePattern('user:*');

// Get all keys matching pattern
const userKeys = await this.cache.getKeys('user:*');
```

## AuthSessionService

Redis-backed session storage with features:

- **Session Management**: Create, revoke, list sessions per user
- **Device Tracking**: Device ID, name, platform, last seen
- **Token Lifecycle**: Refresh token rotation, blacklisting
- **User Blocking**: Immediate revocation of all sessions
- **Atomic Operations**: Lua scripts prevent race conditions

Key design:
- Sessions stored as Redis hashes with TTL
- User sessions tracked in sets for bulk operations
- Lua scripts ensure atomicity for critical operations (rotation, revocation)

## Infrastructure Setup

### Module Registration

```typescript
// app.module.ts
import { RedisModule } from '@/core/infrastructure/cache/redis.module.js';

@Module({
  imports: [RedisModule, DatabaseModule, /* ... */],
})
export class AppModule {}
```

### Configuration

Environment variables (`.env.{NODE_ENV}`):
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional
REDIS_USERNAME=optional
```

### Dependency Injection

```typescript
constructor(
  private readonly cache: CacheService,
  private readonly authSession: AuthSessionService,
  @Inject('REDIS_CLIENT') private readonly redis: Redis,
)
```

## Performance Considerations

### Cache Hit Ratio

- Higher TTLs reduce DB load but increase stale data risk
- Typical TTL: 1-24 hours depending on data volatility
- Consider cache warming for critical data

### Lock Timeout

- Default 10 seconds should handle most DB queries
- Adjust `LOCK_TTL_MS` if providers regularly exceed this
- Lock auto-expires to prevent deadlock on crash

### Waiting Requests

- Poll interval 50ms is reasonable for most use cases
- Increase for high-load scenarios to reduce polling overhead
- Max wait 30 seconds prevents indefinite hangs

## Extending CacheService

Create domain-specific cache services following `UserCacheService` pattern:

```typescript
@Injectable()
export class ProductCacheService {
  private readonly CACHE_TTL = 3600;
  
  constructor(
    private readonly cache: CacheService,
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async getById(productId: string): Promise<ProductEntity | null> {
    return this.cache.getOrLoad(
      this.getCacheKey(productId),
      () => this.productRepository.findById(productId),
      this.CACHE_TTL,
    );
  }

  private getCacheKey(productId: string): string {
    return `product:${productId}`;
  }
}
```

## Testing

Tests live in `*.spec.ts` files:

```bash
npm run test                    # Run all tests
npm run test cache.service      # Run specific test
npm run test:watch             # Watch mode
npm run test:cov               # Coverage report
```

Key test patterns:
- Mock provider with `vi.fn()` for controlled behavior
- Test concurrent requests to verify stampede prevention
- Test error handling to ensure cache not populated on failure
- Use real Redis for integration tests

## Maintenance

### Monitoring

- Monitor Redis memory usage (cache growth)
- Track cache hit/miss ratios by key pattern
- Alert on lock timeouts (indicates provider timeout)
- Monitor wait queue depth (concurrent cache misses)

### Cleanup

- Keys auto-expire via Redis TTL
- No manual cleanup needed for normal operations
- Use `deletePattern()` for targeted invalidation during migrations

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Cache stampede | Too many concurrent misses | Increase provider speed or TTL |
| Memory growth | TTLs too high or unused keys | Review TTL strategy, add cleanup |
| Waiting timeouts | Provider too slow | Increase `MAX_WAIT_MS` or `LOCK_TTL_MS` |
| Stale data | TTL too high | Reduce TTL or add event-based invalidation |
