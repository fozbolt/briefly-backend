import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BooksService } from './books.service';
import { DigestCache } from '../../database/entities/digest-cache.entity';

describe('BooksService', () => {
  let service: BooksService;

  const mockCacheRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: getRepositoryToken(DigestCache), useValue: mockCacheRepo },
      ],
    }).compile();

    service = module.get<BooksService>(BooksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch real book data from Open Library', async () => {
    const result = await service.getDailyBook();

    expect(result).toBeDefined();
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('readTime');
    expect(result).toHaveProperty('image');
    expect(typeof result.title).toBe('string');
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.readTime).toMatch(/\d+ min read/);
    expect(result.image).toMatch(/^https?:\/\//);
  }, 20000);

  it('should include author in title', async () => {
    const result = await service.getDailyBook();

    // Title should be "Book Title by Author Name"
    expect(result.title).toContain(' by ');
  }, 20000);

  it('should cache the book', async () => {
    await service.getDailyBook();
    expect(mockCacheRepo.save).toHaveBeenCalled();
  }, 20000);

  it('should return cached book when available', async () => {
    const cachedBook = {
      title: 'Cached Book by Author',
      readTime: '5 min read summary',
      image: 'https://example.com/cover.jpg',
    };
    mockCacheRepo.findOne.mockResolvedValueOnce({
      data: JSON.stringify(cachedBook),
    });

    const result = await service.getDailyBook();
    expect(result).toEqual(cachedBook);
  });
});
