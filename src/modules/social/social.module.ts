import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { DigestCache } from '../../database/entities/digest-cache.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DigestCache])],
  controllers: [SocialController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
