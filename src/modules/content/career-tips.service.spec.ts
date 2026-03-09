import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CareerTipsService } from './career-tips.service';
import { DigestCache } from '../../database/entities/digest-cache.entity';

describe('CareerTipsService', () => {
  let service: CareerTipsService;

  const mockCacheRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({}),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'rssFeeds') {
        return {
          hbr: 'https://feeds.hbr.org/harvardbusiness',
          fastCompany: 'https://www.fastcompany.com/latest/rss',
        };
      }
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CareerTipsService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(DigestCache), useValue: mockCacheRepo },
      ],
    }).compile();

    service = module.get<CareerTipsService>(CareerTipsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch real career tip from RSS feeds', async () => {
    const result = await service.getDailyTip();

    expect(result).toBeDefined();
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('readTime');
    expect(result).toHaveProperty('tag');
    expect(typeof result.title).toBe('string');
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.tag).toBe('PRO TIP');
    expect(result.readTime).toMatch(/\d+ min read/);
  }, 20000);

  it('should cache the career tip', async () => {
    await service.getDailyTip();
    expect(mockCacheRepo.save).toHaveBeenCalled();
  }, 20000);

  it('should return cached tip when available', async () => {
    const cachedTip = {
      title: 'Cached Career Tip',
      readTime: '4 min read',
      tag: 'PRO TIP',
    };
    mockCacheRepo.findOne.mockResolvedValueOnce({
      data: JSON.stringify(cachedTip),
    });

    const result = await service.getDailyTip();
    expect(result).toEqual(cachedTip);
  });
});
