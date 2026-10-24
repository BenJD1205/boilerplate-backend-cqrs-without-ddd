import { IPaginatedResult } from '@/shared/interfaces/common.interface.js';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  DeepPartial,
  ObjectLiteral,
  SelectQueryBuilder,
  FindOptionsWhere,
} from 'typeorm';

export interface IBaseRepository<T extends ObjectLiteral> {
  create(data: DeepPartial<T>): T;
  save(entity: T, manager?: EntityManager): Promise<T>;
  findOne(
    options: FindOneOptions<T>,
    manager?: EntityManager,
  ): Promise<T | null>;
  find(options?: FindManyOptions<T>, manager?: EntityManager): Promise<T[]>;
  count(options?: FindManyOptions<T>, manager?: EntityManager): Promise<number>;
  delete(criteria: any, manager?: EntityManager): Promise<any>;
  update(
    criteria: any,
    data: Partial<T>,
    manager?: EntityManager,
  ): Promise<any>;
  createQueryBuilder(alias: string): SelectQueryBuilder<T>;
  paginate(
    qb: SelectQueryBuilder<T>,
    page: number,
    limit: number,
  ): Promise<IPaginatedResult<T>>;
  softDelete(criteria: any, manager?: EntityManager): Promise<any>;
  restore(criteria: any, manager?: EntityManager): Promise<any>;
}

export type RepositoryCriteria<T extends ObjectLiteral> =
  string | number | string[] | number[] | FindOptionsWhere<T>;
