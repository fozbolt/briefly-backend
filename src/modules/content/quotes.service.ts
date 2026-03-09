import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import axios from 'axios';
import { DigestCache } from '../../database/entities/digest-cache.entity';

export interface Quote {
  text: string;
  author: string;
}

const CACHE_TTL = 86400; // 24 hours

const FALLBACK_QUOTES: Quote[] = [
  { text: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein' },
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
  { text: 'Be yourself; everyone else is already taken.', author: 'Oscar Wilde' },
  { text: 'The mind is everything. What you think you become.', author: 'Buddha' },
  { text: 'Strive not to be a success, but rather to be of value.', author: 'Albert Einstein' },
  { text: 'The only limit to our realization of tomorrow is our doubts of today.', author: 'Franklin D. Roosevelt' },
  { text: 'Life is what happens when you are busy making other plans.', author: 'John Lennon' },
];

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(DigestCache)
    private cacheRepo: Repository<DigestCache>,
  ) {}

  async getDailyQuote(): Promise<Quote> {
    const cacheKey = 'content:quote';
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get('https://zenquotes.io/api/today', {
        timeout: 10000,
      });

      const data = response.data;
      if (Array.isArray(data) && data.length > 0 && data[0].q) {
        const quote: Quote = {
          text: data[0].q,
          author: data[0].a || 'Unknown',
        };
        await this.saveCache(cacheKey, quote);
        return quote;
      }

      return this.getFallback();
    } catch (error) {
      console.error('ZenQuotes error:', (error as Error).message);
      return this.getFallback();
    }
  }

  private getFallback(): Quote {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
    );
    return FALLBACK_QUOTES[dayOfYear % FALLBACK_QUOTES.length];
  }

  private async getFromCache(cacheKey: string): Promise<Quote | null> {
    try {
      const cached = await this.cacheRepo.findOne({
        where: { cacheKey, expiresAt: MoreThan(new Date()) },
      });
      return cached ? JSON.parse(cached.data) : null;
    } catch {
      return null;
    }
  }

  private async saveCache(cacheKey: string, data: Quote): Promise<void> {
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
