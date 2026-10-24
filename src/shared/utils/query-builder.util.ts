// common/utils/query-builder.util.ts
import { SelectQueryBuilder, Brackets, ObjectLiteral } from 'typeorm';

export type QueryColumnMap = Readonly<Record<string, string>>;
type SortOrder = 'ASC' | 'DESC';
interface ApplySortOptions {
  allowedFields: readonly string[];
  defaultAlias?: string;
  fieldMap?: Readonly<Record<string, string>>;
}

export class QueryBuilderUtil<T extends ObjectLiteral> {
  constructor(private readonly qb: SelectQueryBuilder<T>) {}

  // 🔍 search nhiều field
  applySearch(search: string | undefined, fields: readonly string[]) {
    const trimmedSearch = search?.trim();
    if (!trimmedSearch || fields.length === 0) return this;

    this.qb.andWhere(
      new Brackets((queryBuilder) => {
        fields.forEach((column, index) => {
          const parameter = `search${index}`;
          queryBuilder.orWhere(`${column} ILIKE :${parameter}`, {
            [parameter]: `%${trimmedSearch}%`,
          });
        });
      }),
    );
    return this;
  }

  // 🎯 filter dynamic
  applyFilters(
    filters: Record<string, unknown> | undefined,
    columns: QueryColumnMap,
  ) {
    if (!filters) return this;

    Object.entries(filters).forEach(([key, value], index) => {
      if (value === undefined || value === null) return;
      const column = columns[key];
      if (!column) return;

      const parameter = `filter${index}`;
      this.qb.andWhere(`${column} = :${parameter}`, { [parameter]: value });
    });

    return this;
  }

  // 🔃 sort
  applySort(
    sortBy: string | undefined,
    sortOrder: unknown,
    options: ApplySortOptions,
  ) {
    if (!sortBy) return this;

    const { allowedFields, defaultAlias = 'this', fieldMap = {} } = options;

    // 1. Map tên trường nếu có định nghĩa (ví dụ: 'created_at' -> 'createdAt')
    const rawField = fieldMap[sortBy] || sortBy;

    // 2. Chặn SQL Injection & trường rác bằng Whitelist
    if (!allowedFields.includes(rawField)) {
      return this; // Hoặc throw new BadRequestException(`Invalid sort field: ${sortBy}`);
    }

    // 3. Tự động prefix alias nếu chưa có (ví dụ: 'createdAt' -> 'order.createdAt')
    const orderField = rawField.includes('.')
      ? rawField
      : `${defaultAlias}.${rawField}`;

    // 4. Chuẩn hóa sortOrder an toàn ở runtime (chỉ chấp nhận 'ASC' hoặc 'DESC')
    const normalizedOrder: SortOrder =
      String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    this.qb.orderBy(orderField, normalizedOrder);
    return this;
  }

  // 📄 pagination (safe)
  applyPagination(page: number, limit: number) {
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new RangeError('page must be a positive safe integer');
    }
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new RangeError('limit must be a positive safe integer');
    }

    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(skip)) {
      throw new RangeError('pagination offset exceeds the safe integer range');
    }

    this.qb.skip(skip).take(limit);
    return this;
  }

  getQuery(): SelectQueryBuilder<T> {
    return this.qb;
  }
}
