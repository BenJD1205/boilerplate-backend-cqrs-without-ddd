import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module.js';
@Module({
  imports: [UserModule],
  providers: [],
  exports: [UserModule],
})
export class ModulesModule {}
