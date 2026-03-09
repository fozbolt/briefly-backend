import { Test, TestingModule } from '@nestjs/testing';
import { DigestService } from './digest.service';
import { WeatherService } from '../weather/weather.service';
import { NewsService } from '../news/news.service';
import { FinanceService } from '../finance/finance.service';
import { BooksService } from '../content/books.service';
import { CareerTipsService } from '../content/career-tips.service';
import { SocialService } from '../social/social.service';
import { RecommendationsService } from '../content/recommendations.service';

describe('DigestService', () => {
  let service: DigestService;

  const mockWeatherService = {
    getWeather: jest.fn().mockResolvedValue({
      temp: 72, unit: 'F', condition: 'Sunny', description: 'Clear skies', icon: '☀️',
    }),
  };

  const mockNewsService = {
    getSignals: jest.fn().mockResolvedValue([
      { id: '1', title: 'Signal 1', description: 'Desc', icon: '🌍' },
    ]),
  };

  const mockFinanceService = {
    getPortfolio: jest.fn().mockResolvedValue({
      total: '$42,850.40', change: '+1.84%', stocks: [
        { name: 'S&P 500', change: '+0.85%', positive: true },
      ],
    }),
  };

  const mockBooksService = {
    getDailyBook: jest.fn().mockResolvedValue({
      title: 'Test Book by Author', readTime: '8 min read summary', image: 'https://example.com/cover.jpg',
    }),
  };

  const mockCareerTipsService = {
    getDailyTip: jest.fn().mockResolvedValue({
      title: 'Test Career Tip', readTime: '3 min read', tag: 'PRO TIP',
    }),
  };

  const mockSocialService = {
    getPulse: jest.fn().mockResolvedValue({
      twitter: { text: 'Tweet text', author: '@user', time: '2h ago' },
      linkedin: { text: 'LinkedIn post', author: 'Person', time: '4h ago' },
    }),
  };

  const mockRecommendationsService = {
    getRecommendations: jest.fn().mockResolvedValue([
      { id: '1', title: 'Rec 1', subtitle: 'Sub 1', interest: 'AI & DEFENSE' },
    ]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DigestService,
        { provide: WeatherService, useValue: mockWeatherService },
        { provide: NewsService, useValue: mockNewsService },
        { provide: FinanceService, useValue: mockFinanceService },
        { provide: BooksService, useValue: mockBooksService },
        { provide: CareerTipsService, useValue: mockCareerTipsService },
        { provide: SocialService, useValue: mockSocialService },
        { provide: RecommendationsService, useValue: mockRecommendationsService },
      ],
    }).compile();

    service = module.get<DigestService>(DigestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return full digest with all fields', async () => {
    const result = await service.getFullDigest(40.71, -74.0);

    expect(result).toHaveProperty('weather');
    expect(result).toHaveProperty('tasks');
    expect(result).toHaveProperty('emails');
    expect(result).toHaveProperty('signals');
    expect(result).toHaveProperty('portfolio');
    expect(result).toHaveProperty('book');
    expect(result).toHaveProperty('careerTip');
    expect(result).toHaveProperty('socialPulse');
    expect(result).toHaveProperty('recommendations');
    expect(result).toHaveProperty('generatedAt');
  });

  it('should include weather data', async () => {
    const result = await service.getFullDigest();

    expect(result.weather).toBeDefined();
    expect(result.weather!.temp).toBe(72);
    expect(result.weather!.condition).toBe('Sunny');
  });

  it('should include news signals', async () => {
    const result = await service.getFullDigest();

    expect(Array.isArray(result.signals)).toBe(true);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('should include portfolio data', async () => {
    const result = await service.getFullDigest();

    expect(result.portfolio).toBeDefined();
    expect(result.portfolio!.total).toBe('$42,850.40');
  });

  it('should include book recommendation', async () => {
    const result = await service.getFullDigest();

    expect(result.book).toBeDefined();
    expect(result.book!.title).toContain('Test Book');
  });

  it('should return empty tasks and emails (Phase 2)', async () => {
    const result = await service.getFullDigest();

    expect(result.tasks).toEqual([]);
    expect(result.emails).toEqual([]);
  });

  it('should have valid generatedAt timestamp', async () => {
    const before = new Date().toISOString();
    const result = await service.getFullDigest();
    const after = new Date().toISOString();

    expect(result.generatedAt >= before).toBe(true);
    expect(result.generatedAt <= after).toBe(true);
  });

  it('should handle service failures gracefully', async () => {
    mockWeatherService.getWeather.mockRejectedValueOnce(new Error('API down'));
    mockNewsService.getSignals.mockRejectedValueOnce(new Error('API down'));
    mockFinanceService.getPortfolio.mockRejectedValueOnce(new Error('API down'));

    const result = await service.getFullDigest();

    // Failed services return null/empty
    expect(result.weather).toBeNull();
    expect(result.signals).toEqual([]);
    expect(result.portfolio).toBeNull();
    // Other services should still work
    expect(result.book).toBeDefined();
    expect(result.careerTip).toBeDefined();
    expect(result.generatedAt).toBeDefined();
  });

  it('should call all services in parallel', async () => {
    await service.getFullDigest(40.71, -74.0);

    expect(mockWeatherService.getWeather).toHaveBeenCalledWith(40.71, -74.0);
    expect(mockNewsService.getSignals).toHaveBeenCalled();
    expect(mockFinanceService.getPortfolio).toHaveBeenCalled();
    expect(mockBooksService.getDailyBook).toHaveBeenCalled();
    expect(mockCareerTipsService.getDailyTip).toHaveBeenCalled();
    expect(mockSocialService.getPulse).toHaveBeenCalled();
    expect(mockRecommendationsService.getRecommendations).toHaveBeenCalled();
  });
});
