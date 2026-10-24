import { Command } from '@nestjs/cqrs';
import type { UserEntity } from '../../entities/user.entity.js';

export class CreateUserCommand extends Command<UserEntity> {
  constructor(
    public readonly name: string,
    public readonly email: string,
  ) {
    super();
  }
}
