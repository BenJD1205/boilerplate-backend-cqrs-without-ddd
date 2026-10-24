import { ConflictException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateUserCommand } from '../impl/create-user.command.js';
import { USER_REPOSITORY } from '../../interfaces/user.repository.interface.js';
import type { UserRepository } from '../../interfaces/user.repository.interface.js';
import { UserEntity } from '../../entities/user.entity.js';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async execute(command: CreateUserCommand): Promise<UserEntity> {
    const email = command.email.trim().toLowerCase();
    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    return this.userRepository.createUser({
      name: command.name.trim(),
      email,
    });
  }
}
