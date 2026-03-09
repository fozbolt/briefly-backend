import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { SocialPulse, SocialPost } from '../../common/interfaces/frontend-types';
import { DigestCache } from '../../database/entities/digest-cache.entity';
import { fetchRssFeed } from '../../common/helpers/rss-parser.helper';
import { toRelativeTime } from '../../common/helpers/time.helper';

const CACHE_TTL = 1800; // 30 minutes

// Tech-focused RSS feeds as proxy for social pulse
const TWITTER_PROXY_RSS = 'https://techcrunch.com/feed/';
const LINKEDIN_PROXY_RSS = 'https://feeds.hbr.org/harvardbusiness';

@Injectable()
export class SocialService {
  constructor(
    @InjectRepository(DigestCache)
    private cacheRepo: Repository<DigestCache>,
  ) {}

  async getPulse(): Promise<SocialPulse> {
    const cacheKey = 'social:pulse';
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const [twitterItems, linkedinItems] = await Promise.all([
        fetchRssFeed(TWITTER_PROXY_RSS),
        fetchRssFeed(LINKEDIN_PROXY_RSS),
      ]);

      const twitter = this.mapToSocialPost(twitterItems[0], '@techcrunch');
      const linkedin = this.mapToSocialPost(linkedinItems[0], 'HBR Editorial');

      const pulse: SocialPulse = {
        twitter: twitter || this.getFallbackTwitter(),
        linkedin: linkedin || this.getFallbackLinkedin(),
      };

      await this.saveCache(cacheKey, pulse);
      return pulse;
    } catch (error) {
      console.error('Social pulse error:', (error as Error).message);
      return this.getFallback();
    }
  }

  private mapToSocialPost(
    item: { title: string; description: string; pubDate: string; creator: string } | undefined,
    defaultAuthor: string,
  ): SocialPost | null {
    if (!item) return null;

    // Truncate to ~120 chars for a tweet-like format
    const text = item.description.length > 120
      ? `"${item.description.substring(0, 117)}..."`
      : `"${item.description}"`;

    return {
      text,
      author: item.creator || defaultAuthor,
      time: item.pubDate ? toRelativeTime(item.pubDate) : '2h ago',
    };
  }

  private getFallbackTwitter(): SocialPost {
    return {
      text: '"Generative AI is shifting from hype to real-world integration in mid-sized enterprises..."',
      author: '@techinsider',
      time: '2h ago',
    };
  }

  private getFallbackLinkedin(): SocialPost {
    return {
      text: '"Thrilled to announce that our team has hit the Q3 targets ahead of schedule. Culture is everything."',
      author: 'Sarah Jenkins',
      time: '4h ago',
    };
  }

  private getFallback(): SocialPulse {
    return { twitter: this.getFallbackTwitter(), linkedin: this.getFallbackLinkedin() };
  }

  private async getFromCache(cacheKey: string): Promise<SocialPulse | null> {
    try {
      const cached = await this.cacheRepo.findOne({
        where: { cacheKey, expiresAt: MoreThan(new Date()) },
      });
      return cached ? JSON.parse(cached.data) : null;
    } catch {
      return null;
    }
  }

  private async saveCache(cacheKey: string, data: SocialPulse): Promise<void> {
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
