# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## 5. CQRS Pattern Guidelines

**Commands, Queries, and Handlers drive all business logic.**

Command/Query structure:
- **Commands** (write operations): Extend `Command<T>` where T is return type. Keep constructor simple with only required data.
- **Handlers**: One `@CommandHandler` / `@QueryHandler` per Command/Query. Implement business logic, validation, and repository calls.
- **Queries** (read operations): Extend `Query<T>`. Use for data retrieval without side effects.

Do NOT:
- Put logic in controllers—delegate to handlers via `queryBus.execute()` or `commandBus.execute()`.
- Create handlers without corresponding Command/Query classes.
- Mix read and write logic in a single handler.

Example:
```typescript
// Command
export class CreateUserCommand extends Command<UserEntity> {
  constructor(public readonly name: string, public readonly email: string) {
    super();
  }
}

// Handler
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  async execute(command: CreateUserCommand): Promise<UserEntity> {
    // Validation, business logic, repository calls
  }
}
```

## 6. Module Organization

**Each feature is a module with clear boundaries.**

Standard module structure:
```
modules/feature-name/
├── commands/
│   ├── impl/
│   └── handlers/
├── queries/
│   ├── impl/
│   └── handlers/
├── repositories/
├── entities/
├── interfaces/
├── dtos/
├── feature.controller.ts
└── feature.module.ts
```

Module providers:
- Register all Command/Query handlers in the module.
- Use dependency injection via `@Inject()` for repositories.
- Export repository interfaces, not implementations.
- Import `CqrsModule` in feature modules that use commands/queries.

## 7. Database and Repository Patterns

**TypeORM repositories are interfaces, implementations use BaseTypeormRepository.**

Repository interface:
- Define in `interfaces/repo.interface.ts`.
- Use constants for provider tokens (e.g., `export const USER_REPOSITORY = 'USER_REPOSITORY'`).

Repository implementation:
- Extend `BaseTypeormRepository<Entity>` in `repositories/` directory.
- Use generic methods (`save()`, `find()`, `delete()`) for standard CRUD.
- Add custom query methods as needed.

Module registration:
```typescript
providers: [
  UserTypeormRepository,
  { provide: USER_REPOSITORY, useExisting: UserTypeormRepository },
],
exports: [USER_REPOSITORY],
```

## 8. DTO and Entity Patterns

**DTOs for API contracts, Entities for database schema.**

DTOs:
- Use `class-validator` decorators (`@IsString()`, `@IsEmail()`, etc.).
- Keep DTOs focused on single use case (create, update, response).
- Use separate response DTOs to control what data is returned.

Entities:
- Extend from a base entity if available.
- Use TypeORM decorators (`@Entity()`, `@Column()`, `@PrimaryGeneratedColumn()`).
- Keep entities focused on data model, not business logic.

## 9. Error Handling

**Use NestJS built-in exceptions. Avoid generic Error.**

Common exceptions:
- `BadRequestException` - Invalid input/validation failed
- `ConflictException` - Resource already exists or constraint violated
- `NotFoundException` - Resource not found
- `UnauthorizedException` - Missing/invalid authentication
- `ForbiddenException` - Authenticated but unauthorized for action
- `InternalServerErrorException` - Unrecoverable errors only

Pattern in handlers:
```typescript
if (condition) {
  throw new ConflictException('User with this email already exists');
}
```

## 10. Testing Conventions

**Tests live alongside source files with .spec.ts suffix. Use vitest.**

Test structure:
- Use `describe()` and `it()` blocks.
- Test commands/queries in handler tests.
- Mock repositories using interfaces (not implementations).
- For controllers, test endpoint contracts only—handlers are tested separately.

Run tests:
```bash
npm run test          # Run once
npm run test:watch   # Watch mode
npm run test:cov     # With coverage
```

E2E tests in `test/` directory use `vitest.config.e2e.ts`.

## 11. API Endpoints and Versioning

**Endpoints use URI versioning with structure `/api/v{VERSION}/resource`.**

Controller patterns:
- Use `@Controller('resource')` for REST paths.
- Handlers inject services/repositories, not business logic.
- Controllers call `this.commandBus.execute()` / `this.queryBus.execute()`.
- Version defaults to neutral unless explicitly set.

Example:
```typescript
@Post()
async createUser(@Body() dto: CreateUserDto) {
  return this.commandBus.execute(new CreateUserCommand(dto.name, dto.email));
}
```

## 12. Configuration and Environment

**Environment-based config loaded via ConfigModule from `env/.env.{NODE_ENV}` files.**

Configuration:
- Use `ConfigService.get()` to read environment variables.
- Define NODE_ENV per deployment: local, development, test, staging, production.
- Critical config: API_PORT, API_GLOBAL_PREFIX, CORS_ORIGIN, database connection.

Build/start commands respect NODE_ENV:
```bash
npm run build:dev      # Loads .env.development
npm run start:dev      # Loads .env.development
npm run build:prod     # Loads .env.production
```

## 13. Caching and Redis Patterns

**CacheService provides "get or load" pattern to prevent cache stampede.**

Cache stampede occurs when multiple requests fetch missing cache simultaneously. Solution:
- Only **first request** acquires lock and fetches from database
- **Other requests** wait with polling until cache is populated
- **All requests** receive cached data after provider completes

Usage:
```typescript
@Injectable()
export class UserCacheService {
  constructor(
    private readonly cache: CacheService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async getUserById(userId: string): Promise<UserEntity | null> {
    return this.cache.getOrLoad(
      `user:${userId}`,
      () => this.userRepository.findById(userId),
      3600, // TTL in seconds
    );
  }

  async invalidateUser(userId: string): Promise<void> {
    await this.cache.delete(`user:${userId}`);
  }
}
```

Common patterns:
- **After create/update**: Call `cache.set()` to pre-populate cache
- **On delete**: Call `cache.delete()` to invalidate
- **Batch operations**: Use `cache.deletePattern()` for pattern-based invalidation

CacheService API:
- `getOrLoad<T>(key, provider, ttlSeconds)` - Get or load with lock
- `get<T>(key)` - Get without provider
- `set<T>(key, value, ttlSeconds)` - Set cache
- `delete(key)` - Delete single key
- `deleteMany(keys)` - Delete multiple keys
- `deletePattern(pattern)` - Delete keys matching glob pattern
- `getKeys(pattern)` - Get all keys matching pattern

## 14. Auth Session Service

**Redis-backed session management with atomic operations.**

AuthSessionService manages user sessions with device tracking:
- Session creation with TTL and refresh token tracking
- User session listing with pagination support
- Token rotation with atomic verification
- User/session revocation with blocking
- Token blacklisting for logout

Key operations use Lua scripts for atomicity to prevent race conditions between operations.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

**Project specifics:** NestJS 12+ with CQRS, TypeORM, vitest, module-first architecture, environment-driven config, Redis cache with stampede prevention.