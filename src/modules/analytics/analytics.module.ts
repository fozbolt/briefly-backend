import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsCleanupService } from './analytics-cleanup.service';
import { AnalyticsEvent } from '../../database/entities/analytics-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsEvent])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsCleanupService],
})
export class AnalyticsModule {}
