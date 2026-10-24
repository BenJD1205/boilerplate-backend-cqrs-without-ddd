import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

export const REQUEST_TIMEOUT_KEY = 'requestTimeout';
export const RequestTimeout = (milliseconds: number) =>
  SetMetadata(REQUEST_TIMEOUT_KEY, milliseconds);

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const timeoutMs =
      this.reflector.getAllAndOverride<number>(REQUEST_TIMEOUT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 5000;

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((err: Error) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException());
        }
        return throwError(() => err);
      }),
    );
  }
}
