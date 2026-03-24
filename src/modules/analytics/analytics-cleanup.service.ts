import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AnalyticsEvent } from '../../database/entities/analytics-event.entity';

/** Run cleanup every 6 hours. */
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Delete events older than 90 days. */
const RETENTION_DAYS = 90;

/** Delete in batches to avoid locking the table for too long. */
const DELETE_BATCH_SIZE = 5_000;

@Injectable()
export class AnalyticsCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsCleanupService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly repo: Repository<AnalyticsEvent>,
  ) {}

  async onModuleInit(): Promise<void> {
    // Run cleanup on startup, then schedule periodic runs
    await this.cleanup();
    this.timer = setInterval(() => {
      void this.cleanup();
    }, CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Delete analytics events older than RETENTION_DAYS.
   * Deletes in batches to avoid long table locks on SQLite.
   */
  private async cleanup(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    let totalDeleted = 0;

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Find a batch of old event IDs
        const oldEvents = await this.repo.find({
          select: ['id'],
          where: { receivedAt: LessThan(cutoff) },
          take: DELETE_BATCH_SIZE,
        });

        if (oldEvents.length === 0) break;

        const ids = oldEvents.map((e) => e.id);
        await this.repo.delete(ids);
        totalDeleted += ids.length;

        // If we got fewer than the batch size, we're done
        if (oldEvents.length < DELETE_BATCH_SIZE) break;
      }

      if (totalDeleted > 0) {
        this.logger.log(
          `Analytics cleanup: deleted ${totalDeleted} events older than ${RETENTION_DAYS} days`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Analytics cleanup failed: ${(error as Error).message}`,
      );
    }
  }
}
