import { QueryBuilderUtil } from './query-builder.util.js';
import type { SelectQueryBuilder } from 'typeorm';

describe('QueryBuilderUtil', () => {
  function createQueryBuilder() {
    const mocks = {
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
    };

    return {
      mocks,
      queryBuilder: mocks as unknown as SelectQueryBuilder<
        Record<string, unknown>
      >,
    };
  }

  it('applies a sort only when the requested field is allowlisted', () => {
    const { mocks, queryBuilder } = createQueryBuilder();
    const util = new QueryBuilderUtil(queryBuilder);

    util.applySort('name', 'asc', {
      allowedFields: ['user.name'],
      defaultAlias: 'user',
      fieldMap: { name: 'user.name' },
    });

    expect(mocks.orderBy).toHaveBeenCalledWith('user.name', 'ASC');
  });

  it('ignores fields that are not allowlisted', () => {
    const { mocks, queryBuilder } = createQueryBuilder();
    const util = new QueryBuilderUtil(queryBuilder);

    util.applySort('email', 'DESC', {
      allowedFields: ['user.name'],
      defaultAlias: 'user',
    });

    expect(mocks.orderBy).not.toHaveBeenCalled();
  });

  it('applies only filters mapped to trusted columns', () => {
    const { mocks, queryBuilder } = createQueryBuilder();
    const util = new QueryBuilderUtil(queryBuilder);

    util.applyFilters(
      { email: 'user@example.com', unknown: 'ignored' },
      { email: 'user.email' },
    );

    expect(mocks.andWhere).toHaveBeenCalledTimes(1);
    expect(mocks.andWhere).toHaveBeenCalledWith('user.email = :filter0', {
      filter0: 'user@example.com',
    });
  });

  it('validates and applies page offsets', () => {
    const { mocks, queryBuilder } = createQueryBuilder();
    const util = new QueryBuilderUtil(queryBuilder);

    util.applyPagination(3, 25);

    expect(mocks.skip).toHaveBeenCalledWith(50);
    expect(mocks.take).toHaveBeenCalledWith(25);
    expect(() => util.applyPagination(0, 25)).toThrow(RangeError);
  });
});
