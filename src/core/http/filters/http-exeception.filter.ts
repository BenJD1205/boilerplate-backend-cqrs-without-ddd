import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  getDefaultStatusMessage,
  translateErrorMessage,
} from '@shared/utils/vietnamese-error-message.util.js';
import { QueryFailedError } from 'typeorm';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const databaseCode =
      exception instanceof QueryFailedError
        ? (exception.driverError as { code?: string }).code
        : undefined;
    const busyDatabase = ['40P01', '55P03', '57014', '53300'].includes(
      databaseCode ?? '',
    );
    let status: number;
    if (databaseCode === '23505') {
      status = HttpStatus.CONFLICT;
    } else if (busyDatabase) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
    } else if (isHttpException) {
      status = exception.getStatus();
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
    }
    let exceptionResponse: string | object | undefined;
    if (databaseCode === '23505') {
      exceptionResponse = {
        message: 'Dữ liệu đã tồn tại hoặc đã được cập nhật bởi yêu cầu khác',
      };
    } else if (busyDatabase) {
      exceptionResponse = {
        message: 'Hệ thống đang bận, vui lòng thử lại với cùng Idempotency-Key',
      };
    } else if (isHttpException) {
      exceptionResponse = exception.getResponse();
    }
    if (busyDatabase) response.setHeader('Retry-After', '2');
    const rawMessage =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as { message?: unknown }).message
        : exceptionResponse;
    const message = translateErrorMessage(rawMessage, status);

    response.status(status).json({
      ...(typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? exceptionResponse
        : {}),
      statusCode: status,
      message,
      error: getDefaultStatusMessage(status),
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: response.getHeader('x-request-id'),
    });
  }
}
