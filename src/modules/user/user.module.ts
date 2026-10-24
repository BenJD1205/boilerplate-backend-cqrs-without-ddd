import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateUserHandler } from './commands/handlers/create-user.handler.js';
import { GetUserByIdHandler } from './queries/handlers/get-user-by-id.handler.js';
import { ListUsersHandler } from './queries/handlers/list-users.handler.js';
import { UserEntity } from './entities/user.entity.js';
import { USER_REPOSITORY } from './interfaces/user.repository.interface.js';
import { UserTypeormRepository } from './repositories/user.typeorm.repository.js';
import { UserController } from './user.controller.js';

const commandHandlers = [CreateUserHandler];
const queryHandlers = [GetUserByIdHandler, ListUsersHandler];

@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([UserEntity])],
  controllers: [UserController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    UserTypeormRepository,
    { provide: USER_REPOSITORY, useExisting: UserTypeormRepository },
  ],
  exports: [USER_REPOSITORY],
})
export class UserModule {}
