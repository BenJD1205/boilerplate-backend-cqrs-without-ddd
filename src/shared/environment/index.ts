import * as Joi from 'joi';
import { NODE_ENV_STAGES } from '../enum/index.js';
import { IEnvironmentsRoot } from '../interfaces/index.js';
/**
 * @param token the namespace pointing specific one
 * @return {IEnvironmentsRoot}
 */
export default (): IEnvironmentsRoot => ({
  DEVELOPMENT: process.env.DEVELOPMENT ?? 'development',
  TEST: process.env.TEST ?? 'test',
  LOCAL: process.env.LOCAL ?? 'local',
  PORT: Number.parseInt(<string>process.env.PORT, 10),
  NODE_ENV: process.env.NODE_ENV ?? NODE_ENV_STAGES.LOCAL,
  DB_HOST: process.env.DB_HOST ?? 'localhost',
  DB_PORT: Number.parseInt(<string>process.env.DB_PORT, 10),
  DB_USERNAME: process.env.DB_USERNAME ?? 'postgres',
  DB_DATABASE: process.env.DB_DATABASE ?? 'rent_hub_database',
  DB_PASSWORD: process.env.DB_PASSWORD ?? 'pwd',
  API_GLOBAL_PREFIX: process.env.GRPC_API_GLOBAL_PREFIX ?? 'api',
});
/**
 * @param token the namespace pointing specific one
 * @return {IEnvironmentsRoot}
 * @extends {NODE_ENV: NODE_ENV_STAGES}
 */
export const validateSchema = Joi.object<
  IEnvironmentsRoot & {
    NODE_ENV: NODE_ENV_STAGES;
  }
>({
  NODE_ENV: Joi.string()
    .valid('local', 'development', 'test', 'staging', 'production')
    .default('local'),
  PORT: Joi.number().required(),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().required(),
  DB_USERNAME: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  API_GLOBAL_PREFIX: Joi.string().required(),
});
