import { UserEntity } from '../entities/user.entity.js';

export class UserResponseDto {
  id!: string;
  name!: string;
  email!: string;
  createdAt!: Date;
  updatedAt!: Date;

  static fromEntity(user: UserEntity): UserResponseDto {
    return Object.assign(new UserResponseDto(), {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }
}
