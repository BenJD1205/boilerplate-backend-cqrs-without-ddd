import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const started = performance.now();
    const { ip, method, path } = request;
    const userAgent = request.get('user-agent') || '';

    response.on('finish', () => {
      const { statusCode, statusMessage } = response;
      const contentLength = response.get('content-length');

      const requestId = String(response.getHeader('x-request-id') ?? '-');
      const elapsedMs = Math.round(performance.now() - started);
      const message = `${method} ${path} ${statusCode} ${statusMessage} ${contentLength} - ${userAgent} ${ip} request_id=${requestId} duration_ms=${elapsedMs} pid=${process.pid}`;

      if (statusCode >= 500) {
        return this.logger.error(message);
      }

      if (statusCode >= 400) {
        return this.logger.warn(message);
      }

      return this.logger.log(message);
    });

    next();
  }
}
