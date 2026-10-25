# Boilerplate Backend CQRS

NestJS 12+ backend với CQRS pattern, TypeORM, Redis caching, và session management. Tối ưu cho scalability và maintainability.

## Tóm tắt

- **Framework**: NestJS 12 với CQRS
- **Database**: PostgreSQL + TypeORM
- **Cache**: Redis với "get or load" pattern (prevent cache stampede)
- **Session**: Redis-backed authentication sessions
- **Testing**: Vitest + supertest
- **Linting**: oxlint + prettier
- **Observability**: NestJS Observe (optional)

## Cài đặt

```bash
yarn install
```

## Cấu hình môi trường

Tạo file `.env.{NODE_ENV}` trong thư mục `env/`:

```bash
# .env.development
NODE_ENV=development
API_PORT=3000
API_GLOBAL_PREFIX=api
CORS_ORIGIN=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_DATABASE=boilerplate

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_USERNAME=

# Observability (optional)
OBSERVE_APP_KEY=YOUR_APP_KEY
OBSERVE_APP_SECRET=YOUR_APP_SECRET
```

Chạy ứng dụng:

```bash
# Development (auto-reload)
yarn start:dev

# Production
yarn build:prod
yarn start:prod

# Local
yarn start:local
```

## Cấu trúc dự án

```text
src/
├── main.ts                          # Entry point
├── app.module.ts                    # Root module
├── app.controller.ts                # Health check endpoint
├── app.service.ts
│
├── core/
│   ├── config/                      # Environment configuration
│   │   ├── production.config.ts
│   │   └── runtime-role.config.ts
│   ├── infrastructure/              # Technical infrastructure
│   │   ├── cache/
│   │   │   ├── cache.service.ts     # Cache service (get or load pattern)
│   │   │   ├── cache.service.spec.ts
│   │   │   ├── redis.module.ts      # Redis module & AuthSessionService
│   │   │   └── README.md
│   │   ├── database/
│   │   │   └── database.module.ts   # TypeORM configuration
│   │   └── logging/
│   │       └── logger-typeorm.ts
│   ├── http/
│   │   ├── interceptors/            # Global interceptors
│   │   │   ├── errors.interceptor.ts
│   │   │   ├── timeout.interceptor.ts
│   │   │   └── transform.interceptor.ts
│   │   ├── middlewares/             # Global middlewares
│   │   │   ├── logger.middleware.ts
│   │   │   └── request-id.middleware.ts
│   │   └── filters/
│   │       └── http-exeception.filter.ts
│   └── services/
│       └── auth-session.service.ts  # Redis session management
│
├── modules/                         # Feature modules (CQRS)
│   ├── user/
│   │   ├── user.module.ts
│   │   ├── user.controller.ts
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   ├── dtos/
│   │   │   ├── create-user.dto.ts
│   │   │   └── user-response.dto.ts
│   │   ├── commands/
│   │   │   ├── impl/
│   │   │   │   └── create-user.command.ts
│   │   │   └── handlers/
│   │   │       └── create-user.handler.ts
│   │   ├── queries/
│   │   │   ├── impl/
│   │   │   │   ├── get-user-by-id.query.ts
│   │   │   │   └── list-users.query.ts
│   │   │   └── handlers/
│   │   │       ├── get-user-by-id.handler.ts
│   │   │       └── list-users.handler.ts
│   │   ├── repositories/
│   │   │   └── user.typeorm.repository.ts
│   │   └── interfaces/
│   │       └── user.repository.interface.ts
│   └── auth/                        # Authentication module (example structure)
│       ├── auth.module.ts
│       ├── auth.controller.ts
│       └── ...
│
└── shared/                          # Shared utilities
    ├── dto/
    │   ├── base.dto.ts
    │   └── paginate.dto.ts
    ├── decorators/
    │   ├── customize.decorator.ts
    │   ├── user.decorator.ts
    │   ├── roles.decorator.ts
    │   ├── response-message.decorator.ts
    │   ├── idempotence.decorator.ts
    │   └── index.ts
    ├── enum/
    │   ├── environment.enum.ts
    │   └── role.enum.ts
    ├── pipe/
    │   ├── pagination-bounds.pipe.ts
    │   └── index.ts
    ├── repository/
    │   └── base-typeorm.repository.ts
    └── cache/
        └── user-cache.service.ts    # Example cache service
```

