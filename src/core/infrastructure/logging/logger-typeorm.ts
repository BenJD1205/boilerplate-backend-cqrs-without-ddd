import { Logger as TypeOrmLogger } from 'typeorm';
import { Logger } from '@nestjs/common';
import NODE_ENV_STAGES from '@/shared/environment/index.js';

export class CustomTypeOrmLogger implements TypeOrmLogger {
  private readonly logger: Logger;
  private readonly devEnvs: string[] = [
    NODE_ENV_STAGES().DEVELOPMENT,
    NODE_ENV_STAGES().TEST,
    NODE_ENV_STAGES().LOCAL,
  ];

  constructor(name: string = 'TypeORM') {
    this.logger = new Logger(name);
  }

  logQuery(query: string, parameters?: unknown[]) {
    if (
      this.devEnvs.includes(process.env?.NODE_ENV || NODE_ENV_STAGES().LOCAL)
    ) {
      if (this.shouldSkipQuery(query)) return;
      this.logger.debug(`Query: ${this.toSingleLineQuery(query)}`);
      if (parameters?.length) {
        /**NOTE: should log parameters in the development environment only */
        /** this.logger.debug(`Parameters: ${JSON.stringify(parameters)}`); */
      }
    }
  }

  logQueryError(error: string, query: string, parameters?: unknown[]) {
    this.logger.error(`Query Error: ${error}`);
    this.logger.error(`Failed Query: ${query}`);
    if (parameters?.length) {
      this.logger.error(`Parameters: ${JSON.stringify(parameters)}`);
    }
  }

  logQuerySlow(time: number, query: string, parameters?: unknown[]) {
    this.logger.warn(`Slow Query (${time}ms): ${query}`);
    if (parameters?.length) {
      this.logger.warn(`Parameters: ${JSON.stringify(parameters)}`);
    }
  }

  logSchemaBuild(message: string) {
    this.logger.log(`Schema Build: ${message}`);
  }

  logMigration(message: string) {
    this.logger.log(`Migration: ${message}`);
  }

  log(level: 'log' | 'info' | 'warn', message: unknown) {
    if (
      typeof message === 'string' &&
      message?.includes('All classes found using provided glob pattern')
    ) {
      return;
    }
    if (level === 'log') {
      this.logger.log(message);
    } else if (level === 'info') {
      this.logger.debug(message);
    } else if (level === 'warn') {
      this.logger.warn(message);
    }
  }

  /** PRIVATE FUNCTIONS */
  private shouldSkipQuery(query: string): boolean {
    const skipPatterns = [
      /^select 1/i, // keep-alive query
      /^select now\(\)/i, // timestamp check
      /^select version\(\)/i, // version check
      /pg_catalog/i, // internal pg system queries
      /information_schema/i, // metadata queries
    ];

    return skipPatterns.some((pattern) => pattern.test(query));
  }

  private toSingleLineQuery(query: string): string {
    if (!query) return '';
    return query.split(/\s+/).join(' ').trim();
  }
}
