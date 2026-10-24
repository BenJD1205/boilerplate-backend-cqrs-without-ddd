import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UserEntity } from '../../entities/user.entity.js';
import { USER_REPOSITORY } from '../../interfaces/user.repository.interface.js';
import type { UserRepository } from '../../interfaces/user.repository.interface.js';
import { GetUserByIdQuery } from '../impl/get-user-by-id.query.js';

@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async execute(query: GetUserByIdQuery): Promise<UserEntity> {
    const user = await this.userRepository.findById(query.id);

    if (!user) {
      throw new NotFoundException(`User with id "${query.id}" was not found`);
    }

    return user;
  }
}
