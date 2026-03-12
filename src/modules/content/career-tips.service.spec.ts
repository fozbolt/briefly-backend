import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CareerTipsService } from './career-tips.service';
import { DigestCache } from '../../database/entities/digest-cache.entity';
import { fetchRssFeed } from '../../common/helpers/rss-parser.helper';

jest.mock('../../common/helpers/rss-parser.helper', () => ({
  fetchRssFeed: jest.fn(),
}));

const mockedFetchRssFeed = fetchRssFeed as jest.MockedFunction<typeof fetchRssFeed>;

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
    mockedFetchRssFeed.mockImplementation(async (url: string) => {
      if (url.includes('hbr')) {
        return [
          {
            title: 'Lead with clear priorities',
            description: 'A practical guide for managers to align teams around outcomes.',
            pubDate: '2026-03-10T08:00:00.000Z',
            link: 'https://example.com/hbr-1',
            creator: 'Harvard Business Review',
          },
        ];
      }
      return [
        {
          title: 'How to run focused one-on-ones',
          description: 'Framework for better coaching conversations.',
          pubDate: '2026-03-10T09:00:00.000Z',
          link: 'https://example.com/fc-1',
          creator: 'Fast Company',
        },
      ];
    });
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

  it('should fetch career tip from RSS feeds', async () => {
    const result = await service.getDailyTip();

    expect(result).toBeDefined();
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('readTime');
    expect(result).toHaveProperty('tag');
    expect(typeof result.title).toBe('string');
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.tag).toBe('PRO TIP');
    expect(result.readTime).toMatch(/\d+ min read/);
    expect(mockedFetchRssFeed).toHaveBeenCalledTimes(2);
  });

  it('should cache the career tip', async () => {
    await service.getDailyTip();
    expect(mockCacheRepo.save).toHaveBeenCalled();
  });

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
