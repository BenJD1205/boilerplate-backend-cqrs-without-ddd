export function buildStats<T extends string>(
  raw: Array<{ status: T; count: string }>,
  allStatuses: T[],
): Record<T, number> {
  const result = {} as Record<T, number>;

  allStatuses.forEach((s) => (result[s] = 0));

  raw.forEach(({ status, count }) => {
    result[status] = Number(count);
  });

  return result;
}

export function buildStatsRole<T extends string>(
  raw: Array<{ role: T; count: string }>,
  allRoles: T[],
): Record<T, number> {
  const result = {} as Record<T, number>;

  allRoles.forEach((r) => (result[r] = 0));

  raw.forEach(({ role, count }) => {
    result[role] = Number(count);
  });

  return result;
}
