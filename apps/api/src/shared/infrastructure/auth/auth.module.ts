import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { PASSWORD_HASHER_PORT } from '../../application/ports/password-hasher.port.js';
import { TOKEN_SERVICE_PORT } from '../../application/ports/token-service.port.js';
import { BcryptPasswordHasherAdapter } from './bcrypt-password-hasher.adapter.js';
import { JwtTokenServiceAdapter } from './jwt-token-service.adapter.js';

@Module({
  imports: [ConfigModule, JwtModule.register({})],
  providers: [
    {
      provide: PASSWORD_HASHER_PORT,
      useClass: BcryptPasswordHasherAdapter,
    },
    {
      provide: TOKEN_SERVICE_PORT,
      useClass: JwtTokenServiceAdapter,
    },
  ],
  exports: [PASSWORD_HASHER_PORT, TOKEN_SERVICE_PORT, JwtModule],
})
export class AuthModule {}
