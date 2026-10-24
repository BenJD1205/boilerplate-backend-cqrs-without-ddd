// src/core/decorators/roles.decorator.ts
import { ERole } from '@/shared/enum/role.enum.js';
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: ERole[]) => SetMetadata(ROLES_KEY, roles);
