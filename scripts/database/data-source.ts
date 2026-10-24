import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { join } from 'node:path';
import * as dotenv from 'dotenv';
import getEnvironments from '../../src/shared/environment/index.js';
import { IEnvironmentsRoot } from '../../src/shared/interfaces/index.js';
dotenv.config({
  path: join(process.cwd(), 'env', `.env.${process.env.NODE_ENV}`),
});
const environment: IEnvironmentsRoot = getEnvironments();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: environment.DB_HOST,
  port: environment.DB_PORT,
  username: environment.DB_USERNAME,
  password: environment.DB_PASSWORD,
  database: environment.DB_DATABASE,
  logging: true,
  namingStrategy: new SnakeNamingStrategy(),
  migrations: [join(__dirname, 'migrations/**/*.{ts,js}')],
} as DataSourceOptions);
