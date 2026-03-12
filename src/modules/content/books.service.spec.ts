import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import axios from 'axios';
import { BooksService } from './books.service';
import { DigestCache } from '../../database/entities/digest-cache.entity';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('BooksService', () => {
  let service: BooksService;

  const mockCacheRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue({
      data: {
        docs: [
          {
            title: 'Deep Work',
            author_name: ['Cal Newport'],
            number_of_pages_median: 320,
            cover_edition_key: 'OL123M',
          },
        ],
      },
    } as any);
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

  it('should fetch book data from provider response', async () => {
    const result = await service.getDailyBook();

    expect(result).toBeDefined();
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('readTime');
    expect(result).toHaveProperty('image');
    expect(typeof result.title).toBe('string');
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.readTime).toMatch(/\d+ min read/);
    expect(result.image).toMatch(/^https?:\/\//);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://openlibrary.org/search.json',
      expect.objectContaining({
        params: expect.objectContaining({ q: 'subject:self-help', sort: 'rating', limit: 10 }),
      }),
    );
  });

  it('should include author in title', async () => {
    const result = await service.getDailyBook();

    // Title should be "Book Title by Author Name"
    expect(result.title).toContain(' by ');
  });

  it('should cache the book', async () => {
    await service.getDailyBook();
    expect(mockCacheRepo.save).toHaveBeenCalled();
  });

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
