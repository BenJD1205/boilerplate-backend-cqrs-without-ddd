import { Reflector } from '@nestjs/core';
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response as ExpressResponse } from 'express';
import { RESPONSE_MESSAGE } from '@shared/decorators/response-message.decorator.js';

export interface Response<T> {
  statusCode: number;
  message?: string;
  data: T;
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}
  intercept<T>(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data: T) => ({
        statusCode: context.switchToHttp().getResponse<ExpressResponse>()
          .statusCode,
        message:
          this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE, [
            context.getHandler(),
            context.getClass(),
          ]) || '',
        data: data,
      })),
    );
  }
}
