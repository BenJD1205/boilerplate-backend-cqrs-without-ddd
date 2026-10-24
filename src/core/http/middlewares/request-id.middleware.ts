import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const supplied = req.headers['x-request-id'];
    const requestId =
      typeof supplied === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)
        ? supplied
        : uuidv4();

    (req as Request & { 'request-id': string })['request-id'] = requestId;

    res.setHeader('x-request-id', requestId);

    next();
  }
}
