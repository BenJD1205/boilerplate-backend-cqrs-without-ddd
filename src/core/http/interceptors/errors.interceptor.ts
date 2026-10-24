import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class ErrorsInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ErrorsInterceptor');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((err: Error) => {
        // 1. Log lỗi gốc ra Terminal để mình còn biết đường mà sửa!
        this.logger.error(`Error message: ${err.message}`, err.stack);

        // 2. Ném lại lỗi gốc hoặc biến đổi nhưng vẫn giữ thông tin
        return throwError(() => err);
      }),
    );
  }
}