## Architecture Pattern

### CQRS (Command Query Responsibility Segregation)

Tách write (Commands) và read (Queries):

```typescript
// Command - Write operation
export class CreateUserCommand extends Command<UserEntity> {
  constructor(
    public readonly name: string,
    public readonly email: string,
  ) {
    super();
  }
}

// Handler - Execute command
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  async execute(command: CreateUserCommand): Promise<UserEntity> {
    // Business logic, validation, repository calls
  }
}

// Query - Read operation
export class GetUserByIdQuery extends Query<UserEntity | null> {
  constructor(public readonly userId: string) {
    super();
  }
}

// Handler - Execute query
@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery> {
  async execute(query: GetUserByIdQuery): Promise<UserEntity | null> {
    // Only read operations
  }
}

// Controller - Dispatch commands/queries
@Controller('users')
export class UserController {
  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    return this.commandBus.execute(
      new CreateUserCommand(dto.name, dto.email),
    );
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.queryBus.execute(new GetUserByIdQuery(id));
  }
}
```

### Module Organization

Mỗi feature là một module với biên giới rõ ràng:

```typescript
@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([UserEntity])],
  controllers: [UserController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    UserTypeormRepository,
    { provide: USER_REPOSITORY, useExisting: UserTypeormRepository },
  ],
  exports: [USER_REPOSITORY],
})
export class UserModule {}
```

### Caching with "Get or Load" Pattern

Prevent cache stampede - chỉ 1 request fetch DB, rest chờ cache:

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
      3600, // 1 hour TTL
    );
  }

  async invalidateUser(userId: string): Promise<void> {
    await this.cache.delete(`user:${userId}`);
  }
}
```

### Database & Repository Pattern

TypeORM repositories with interface abstraction:

```typescript
// Repository interface
export const USER_REPOSITORY = 'USER_REPOSITORY';
export interface UserRepository {
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  createUser(data: CreateUserInput): Promise<UserEntity>;
  save(user: UserEntity): Promise<UserEntity>;
}

// Repository implementation
@Injectable()
export class UserTypeormRepository
  extends BaseTypeormRepository<UserEntity>
  implements UserRepository
{
  constructor(
    @InjectRepository(UserEntity, databaseDataSourceName)
    private readonly repo: Repository<UserEntity>,
  ) {
    super(repo);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { email } });
  }

  // ... other methods
}
```

## API Documentation

### User Endpoints

```bash
# Create user
POST /api/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}

# Get user by ID
GET /api/users/:id

# List users with pagination
GET /api/users?skip=0&take=10
```

## Database Migrations

```bash
# Create migration
npm run migration:create

# Run migrations (dev environment)
npm run migration:run:dev

# Revert last migration
npm run migration:revert:dev

# Seed data (example)
npm run seed:plans:dev
```

## Testing

```bash
# Unit & integration tests
yarn test              # Run once
yarn test:watch       # Watch mode
yarn test:cov         # With coverage

# E2E tests
yarn test:e2e

# Run specific test
yarn test cache.service
```

Test structure:

```typescript
describe('UserHandler', () => {
  let handler: CreateUserHandler;
  let repository: MockedUserRepository;

  beforeEach(() => {
    // Setup
  });

  it('should create user with valid input', async () => {
    const command = new CreateUserCommand('John', 'john@example.com');
    const result = await handler.execute(command);
    expect(result.email).toBe('john@example.com');
  });

  it('should throw ConflictException if email exists', async () => {
    const command = new CreateUserCommand('Jane', 'jane@example.com');
    await expect(handler.execute(command)).rejects.toThrow(
      ConflictException,
    );
  });
});
```

## Code Quality

```bash
# Lint with type checking
yarn lint

