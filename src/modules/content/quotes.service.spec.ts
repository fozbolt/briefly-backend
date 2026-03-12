import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import axios from 'axios';
import { QuotesService } from './quotes.service';
import { DigestCache } from '../../database/entities/digest-cache.entity';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('QuotesService', () => {
  let service: QuotesService;

  const mockCacheRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue({
      data: [{ q: 'Stay hungry, stay foolish.', a: 'Steve Jobs' }],
    } as any);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotesService,
        { provide: getRepositoryToken(DigestCache), useValue: mockCacheRepo },
      ],
    }).compile();

    service = module.get<QuotesService>(QuotesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch daily quote from provider response', async () => {
    const result = await service.getDailyQuote();

    expect(result).toBeDefined();
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('author');
    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(0);
    expect(typeof result.author).toBe('string');
    expect(result.author.length).toBeGreaterThan(0);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://zenquotes.io/api/today',
      expect.objectContaining({ timeout: 10000 }),
    );
  });

  it('should cache the quote', async () => {
    await service.getDailyQuote();
    expect(mockCacheRepo.save).toHaveBeenCalled();
  });

  it('should return cached quote when available', async () => {
    const cachedQuote = {
      text: 'Cached quote text',
      author: 'Cached Author',
    };
    mockCacheRepo.findOne.mockResolvedValueOnce({
      data: JSON.stringify(cachedQuote),
    });

    const result = await service.getDailyQuote();
    expect(result).toEqual(cachedQuote);
  });
});
