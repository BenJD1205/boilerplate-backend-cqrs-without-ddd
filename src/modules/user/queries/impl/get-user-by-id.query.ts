import { Query } from '@nestjs/cqrs';
import type { UserEntity } from '../../entities/user.entity.js';

export class GetUserByIdQuery extends Query<UserEntity> {
  constructor(public readonly id: string) {
    super();
  }
}
