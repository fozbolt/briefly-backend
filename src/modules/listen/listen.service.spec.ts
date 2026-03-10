import { Test, TestingModule } from '@nestjs/testing';
import { ListenService } from './listen.service';
import { WeatherService } from '../weather/weather.service';
import { NewsService } from '../news/news.service';
import { FinanceService } from '../finance/finance.service';
import { BooksService } from '../content/books.service';
import { CareerTipsService } from '../content/career-tips.service';
import { QuotesService } from '../content/quotes.service';
import { SocialService } from '../social/social.service';
import { RecommendationsService } from '../content/recommendations.service';

describe('ListenService', () => {
  let service: ListenService;

  const mockWeather = { getWeather: jest.fn().mockResolvedValue({ temp: 72, unit: 'F', condition: 'Sunny', description: 'Clear skies', icon: '☀️' }) };
  const mockNews = { getSignals: jest.fn().mockResolvedValue([
    { id: '1', title: 'Big Story A', description: 'Details about story A', icon: '🌍' },
    { id: '2', title: 'Tech Update B', description: 'Details about tech B', icon: '⚡' },
    { id: '3', title: 'Climate News C', description: 'Details about climate C', icon: '🌱' },
  ]) };
  const mockFinance = { getPortfolio: jest.fn().mockResolvedValue({
    total: '$42,850.40', change: '+1.84%', stocks: [
      { name: 'S&P 500', change: '+0.85%', positive: true },
      { name: 'NASDAQ', change: '-0.12%', positive: false },
    ],
  }) };
  const mockBooks = { getDailyBook: jest.fn().mockResolvedValue({ title: 'Atomic Habits by James Clear', readTime: '12 min read summary', image: 'url' }) };
  const mockCareerTips = { getDailyTip: jest.fn().mockResolvedValue({ title: 'Remote Communication Mastery', readTime: '3 min read', tag: 'PRO TIP' }) };
  const mockQuotes = { getDailyQuote: jest.fn().mockResolvedValue({ text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' }) };
  const mockSocial = { getPulse: jest.fn().mockResolvedValue({
    twitter: { text: '"AI is transforming everything"', author: '@techinsider', time: '2h ago' },
    linkedin: { text: '"Q3 targets hit ahead of schedule"', author: 'Sarah Jenkins', time: '4h ago' },
  }) };
  const mockRecommendations = { getRecommendations: jest.fn().mockResolvedValue([
    { id: '1', title: 'AI Defense Transform', subtitle: 'Exploring the shift...', interest: 'AI & DEFENSE' },
    { id: '2', title: '15-Minute City Returns', subtitle: 'How mid-sized cities...', interest: 'URBANISM' },
  ]) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListenService,
        { provide: WeatherService, useValue: mockWeather },
        { provide: NewsService, useValue: mockNews },
        { provide: FinanceService, useValue: mockFinance },
        { provide: BooksService, useValue: mockBooks },
        { provide: CareerTipsService, useValue: mockCareerTips },
        { provide: QuotesService, useValue: mockQuotes },
        { provide: SocialService, useValue: mockSocial },
        { provide: RecommendationsService, useValue: mockRecommendations },
      ],
    }).compile();

    service = module.get<ListenService>(ListenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should build narration with all fields', async () => {
    const result = await service.buildNarration('Alex', 40.71, -74.0);

    expect(result).toHaveProperty('script');
    expect(result).toHaveProperty('sections');
    expect(result).toHaveProperty('estimatedDurationSec');
    expect(result).toHaveProperty('generatedAtLabel');
    expect(typeof result.script).toBe('string');
    expect(result.script.length).toBeGreaterThan(100);
    expect(result.estimatedDurationSec).toBeGreaterThan(30);
  });

  it('should start with personalized greeting', async () => {
    const result = await service.buildNarration('Alex');

    expect(result.script).toMatch(/Good (morning|afternoon|evening), Alex/);
    expect(result.script).toContain('Here is your Briefly daily digest');
  });

  it('should include weather data in script', async () => {
    const result = await service.buildNarration('Alex');

    expect(result.script).toContain('72 degrees F');
    expect(result.script).toContain('Sunny');
  });

  it('should include news signals in script', async () => {
    const result = await service.buildNarration('Alex');

    expect(result.script).toContain('Big Story A');
    expect(result.script).toContain('Tech Update B');
    expect(result.script).toContain('Climate News C');
  });

  it('should include finance data in script', async () => {
    const result = await service.buildNarration('Alex');

    expect(result.script).toContain('$42,850.40');
    expect(result.script).toContain('S&P 500');
    expect(result.script).toContain('NASDAQ');
  });

  it('should include social pulse in script', async () => {
    const result = await service.buildNarration('Alex');

    expect(result.script).toContain('@techinsider');
    expect(result.script).toContain('Sarah Jenkins');
  });

  it('should include book recommendation in script', async () => {
    const result = await service.buildNarration('Alex');

    expect(result.script).toContain('Atomic Habits');
  });

  it('should include career tip in script', async () => {
    const result = await service.buildNarration('Alex');

    expect(result.script).toContain('Remote Communication');
  });

  it('should include daily quote in script', async () => {
    const result = await service.buildNarration('Alex');

    expect(result.script).toContain('Steve Jobs');
  });

  it('should include recommendations in script', async () => {
    const result = await service.buildNarration('Alex');

    expect(result.script).toContain('AI Defense Transform');
    expect(result.script).toContain('15-Minute City');
  });

  it('should end with closing statement', async () => {
    const result = await service.buildNarration('Alex');

    expect(result.script).toContain('That concludes your daily Briefly digest');
    expect(result.script).toContain('Have a productive day');
  });

  it('should return 6 sections', async () => {
    const result = await service.buildNarration('Alex');

    expect(result.sections.length).toBe(6);
    expect(result.sections[0].name).toBe('Greeting & Weather');
    expect(result.sections[1].name).toBe('Briefing & Signals');
    expect(result.sections[2].name).toBe('Finance & Markets');
    expect(result.sections[3].name).toBe('Social & Community');
    expect(result.sections[4].name).toBe('Knowledge & Growth');
    expect(result.sections[5].name).toBe('Recommendations & Closing');
  });

  it('should handle service failures gracefully', async () => {
    mockWeather.getWeather.mockRejectedValueOnce(new Error('API down'));
    mockNews.getSignals.mockRejectedValueOnce(new Error('API down'));
    mockFinance.getPortfolio.mockRejectedValueOnce(new Error('API down'));

    const result = await service.buildNarration('Alex');

    // Should still produce a script with greeting and closing
    expect(result.script).toContain('Good');
    expect(result.script).toContain('That concludes');
    expect(result.script.length).toBeGreaterThan(50);
  });

  it('should use default name when not provided', async () => {
    const result = await service.buildNarration();

    expect(result.script).toMatch(/Good (morning|afternoon|evening), there/);
  });
});
