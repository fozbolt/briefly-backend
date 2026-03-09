import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { CareerTip } from '../../common/interfaces/frontend-types';
import { DigestCache } from '../../database/entities/digest-cache.entity';
import { fetchRssFeed } from '../../common/helpers/rss-parser.helper';
import { estimateReadTime } from '../../common/helpers/time.helper';

const CACHE_TTL = 21600; // 6 hours

@Injectable()
export class CareerTipsService {
  private readonly rssFeeds: Record<string, string>;

  constructor(
    private configService: ConfigService,
    @InjectRepository(DigestCache)
    private cacheRepo: Repository<DigestCache>,
  ) {
    this.rssFeeds = this.configService.get<Record<string, string>>('rssFeeds') || {};
  }

  async getDailyTip(): Promise<CareerTip> {
    const cacheKey = 'content:career-tip';
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const results = await Promise.allSettled([
        fetchRssFeed(this.rssFeeds.hbr || 'https://feeds.hbr.org/harvardbusiness'),
        fetchRssFeed(this.rssFeeds.fastCompany || 'https://www.fastcompany.com/latest/rss'),
      ]);

      const allItems = results
        .filter((r) => r.status === 'fulfilled')
        .flatMap((r) => (r as PromiseFulfilledResult<any>).value);

      if (allItems.length === 0) return this.getFallback();

      // Rotate daily
      const dayOfYear = Math.floor(
        (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
      );
      const item = allItems[dayOfYear % allItems.length];

      const tip: CareerTip = {
        title: item.title,
        readTime: estimateReadTime(item.description || ''),
        tag: 'PRO TIP',
      };

      await this.saveCache(cacheKey, tip);
      return tip;
    } catch (error) {
      console.error('Career tips RSS error:', (error as Error).message);
      return this.getFallback();
    }
  }

  private getFallback(): CareerTip {
    return {
      title: 'Mastering Remote Communication in 2024',
      readTime: '3 min read',
      tag: 'PRO TIP',
    };
  }

  private async getFromCache(cacheKey: string): Promise<CareerTip | null> {
    try {
      const cached = await this.cacheRepo.findOne({
        where: { cacheKey, expiresAt: MoreThan(new Date()) },
      });
      return cached ? JSON.parse(cached.data) : null;
    } catch {
      return null;
    }
  }

  private async saveCache(cacheKey: string, data: CareerTip): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + CACHE_TTL * 1000);
      const existing = await this.cacheRepo.findOne({ where: { cacheKey } });
      if (existing) {
        existing.data = JSON.stringify(data);
        existing.expiresAt = expiresAt;
        await this.cacheRepo.save(existing);
      } else {
        await this.cacheRepo.save({ cacheKey, data: JSON.stringify(data), ttlSeconds: CACHE_TTL, expiresAt });
      }
    } catch (error) {
      console.error('Cache save error:', (error as Error).message);
    }
  }
}
