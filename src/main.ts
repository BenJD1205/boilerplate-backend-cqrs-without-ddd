import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import {
  ClassSerializerInterceptor,
  BadRequestException,
  ValidationError,
  VersioningType,
  VERSION_NEUTRAL,
  ValidationPipe,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { flattenValidationErrors } from '@shared/utils/vietnamese-error-message.util.js';
import { RedisIoAdapter } from '@core/config/redis-adapter.config.js';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { PaginationBoundsPipe } from './shared/pipe/pagination-bounds.pipe.js';
// import { RedisService } from './core/infrastructure/cache/redis.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  const configService = app.get(ConfigService);

  //REDIS
  // const redis = app.get(RedisService);
  const redisIoAdapter = new RedisIoAdapter(app, configService);
  await redisIoAdapter.connectToRedis();

  //middleware
  app.use(cookieParser());
  app.enableCors({
    origin: configService.get('CORS_ORIGIN'),
    credentials: true,
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          styleSrc: [
            `'self'`,
            `'unsafe-inline'`,
            'https://cdnjs.cloudflare.com',
          ],
          imgSrc: [`'self'`, 'data:', 'https://swagger.io'],
          scriptSrc: [`'self'`, `https://cdnjs.cloudflare.com`],
        },
      },
    }),
  );
  app.use(compression());
  app.setGlobalPrefix(configService.get('API_GLOBAL_PREFIX') ?? 'api', {
    exclude: ['admin/queues'],
  });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: VERSION_NEUTRAL,
    prefix: 'v',
  });

  app.useWebSocketAdapter(redisIoAdapter);

  //swagger setup
  const options = new DocumentBuilder()
    .setTitle('RentHUB API')
    .setDescription('The RentHUB API description')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'Bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'access_token',
    )
    .addCookieAuth(
      'access_token',
      {
        type: 'apiKey',
        in: 'cookie',
        description: 'JWT Token stored in cookie',
      },
      'cookie-token',
    )
    .addSecurityRequirements('access_token')
    .addServer(configService.get('API_SERVER_URL') ?? 'http://localhost:5000')
    .addTag('default')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    useGlobalPrefix: false,
  });

  //interceptor
  app.useGlobalPipes(
    new PaginationBoundsPipe(),
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { exposeDefaultValues: true },
      exceptionFactory: (errors: ValidationError[]) => {
        return new BadRequestException(flattenValidationErrors(errors));
      },
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  await app.listen(configService.get('API_PORT') ?? 3000);
}
await bootstrap();
