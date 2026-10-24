import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateUserCommand } from './commands/impl/create-user.command.js';
import { CreateUserDto } from './dtos/create-user.dto.js';
import { UserResponseDto } from './dtos/user-response.dto.js';
import { UserEntity } from './entities/user.entity.js';
import { GetUserByIdQuery } from './queries/impl/get-user-by-id.query.js';
import { ListUsersQuery } from './queries/impl/list-users.query.js';
import { PaginationBoundsPipe } from '../../shared/pipe/pagination-bounds.pipe.js';
import type { IPaginatedResult } from '../../shared/interfaces/common.interface.js';

@Controller('users')
export class UserController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.commandBus.execute<UserEntity>(
      new CreateUserCommand(dto.name, dto.email),
    );
    return UserResponseDto.fromEntity(user);
  }

  @Get()
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe, PaginationBoundsPipe)
    page: number,
    @Query(
      'limit',
      new DefaultValuePipe(20),
      ParseIntPipe,
      PaginationBoundsPipe,
    )
    limit: number,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<IPaginatedResult<UserResponseDto>> {
    const result = await this.queryBus.execute<IPaginatedResult<UserEntity>>(
      new ListUsersQuery(page, limit, search, sortBy, sortOrder),
    );
    return {
      data: result.data.map((user) => UserResponseDto.fromEntity(user)),
      meta: result.meta,
    };
  }

  @Get(':id')
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.queryBus.execute<UserEntity>(
      new GetUserByIdQuery(id),
    );
    return UserResponseDto.fromEntity(user);
  }
}
