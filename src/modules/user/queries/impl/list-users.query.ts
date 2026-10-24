import { Query } from '@nestjs/cqrs';
import type { UserEntity } from '../../entities/user.entity.js';
import type { IPaginatedResult } from '../../../../shared/interfaces/common.interface.js';

export class ListUsersQuery extends Query<IPaginatedResult<UserEntity>> {
  constructor(
    public readonly page: number,
    public readonly limit: number,
    public readonly search?: string,
    public readonly sortBy?: string,
    public readonly sortOrder?: string,
  ) {
    super();
  }
}
