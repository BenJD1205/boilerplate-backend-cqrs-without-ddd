import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UserEntity } from '../../entities/user.entity.js';
import type { IPaginatedResult } from '../../../../shared/interfaces/common.interface.js';
import { USER_REPOSITORY } from '../../interfaces/user.repository.interface.js';
import type { UserRepository } from '../../interfaces/user.repository.interface.js';
import { ListUsersQuery } from '../impl/list-users.query.js';

@QueryHandler(ListUsersQuery)
export class ListUsersHandler implements IQueryHandler<ListUsersQuery> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  execute(query: ListUsersQuery): Promise<IPaginatedResult<UserEntity>> {
    return this.userRepository.findAll(query);
  }
}
