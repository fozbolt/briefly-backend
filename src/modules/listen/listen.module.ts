import { Module } from '@nestjs/common';
import { ListenController } from './listen.controller';
import { ListenService } from './listen.service';
import { WeatherModule } from '../weather/weather.module';
import { NewsModule } from '../news/news.module';
import { FinanceModule } from '../finance/finance.module';
import { ContentModule } from '../content/content.module';
import { SocialModule } from '../social/social.module';

@Module({
  imports: [WeatherModule, NewsModule, FinanceModule, ContentModule, SocialModule],
  controllers: [ListenController],
  providers: [ListenService],
  exports: [ListenService],
})
export class ListenModule {}
