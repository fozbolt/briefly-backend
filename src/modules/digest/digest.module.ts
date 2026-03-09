import { Module } from '@nestjs/common';
import { DigestController } from './digest.controller';
import { DigestService } from './digest.service';
import { WeatherModule } from '../weather/weather.module';
import { NewsModule } from '../news/news.module';
import { FinanceModule } from '../finance/finance.module';
import { ContentModule } from '../content/content.module';
import { SocialModule } from '../social/social.module';

@Module({
  imports: [WeatherModule, NewsModule, FinanceModule, ContentModule, SocialModule],
  controllers: [DigestController],
  providers: [DigestService],
  exports: [DigestService],
})
export class DigestModule {}
