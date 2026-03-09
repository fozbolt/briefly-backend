import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import axios from 'axios';
import { Signal } from '../../common/interfaces/frontend-types';
import { DigestCache } from '../../database/entities/digest-cache.entity';
import { fetchRssFeed } from '../../common/helpers/rss-parser.helper';
import { v4 as uuid } from 'uuid';

const CATEGORY_ICONS: Record<string, string> = {
  world: '🌍',
  tech: '⚡',
  science: '🔬',
  climate: '🌱',
  economy: '📈',
  politics: '🏛️',
  health: '🏥',
  default: '📰',
};

const CACHE_TTL_SIGNALS = 900; // 15 minutes
const CACHE_TTL_NEWS = 600; // 10 minutes

@Injectable()
export class NewsService {
  private readonly newsApiKey: string;
  private readonly newsApiBaseUrl: string;
  private readonly rssFeeds: Record<string, string>;

  constructor(
    private configService: ConfigService,
    @InjectRepository(DigestCache)
    private cacheRepo: Repository<DigestCache>,
  ) {
    this.newsApiKey = this.configService.get<string>('apis.newsApi.key') || '';
    this.newsApiBaseUrl = this.configService.get<string>('apis.newsApi.baseUrl') || '';
    this.rssFeeds = this.configService.get<Record<string, string>>('rssFeeds') || {};
  }

  async getNews(): Promise<Signal[]> {
    const cacheKey = 'news:all';
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    const items = await this.fetchAllSources();
    await this.saveCache(cacheKey, items, CACHE_TTL_NEWS);
    return items;
  }

  async getSignals(): Promise<Signal[]> {
    const cacheKey = 'news:signals';
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    const allItems = await this.fetchAllSources();
    const signals = this.selectTopSignals(allItems);
    await this.saveCache(cacheKey, signals, CACHE_TTL_SIGNALS);
    return signals;
  }

  private async fetchAllSources(): Promise<Signal[]> {
    const results = await Promise.allSettled([
      this.fetchNewsApi(),
      this.fetchRss('bbcWorld'),
      this.fetchRss('techCrunch'),
    ]);

    const allItems: Signal[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    }

    return allItems;
  }

  private async fetchNewsApi(): Promise<Signal[]> {
    if (!this.newsApiKey) return [];

    try {
      const response = await axios.get(`${this.newsApiBaseUrl}/top-headlines`, {
        params: { country: 'us', pageSize: 10, apiKey: this.newsApiKey },
        timeout: 10000,
      });

      return (response.data.articles || []).map((article: any, index: number) => ({
        id: uuid(),
        title: article.title || '',
        description: article.description || '',
        signal: `SIGNAL ${String(index + 1).padStart(2, '0')}`,
        icon: this.categorizeIcon(article.title || '', article.description || ''),
      }));
    } catch (error) {
      console.error('NewsAPI error:', (error as Error).message);
      return [];
    }
  }

  private async fetchRss(feedKey: string): Promise<Signal[]> {
    const url = this.rssFeeds[feedKey];
    if (!url) return [];

    const items = await fetchRssFeed(url);
    return items.slice(0, 5).map((item, index) => ({
      id: uuid(),
      title: item.title,
      description: item.description.substring(0, 200),
      signal: `SIGNAL ${String(index + 1).padStart(2, '0')}`,
      icon: this.categorizeIcon(item.title, item.description),
    }));
  }

  private selectTopSignals(items: Signal[]): Signal[] {
    // Pick top 3 diverse items
    const selected = items.slice(0, 3);
    return selected.map((item, index) => ({
      ...item,
      signal: `SIGNAL ${String(index + 1).padStart(2, '0')}`,
      icon: index === 0 ? '🌍' : index === 1 ? '⚡' : '🌱',
    }));
  }

  private categorizeIcon(title: string, description: string): string {
    const text = `${title} ${description}`.toLowerCase();
    if (text.match(/climate|environment|green|carbon/)) return CATEGORY_ICONS.climate;
    if (text.match(/tech|ai|software|digital|cyber/)) return CATEGORY_ICONS.tech;
    if (text.match(/science|research|study|discover/)) return CATEGORY_ICONS.science;
    if (text.match(/economy|market|trade|gdp|inflation/)) return CATEGORY_ICONS.economy;
    if (text.match(/politic|government|election|congress/)) return CATEGORY_ICONS.politics;
    if (text.match(/health|medical|covid|vaccine/)) return CATEGORY_ICONS.health;
    return CATEGORY_ICONS.default;
  }

  private async getFromCache(cacheKey: string): Promise<Signal[] | null> {
    try {
      const cached = await this.cacheRepo.findOne({
        where: { cacheKey, expiresAt: MoreThan(new Date()) },
      });
      return cached ? JSON.parse(cached.data) : null;
    } catch {
      return null;
    }
  }

  private async saveCache(cacheKey: string, data: Signal[], ttl: number): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttl * 1000);
      const existing = await this.cacheRepo.findOne({ where: { cacheKey } });
      if (existing) {
        existing.data = JSON.stringify(data);
        existing.expiresAt = expiresAt;
        await this.cacheRepo.save(existing);
      } else {
        await this.cacheRepo.save({ cacheKey, data: JSON.stringify(data), ttlSeconds: ttl, expiresAt });
      }
    } catch (error) {
      console.error('Cache save error:', (error as Error).message);
    }
  }
}
