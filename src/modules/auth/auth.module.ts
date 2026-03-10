import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from '../../database/entities/user.entity';
import { EmailVerificationToken } from '../../database/entities/email-verification-token.entity';
import { AuthMailerService } from './auth-mailer.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, EmailVerificationToken])],
  controllers: [AuthController],
  providers: [AuthService, AuthMailerService],
  exports: [AuthService],
})
export class AuthModule {}
