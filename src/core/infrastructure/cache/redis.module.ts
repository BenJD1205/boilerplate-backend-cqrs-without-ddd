import {
  Global,
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { AuthSessionService } from '../../services/auth-session.service.js';
import { CacheService } from '../../services/cache.service.js';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: Number(config.get('REDIS_PORT', 6379)),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
      username: config.get<string>('REDIS_USERNAME') || undefined,
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      commandTimeout: 3000,
    });
    const logger = new Logger(RedisService.name);
    this.on('error', (error: Error) => logger.error(error.message));
  }

  onModuleDestroy() {
    this.disconnect();
  }
}

@Global()
@Module({
  providers: [
    RedisService,
    AuthSessionService,
    CacheService,
    { provide: 'REDIS_CLIENT', useExisting: RedisService },
  ],
  exports: [RedisService, AuthSessionService, CacheService, 'REDIS_CLIENT'],
})
export class RedisModule {}
