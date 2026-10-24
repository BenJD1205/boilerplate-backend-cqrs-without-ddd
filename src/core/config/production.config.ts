import { ConfigService } from '@nestjs/config';

export function productionOptions(config: ConfigService) {
  const production = config.get('NODE_ENV') === 'production';
  const origins = config
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (production && origins.length === 0) {
    throw new Error('CORS_ORIGINS must list trusted origins in production');
  }
  for (const origin of origins) {
    const parsed = new URL(origin);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin
    ) {
      throw new Error(
        'CORS_ORIGINS must contain exact HTTP(S) origins without paths',
      );
    }
  }
  const proxy = config.get<string>('TRUST_PROXY', '0');
  return {
    production,
    origins,
    trustProxy: /^\d+$/.test(proxy) ? Number(proxy) : proxy,
    corsOrigin: origins.length ? origins : !production,
  };
}
