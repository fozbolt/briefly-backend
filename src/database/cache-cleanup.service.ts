import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { DigestCache } from './entities/digest-cache.entity';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class CacheCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheCleanupService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(DigestCache)
    private readonly cacheRepo: Repository<DigestCache>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.cleanupExpiredCache();
    this.timer = setInterval(() => {
      void this.cleanupExpiredCache();
    }, CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async cleanupExpiredCache(): Promise<void> {
    try {
      const result = await this.cacheRepo.delete({
        expiresAt: LessThan(new Date()),
      });
      if ((result.affected ?? 0) > 0) {
        this.logger.log(`Deleted ${result.affected} expired cache rows.`);
      }
    } catch (error) {
      this.logger.warn(`Cache cleanup failed: ${(error as Error).message}`);
    }
  }
}

