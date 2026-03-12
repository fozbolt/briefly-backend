import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SocialService } from './social.service';
import { DigestCache } from '../../database/entities/digest-cache.entity';
import { fetchRssFeed } from '../../common/helpers/rss-parser.helper';

jest.mock('../../common/helpers/rss-parser.helper', () => ({
  fetchRssFeed: jest.fn(),
}));

const mockedFetchRssFeed = fetchRssFeed as jest.MockedFunction<typeof fetchRssFeed>;

describe('SocialService', () => {
  let service: SocialService;

  const mockCacheRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockedFetchRssFeed.mockImplementation(async (url: string) => {
      if (url.includes('techcrunch')) {
        return [
          {
            title: 'Edge AI becomes mainstream',
            description: 'Chip vendors are racing to optimize low-power inference on edge devices.',
            pubDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            link: 'https://example.com/tc-1',
            creator: '@techcrunch',
          },
        ];
      }
      return [
        {
          title: 'Leadership habits that scale',
          description: 'Leaders need repeatable communication cadences as teams grow.',
          pubDate: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          link: 'https://example.com/hbr-1',
          creator: 'HBR Editorial',
        },
      ];
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialService,
        { provide: getRepositoryToken(DigestCache), useValue: mockCacheRepo },
      ],
    }).compile();

    service = module.get<SocialService>(SocialService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch social pulse from RSS feeds', async () => {
    const result = await service.getPulse();

    expect(result).toBeDefined();
    expect(result).toHaveProperty('twitter');
    expect(result).toHaveProperty('linkedin');

    // Twitter post
    expect(result.twitter).toHaveProperty('text');
    expect(result.twitter).toHaveProperty('author');
    expect(result.twitter).toHaveProperty('time');
    expect(typeof result.twitter.text).toBe('string');
    expect(result.twitter.text.length).toBeGreaterThan(0);

    // LinkedIn post
    expect(result.linkedin).toHaveProperty('text');
    expect(result.linkedin).toHaveProperty('author');
    expect(result.linkedin).toHaveProperty('time');
    expect(typeof result.linkedin.text).toBe('string');
    expect(mockedFetchRssFeed).toHaveBeenCalledTimes(2);
  });

  it('should include time info in social posts', async () => {
    const result = await service.getPulse();

    // Time should be relative (e.g., "2h ago", "5m ago") or fallback format
    expect(typeof result.twitter.time).toBe('string');
    expect(result.twitter.time).toMatch(/\d+[smhd] ago/);
    expect(typeof result.linkedin.time).toBe('string');
    expect(result.linkedin.time).toMatch(/\d+[smhd] ago/);
  });

  it('should cache the social pulse', async () => {
    await service.getPulse();
    expect(mockCacheRepo.save).toHaveBeenCalled();
  });
});
