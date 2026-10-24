import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { VersioningType, VERSION_NEUTRAL } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  const configService = app.get(ConfigService);
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
  await app.listen(configService.get('API_PORT') ?? 3000);
}
await bootstrap();
