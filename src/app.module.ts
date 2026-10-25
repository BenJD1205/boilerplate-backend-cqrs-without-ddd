import {
  Module,
  MiddlewareConsumer,
  NestModule,
  Type,
  NestMiddleware,
} from '@nestjs/common';
import { ModulesModule } from './modules/modules.module.js';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModule,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { TimeoutInterceptor } from './core/http/interceptors/timeout.interceptor.js';
import { ErrorsInterceptor } from './core/http/interceptors/errors.interceptor.js';
import { TransformInterceptor } from './core/http/interceptors/transform.interceptor.js';
import { LoggerMiddleware } from './core/http/middlewares/logger.middleware.js';
import { RequestIdMiddleware } from './core/http/middlewares/request-id.middleware.js';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HttpExceptionFilter } from './core/http/filters/http-exeception.filter.js';
import { join } from 'node:path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from './core/infrastructure/database/database.module.js';
import {
  RedisModule,
  RedisService,
} from './core/infrastructure/cache/redis.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com,
    // then run `npx @nestjs/observe link` to write your key pair into .env.
    ConfigModule.forRoot({
      envFilePath: [join(process.cwd(), 'env', `.env.${process.env.NODE_ENV}`)],
      isGlobal: true,
    }),
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'boilerplate-backend-cqrs',
    }),
    DatabaseModule,
    ModulesModule,
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule, RedisModule],
      inject: [ConfigService, RedisService],
      useFactory: (
        config: ConfigService,
        redis: RedisService,
      ): ThrottlerModuleOptions => ({
        storage: new ThrottlerStorageRedisService(redis),
        skipIf: (context) => context.getType() !== 'http',
        throttlers: [
          {
            ttl: Number(config.get('THROTTLE_TTL_MS', 60000)),
            limit: Number(config.get('THROTTLE_LIMIT', 100)),
          },
        ],
      }),
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        stores: [
          createKeyv(
            {
              socket: {
                host: configService.get<string>('REDIS_HOST', 'localhost'),
                port: Number(configService.get('REDIS_PORT', 6379)),
              },
              password:
                configService.get<string>('REDIS_PASSWORD') || undefined,
              username:
                configService.get<string>('REDIS_USERNAME') || undefined,
            },
            { namespace: 'renthub-cache' },
          ),
        ],
        ttl: 60000,
      }),
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // {
    //   provide: 'APP_INTERCEPTOR',
    //   useClass: CacheInterceptor,
    // },
    {
      provide: 'APP_INTERCEPTOR',
      useClass: TimeoutInterceptor,
    },
    // {
    //   provide: 'APP_INTERCEPTOR',
    //   useClass: IdempotencyInterceptor,
    // },
    {
      provide: 'APP_INTERCEPTOR',
      useClass: ErrorsInterceptor,
    },
    {
      provide: 'APP_INTERCEPTOR',
      useClass: TransformInterceptor as Type<TransformInterceptor>,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        LoggerMiddleware as Type<NestMiddleware>,
        RequestIdMiddleware as Type<NestMiddleware>,
      )
      .forRoutes('*path');
  }
}
