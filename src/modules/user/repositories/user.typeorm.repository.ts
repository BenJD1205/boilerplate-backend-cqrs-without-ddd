import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeormRepository } from '../../../shared/repository/base-typeorm.repository.js';
import { QueryBuilderUtil } from '../../../shared/utils/query-builder.util.js';
import { UserEntity } from '../entities/user.entity.js';
import type {
  UserListOptions,
  UserRepository,
} from '../interfaces/user.repository.interface.js';

@Injectable()
export class UserTypeormRepository
  extends BaseTypeormRepository<UserEntity>
  implements UserRepository
{
  constructor(
    @InjectRepository(UserEntity)
    repository: Repository<UserEntity>,
  ) {
    super(repository);
  }

  createUser(data: Pick<UserEntity, 'name' | 'email'>): Promise<UserEntity> {
    return this.save(this.create(data));
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.findOne({ where: { email } });
  }

  findAll(options: UserListOptions) {
    const queryBuilder = new QueryBuilderUtil(
      this.createQueryBuilder('user').orderBy('user.createdAt', 'DESC'),
    )
      .applySearch(options.search, ['user.name', 'user.email'])
      .applySort(options.sortBy, options.sortOrder, {
        allowedFields: ['user.name', 'user.email', 'user.createdAt'],
        defaultAlias: 'user',
        fieldMap: {
          name: 'user.name',
          email: 'user.email',
          createdAt: 'user.createdAt',
        },
      })
      .getQuery();

    return this.paginate(queryBuilder, options.page, options.limit);
  }
}
