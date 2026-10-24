import { UserEntity } from '../entities/user.entity.js';
import { IPaginatedResult } from '../../../shared/interfaces/common.interface.js';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserListOptions {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface UserRepository {
  createUser(data: Pick<UserEntity, 'name' | 'email'>): Promise<UserEntity>;
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findAll(options: UserListOptions): Promise<IPaginatedResult<UserEntity>>;
}
