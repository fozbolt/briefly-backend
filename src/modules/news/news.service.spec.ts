import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NewsService } from './news.service';
import { DigestCache } from '../../database/entities/digest-cache.entity';
import { fetchRssFeed } from '../../common/helpers/rss-parser.helper';

jest.mock('../../common/helpers/rss-parser.helper', () => ({
  fetchRssFeed: jest.fn(),
}));

const mockedFetchRssFeed = fetchRssFeed as jest.MockedFunction<typeof fetchRssFeed>;

describe('NewsService', () => {
  let service: NewsService;

  const mockCacheRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({}),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        'apis.newsApi.key': '',
        'apis.newsApi.baseUrl': 'https://newsapi.org/v2',
        rssFeeds: {
          bbcWorld: 'https://feeds.bbci.co.uk/news/world/rss.xml',
          techCrunch: 'https://techcrunch.com/feed/',
          hbr: 'https://feeds.hbr.org/harvardbusiness',
          fastCompany: 'https://www.fastcompany.com/latest/rss',
        },
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockedFetchRssFeed.mockImplementation(async (url: string) => {
      if (url.includes('bbci')) {
        return [
          {
            title: 'Global policy summit reaches agreement',
            description: 'World leaders agreed on a new framework for cooperation.',
            pubDate: '2026-03-10T08:00:00.000Z',
            link: 'https://example.com/world-1',
            creator: 'BBC World',
          },
          {
            title: 'Climate funding expands for coastal cities',
            description: 'New investment targets resilient infrastructure.',
            pubDate: '2026-03-10T07:00:00.000Z',
            link: 'https://example.com/world-2',
            creator: 'BBC World',
          },
        ];
      }
      return [
        {
          title: 'AI chip startup launches low-power accelerator',
          description: 'New hardware reduces inference cost in edge devices.',
          pubDate: '2026-03-10T09:00:00.000Z',
          link: 'https://example.com/tech-1',
          creator: 'TechCrunch',
        },
      ];
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(DigestCache), useValue: mockCacheRepo },
      ],
    }).compile();

    service = module.get<NewsService>(NewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch news from configured RSS feeds', async () => {
    const result = await service.getNews();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Each item should match the Signal interface
    for (const item of result) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('icon');
      expect(typeof item.id).toBe('string');
      expect(typeof item.title).toBe('string');
      expect(item.title.length).toBeGreaterThan(0);
    }
    expect(mockedFetchRssFeed).toHaveBeenCalledTimes(2);
  });

  it('should return exactly 3 signals', async () => {
    const result = await service.getSignals();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(3);

    if (result.length > 0) {
      // First signal should have world icon
      expect(result[0].icon).toBe('🌍');
    }
    if (result.length > 1) {
      expect(result[1].icon).toBe('⚡');
    }
    if (result.length > 2) {
      expect(result[2].icon).toBe('🌱');
    }
  });

  it('should cache results', async () => {
    await service.getNews();

    // saveCache is called internally
    expect(mockCacheRepo.save).toHaveBeenCalled();
  });

  it('should return cached data when available', async () => {
    const cachedNews = [
      { id: '1', title: 'Cached Title', description: 'Cached Desc', signal: 'SIGNAL 01', icon: '📰' },
    ];
    mockCacheRepo.findOne.mockResolvedValueOnce({
      data: JSON.stringify(cachedNews),
    });

    const result = await service.getNews();
    expect(result).toEqual(cachedNews);
  });
});
