import {
  Module,
  MiddlewareConsumer,
  NestModule,
  Type,
  NestMiddleware,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TimeoutInterceptor } from './core/http/interceptors/timeout.interceptor.js';
import { ErrorsInterceptor } from './core/http/interceptors/errors.interceptor.js';
import { TransformInterceptor } from './core/http/interceptors/transform.interceptor.js';
import { LoggerMiddleware } from './core/http/middlewares/logger.middleware.js';
import { RequestIdMiddleware } from './core/http/middlewares/request-id.middleware.js';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { UserModule } from './modules/user/user.module.js';
import { HttpExceptionFilter } from './core/http/filters/http-exeception.filter.js';
import { join } from 'node:path';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './core/infrastructure/database/database.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    UserModule,
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
