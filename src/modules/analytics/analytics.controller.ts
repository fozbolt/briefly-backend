import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { AnalyticsService } from './analytics.service';
import { TrackEventsDto } from './dto/track-events.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Ingest a batch of analytics events.
   *
   * Events are accepted into an in-memory buffer and flushed to the DB
   * asynchronously (every 5s or when 500 events accumulate).
   *
   * Returns 202 Accepted immediately — the caller does not wait for
   * the database write.
   *
   * No auth guard — events use pseudonymous IDs, not real user IDs.
   */
  @Post('events')
  @HttpCode(202)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // 5 batch requests/min per IP (each carries up to 100 events)
  trackEvents(
    @Body() body: TrackEventsDto,
  ): { accepted: number; dropped: number } {
    return this.analyticsService.enqueue(body.events);
  }
}