# Format code
yarn format

# Git hooks (husky + lint-staged)
# Automatically runs oxlint --fix + prettier on staged files before commit
```

## Environment-based Configuration

Build/run commands respect NODE_ENV:

```bash
# Development - uses .env.development
yarn build:dev
yarn start:dev

# Production - uses .env.production
yarn build:prod
yarn start:prod

# Test - uses .env.test
yarn build:test
NODE_ENV=test yarn test
```

## Redis & Caching

- **CacheService**: Generic cache with "get or load" pattern
  - Prevents cache stampede
  - Lock-based concurrency control
  - Pattern-based key operations
  
- **AuthSessionService**: Redis-backed session management
  - Session creation/revocation
  - Device tracking
  - Token rotation with atomic Lua operations
  - User blocking and token blacklisting

See [cache README](src/core/infrastructure/cache/README.md) for detailed usage.

## Observability

NestJS Observe automatically instruments the application with:

- Distributed tracing across services
- Request waterfall analysis
- Performance metrics and logging
- Error tracking with context
- SLA monitoring and alerts

Setup (optional):

```bash
npx @nestjs/observe link
# Approve at https://observe.nestjs.com/link
```

## Common Patterns

### Adding a New Module

1. Create module structure under `modules/feature-name/`
2. Define Command/Query classes
3. Implement Handlers
4. Create Repository interface and implementation
5. Register in module providers
6. Add Controller endpoints

### Adding a New Query Handler

```typescript
// 1. Define Query
export class ListUsersQuery extends Query<UserEntity[]> {
  constructor(
    public readonly skip: number = 0,
    public readonly take: number = 10,
  ) {
    super();
  }
}

// 2. Implement Handler
@QueryHandler(ListUsersQuery)
export class ListUsersHandler implements IQueryHandler<ListUsersQuery> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async execute(query: ListUsersQuery): Promise<UserEntity[]> {
    return this.userRepository.findAll(query.skip, query.take);
  }
}

// 3. Register in module
const queryHandlers = [GetUserByIdHandler, ListUsersHandler];

@Module({
  providers: [...queryHandlers],
})
export class UserModule {}

// 4. Use in controller
@Get()
async listUsers(@Query() pagination: PaginateDto) {
  return this.queryBus.execute(
    new ListUsersQuery(pagination.skip, pagination.take),
  );
}
```

### Error Handling

Use NestJS built-in exceptions:

```typescript
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  async execute(command: CreateUserCommand): Promise<UserEntity> {
    const existing = await this.userRepository.findByEmail(command.email);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }
    // ... create user
  }
}
```

## Troubleshooting

### Database connection fails
- Check `DB_HOST`, `DB_PORT`, credentials in `.env.{NODE_ENV}`
- Ensure PostgreSQL is running
- Run migrations: `npm run migration:run:dev`

### Redis connection fails
- Check `REDIS_HOST`, `REDIS_PORT` in `.env.{NODE_ENV}`
- Ensure Redis is running on configured host/port
- Redis is optional for development; AuthSessionService requires it

### Tests fail
- Ensure test database is configured in `.env.test`
- Run migrations for test DB: `npm run migration:run:test`
- Check vitest config: `vitest.config.ts`

## Guidelines

See [CLAUDE.md](CLAUDE.md) for development guidelines covering:
- CQRS patterns
- Module organization
- Database & repository patterns
- Error handling
- Testing conventions
- Caching strategies
- Configuration management

## References

- [NestJS Documentation](https://docs.nestjs.com)
- [NestJS CQRS](https://docs.nestjs.com/techniques/cqrs)
- [TypeORM Documentation](https://typeorm.io)
- [Redis Documentation](https://redis.io/docs)
- [Vitest Documentation](https://vitest.dev)

## License

MIT
