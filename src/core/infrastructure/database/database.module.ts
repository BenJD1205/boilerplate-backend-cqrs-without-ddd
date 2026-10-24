import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { CustomTypeOrmLogger } from '../logging/logger-typeorm.js';
import { join } from 'node:path';
import {
  positiveInteger,
  runtimeRole,
} from '@/core/config/runtime-role.config.js';

export const databaseDataSourceName = 'rent-hub-pg';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: databaseDataSourceName,
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV');
        const isLocal = nodeEnv === 'local';
        return {
          name: databaseDataSourceName,
          type: 'postgres',
          host: configService.get('DB_HOST'),
          port: Number(configService.get('DB_PORT')),
          username: configService.get('DB_USERNAME'),
          password: configService.get('DB_PASSWORD'),
          database: configService.get('DB_DATABASE'),
          entities: [],
          synchronize: false,
          autoLoadEntities: true,
          logging: isLocal ? true : ['error', 'schema'],
          logger: new CustomTypeOrmLogger('RENT-HUB-DB'),
          maxQueryExecutionTime: 1000,
          poolSize: positiveInteger(
            configService.get('DB_POOL_MAX'),
            10,
            'DB_POOL_MAX',
          ),
          extra: {
            application_name: `renthub-${runtimeRole()}`,
            connectionTimeoutMillis: positiveInteger(
              configService.get('DB_POOL_WAIT_TIMEOUT_MS'),
              5000,
              'DB_POOL_WAIT_TIMEOUT_MS',
            ),
            idleTimeoutMillis: positiveInteger(
              configService.get('DB_POOL_IDLE_TIMEOUT_MS'),
              30000,
              'DB_POOL_IDLE_TIMEOUT_MS',
            ),
            statement_timeout: positiveInteger(
              configService.get('DB_STATEMENT_TIMEOUT_MS'),
              30000,
              'DB_STATEMENT_TIMEOUT_MS',
            ),
            query_timeout: positiveInteger(
              configService.get('DB_QUERY_TIMEOUT_MS'),
              35000,
              'DB_QUERY_TIMEOUT_MS',
            ),
            lock_timeout: positiveInteger(
              configService.get('DB_LOCK_TIMEOUT_MS'),
              5000,
              'DB_LOCK_TIMEOUT_MS',
            ),
            idle_in_transaction_session_timeout: positiveInteger(
              configService.get('DB_IDLE_TRANSACTION_TIMEOUT_MS'),
              30000,
              'DB_IDLE_TRANSACTION_TIMEOUT_MS',
            ),
          },
          migrationsRun: false,
          migrations: [
            join(process.cwd(), 'dist/scripts/database/migrations/*.js'),
          ],
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([], databaseDataSourceName),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
