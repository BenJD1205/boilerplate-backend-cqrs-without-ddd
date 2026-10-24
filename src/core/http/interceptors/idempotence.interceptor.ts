import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { from, lastValueFrom, Observable } from 'rxjs';
import { databaseDataSourceName } from '../../infrastructure/database/database.module.js';
import { IDEMPOTENT_KEY } from '@/shared/decorators/idempotence.decorator.js';
import { instanceToPlain } from 'class-transformer';

interface StoredRequest {
  request_hash: string;
  state: 'in_progress' | 'completed' | 'uncertain';
  status_code: number | null;
  response: unknown;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectDataSource(databaseDataSourceName)
    private readonly dataSource: DataSource,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (
      context.getType() !== 'http' ||
      !this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return next.handle();
    }
    const request = context
      .switchToHttp()
      .getRequest<
        Request & { user?: { id?: string }; 'request-id'?: unknown }
      >();
    const key = request.headers['idempotency-key'];
    if (key === undefined) return next.handle();
    if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) {
      throw new BadRequestException(
        'Idempotency-Key must contain 1-128 letters, digits, ".", "_", ":" or "-"',
      );
    }
    if (!request.user?.id) {
      throw new BadRequestException(
        'Idempotency-Key requires an authenticated user',
      );
    }
    const response = context.switchToHttp().getResponse<Response>();
    const scope = createHash('sha256')
      .update(`${request.user.id}:${request.method}:${request.path}:${key}`)
      .digest('hex');
    const body: unknown = request.body;
    const hash = createHash('sha256')
      .update(canonicalJson({ body, query: request.query }))
      .digest('hex');
    // The owned promise keeps running after an HTTP timeout/disconnect, so its
    // result can still be persisted instead of allowing a second execution.
    const requestId: unknown = request['request-id'];
    return from(
      this.execute(scope, hash, response, next, {
        actorId: request.user.id,
        method: request.method,
        path: request.path,
        requestId: typeof requestId === 'string' ? requestId : null,
      }),
    );
  }

  private async execute(
    scope: string,
    hash: string,
    response: Response,
    next: CallHandler,
    metadata: {
      actorId: string;
      method: string;
      path: string;
      requestId: string | null;
    },
  ): Promise<unknown> {
    await this.dataSource.query(
      `DELETE FROM api_idempotency
       WHERE scope = $1 AND state = 'completed' AND expires_at < now()`,
      [scope],
    );
    const inserted = await this.dataSource.query<{ scope: string }[]>(
      `INSERT INTO api_idempotency
         (scope, request_hash, actor_id, method, path, request_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING RETURNING scope`,
      [
        scope,
        hash,
        metadata.actorId,
        metadata.method,
        metadata.path,
        metadata.requestId,
      ],
    );
    if (inserted.length === 0) {
      const [stored] = await this.dataSource.query<StoredRequest[]>(
        'SELECT request_hash, state, status_code, response FROM api_idempotency WHERE scope = $1',
        [scope],
      );
      if (!stored || stored.request_hash !== hash) {
        throw new ConflictException(
          'Idempotency-Key was used with a different payload',
        );
      }
      if (stored.state !== 'completed') {
        response.setHeader('Retry-After', '2');
        throw new ConflictException(
          stored.state === 'uncertain'
            ? 'Previous outcome is uncertain; reconcile before submitting a new operation'
            : 'Request is in progress or awaiting reconciliation; retry with the same key',
        );
      }
      response.status(stored.status_code!);
      response.setHeader('Idempotency-Replayed', 'true');
      return stored.response;
    }

    try {
      const result: unknown = await lastValueFrom(next.handle());
      const json: unknown = JSON.parse(
        JSON.stringify(instanceToPlain(result ?? null)),
      );
      await this.dataSource.query(
        `UPDATE api_idempotency
         SET state = 'completed', response = $2::jsonb, status_code = $3,
             expires_at = now() + interval '24 hours'
         WHERE scope = $1`,
        [scope, JSON.stringify(json), response.statusCode],
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Request ${scope} needs reconciliation`,
        error instanceof Error ? error.stack : String(error),
      );
      try {
        await this.dataSource.query(
          `UPDATE api_idempotency SET state = 'uncertain' WHERE scope = $1`,
          [scope],
        );
      } catch (storageError) {
        this.logger.error(
          `Could not persist uncertain outcome for ${scope}`,
          storageError instanceof Error
            ? storageError.stack
            : String(storageError),
        );
      }
      throw error;
    }
  }
}
