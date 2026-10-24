import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class PaginationBoundsPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== 'query') return value;
    const query =
      metadata.data === 'page' || metadata.data === 'limit'
        ? { [metadata.data]: value }
        : value;
    if (!query || typeof query !== 'object') return value;
    for (const [field, max] of [
      ['page', 100000],
      ['limit', 100],
    ] as const) {
      const raw = (query as Record<string, unknown>)[field];
      if (raw === undefined) continue;
      if (
        (typeof raw !== 'string' && typeof raw !== 'number') ||
        (typeof raw === 'string' && !/^\d+$/.test(raw)) ||
        !Number.isSafeInteger(Number(raw)) ||
        Number(raw) < 1 ||
        Number(raw) > max
      ) {
        throw new BadRequestException(
          `${field} must be an integer between 1 and ${max}`,
        );
      }
    }
    return value;
  }
}
