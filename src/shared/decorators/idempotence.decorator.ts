import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

export const IDEMPOTENT_KEY = 'idempotent';
export const Idempotent = () =>
  applyDecorators(
    SetMetadata(IDEMPOTENT_KEY, true),
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description:
        'Reuse the same key and payload for retries. Completed results replay for 24 hours; uncertain results require reconciliation.',
      schema: { type: 'string', maxLength: 128 },
    }),
  );
