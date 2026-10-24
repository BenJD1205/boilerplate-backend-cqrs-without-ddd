import { IPaginatedResult } from '../interfaces/common.interface.js';
import {
  IBaseRepository,
  RepositoryCriteria,
} from '../interfaces/base.repository.interface.js';
import { QueryBuilderUtil } from '../utils/query-builder.util.js';
import {
  DeepPartial,
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

export abstract class BaseTypeormRepository<
  T extends ObjectLiteral,
> implements IBaseRepository<T> {
  protected constructor(protected readonly repository: Repository<T>) {}

  create(data: DeepPartial<T>): T {
    return this.repository.create(data);
  }

  save(entity: T, manager?: EntityManager): Promise<T> {
    return this.getRepository(manager).save(entity);
  }

  findOne(
    options: FindOneOptions<T>,
    manager?: EntityManager,
  ): Promise<T | null> {
    return this.getRepository(manager).findOne(options);
  }

  find(options?: FindManyOptions<T>, manager?: EntityManager): Promise<T[]> {
    return this.getRepository(manager).find(options);
  }

  count(
    options?: FindManyOptions<T>,
    manager?: EntityManager,
  ): Promise<number> {
    return this.getRepository(manager).count(options);
  }

  delete(criteria: RepositoryCriteria<T>, manager?: EntityManager) {
    return this.getRepository(manager).delete(criteria);
  }

  update(
    criteria: RepositoryCriteria<T>,
    data: Partial<T>,
    manager?: EntityManager,
  ) {
    return this.getRepository(manager).update(criteria, data);
  }

  createQueryBuilder(alias: string): SelectQueryBuilder<T> {
    return this.repository.createQueryBuilder(alias);
  }

  async paginate(
    queryBuilder: SelectQueryBuilder<T>,
    page: number,
    limit: number,
  ): Promise<IPaginatedResult<T>> {
    const [data, total] = await new QueryBuilderUtil(queryBuilder)
      .applyPagination(page, limit)
      .getQuery()
      .getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        currentPage: page,
        totalPages,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  softDelete(criteria: RepositoryCriteria<T>, manager?: EntityManager) {
    return this.getRepository(manager).softDelete(criteria);
  }

  restore(criteria: RepositoryCriteria<T>, manager?: EntityManager) {
    return this.getRepository(manager).restore(criteria);
  }

  private getRepository(manager?: EntityManager): Repository<T> {
    return manager
      ? manager.getRepository<T>(this.repository.target)
      : this.repository;
  }
}
