import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { DigestCache } from '../../database/entities/digest-cache.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DigestCache])],
  controllers: [NewsController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}
