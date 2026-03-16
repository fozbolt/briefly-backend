import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AppController } from './app.controller';
import { WeatherModule } from './modules/weather/weather.module';
import { NewsModule } from './modules/news/news.module';
import { FinanceModule } from './modules/finance/finance.module';
import { ContentModule } from './modules/content/content.module';
import { SocialModule } from './modules/social/social.module';
import { DigestModule } from './modules/digest/digest.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { ListenModule } from './modules/listen/listen.module';
import { TrafficModule } from './modules/traffic/traffic.module';
import { AlertsModule } from './modules/alerts/alerts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      load: [configuration],
      isGlobal: true,
    }),
    DatabaseModule,
    WeatherModule,
    NewsModule,
    FinanceModule,
    ContentModule,
    SocialModule,
    DigestModule,
    AuthModule,
    ChatModule,
    ListenModule,
    TrafficModule,
    AlertsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
