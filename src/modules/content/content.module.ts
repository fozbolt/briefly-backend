import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentController } from './content.controller';
import { BooksService } from './books.service';
import { CareerTipsService } from './career-tips.service';
import { QuotesService } from './quotes.service';
import { RecommendationsService } from './recommendations.service';
import { DigestCache } from '../../database/entities/digest-cache.entity';
import { NewsModule } from '../news/news.module';

@Module({
  imports: [TypeOrmModule.forFeature([DigestCache]), NewsModule],
  controllers: [ContentController],
  providers: [BooksService, CareerTipsService, QuotesService, RecommendationsService],
  exports: [BooksService, CareerTipsService, QuotesService, RecommendationsService],
})
export class ContentModule {}
