import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import axios from 'axios';
import { Book } from '../../common/interfaces/frontend-types';
import { DigestCache } from '../../database/entities/digest-cache.entity';

const CACHE_TTL = 86400; // 24 hours

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(DigestCache)
    private cacheRepo: Repository<DigestCache>,
  ) {}

  async getDailyBook(): Promise<Book> {
    const cacheKey = 'content:book';
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get('https://openlibrary.org/search.json', {
        params: { q: 'subject:self-help', sort: 'rating', limit: 10 },
        timeout: 15000,
      });

      const docs = response.data.docs || [];
      if (docs.length === 0) return this.getFallback();

      // Rotate daily based on date
      const dayOfYear = Math.floor(
        (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
      );
      const doc = docs[dayOfYear % docs.length];

      const authorName = doc.author_name?.[0] || 'Unknown Author';
      const pages = doc.number_of_pages_median || 250;
      const coverKey = doc.cover_edition_key || doc.edition_key?.[0];

      const book: Book = {
        title: `${doc.title} by ${authorName}`,
        readTime: `${Math.ceil(pages / 30)} min read summary`,
        image: coverKey
          ? `https://covers.openlibrary.org/b/olid/${coverKey}-M.jpg`
          : 'https://covers.openlibrary.org/b/id/1-M.jpg',
      };

      await this.saveCache(cacheKey, book);
      return book;
    } catch (error) {
      console.error('Open Library error:', (error as Error).message);
      return this.getFallback();
    }
  }

  private getFallback(): Book {
    return {
      title: 'Atomic Habits by James Clear',
      readTime: '12 min read summary',
      image: 'https://covers.openlibrary.org/b/id/12547191-M.jpg',
    };
  }

  private async getFromCache(cacheKey: string): Promise<Book | null> {
    try {
      const cached = await this.cacheRepo.findOne({
        where: { cacheKey, expiresAt: MoreThan(new Date()) },
      });
      return cached ? JSON.parse(cached.data) : null;
    } catch {
      return null;
    }
  }

  private async saveCache(cacheKey: string, data: Book): Promise<void> {
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
