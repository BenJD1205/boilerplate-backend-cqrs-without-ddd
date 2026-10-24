export type RuntimeRole = 'api' | 'worker' | 'combined';

export function runtimeRole(): RuntimeRole {
  const role = process.env.APP_ROLE ?? 'combined';
  if (role !== 'api' && role !== 'worker' && role !== 'combined') {
    throw new Error(
      `Invalid APP_ROLE "${role}": expected api, worker or combined`,
    );
  }
  return role;
}

export function runsBackgroundWorkers(): boolean {
  return runtimeRole() !== 'api';
}

export function positiveInteger(
  value: unknown,
  fallback: number,
  name: string,
): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function queueWorkerOptions(name: string, concurrency = 1) {
  return {
    concurrency: positiveInteger(
      process.env[`${name}_WORKER_CONCURRENCY`],
      concurrency,
      `${name}_WORKER_CONCURRENCY`,
    ),
  };
}
