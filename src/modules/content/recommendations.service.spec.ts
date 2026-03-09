import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationsService } from './recommendations.service';
import { NewsService } from '../news/news.service';

describe('RecommendationsService', () => {
  let service: RecommendationsService;

  const mockNewsService = {
    getNews: jest.fn().mockResolvedValue([
      { id: '1', title: 'News Title 1', description: 'Description of the first news article which is fairly long text', icon: '📰' },
      { id: '2', title: 'News Title 2', description: 'Description of the second news article', icon: '⚡' },
      { id: '3', title: 'News Title 3', description: 'Description of the third news article about tech', icon: '🔬' },
      { id: '4', title: 'News Title 4', description: 'Fourth article description', icon: '📈' },
      { id: '5', title: 'News Title 5', description: 'Fifth article about climate change', icon: '🌱' },
      { id: '6', title: 'News Title 6', description: 'Sixth article about health', icon: '🏥' },
    ]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        { provide: NewsService, useValue: mockNewsService },
      ],
    }).compile();

    service = module.get<RecommendationsService>(RecommendationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return exactly 3 recommendations', async () => {
    const result = await service.getRecommendations();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(3);
  });

  it('should return recommendations with correct structure', async () => {
    const result = await service.getRecommendations();

    for (const rec of result) {
      expect(rec).toHaveProperty('id');
      expect(rec).toHaveProperty('title');
      expect(rec).toHaveProperty('subtitle');
      expect(rec).toHaveProperty('interest');
      expect(typeof rec.id).toBe('string');
      expect(typeof rec.title).toBe('string');
      expect(typeof rec.subtitle).toBe('string');
      expect(typeof rec.interest).toBe('string');
    }
  });

  it('should assign interest categories', async () => {
    const result = await service.getRecommendations();

    const validCategories = [
      'AI & DEFENSE', 'URBANISM', 'NEUROSCIENCE', 'CLIMATE', 'FINTECH',
      'HEALTH TECH', 'SPACE', 'QUANTUM', 'BIOTECH', 'ENERGY',
    ];

    for (const rec of result) {
      expect(validCategories).toContain(rec.interest);
    }
  });

  it('should truncate long subtitles', async () => {
    const result = await service.getRecommendations();

    for (const rec of result) {
      // Subtitle max is ~83 chars (80 + "...")
      expect(rec.subtitle.length).toBeLessThanOrEqual(83);
    }
  });

  it('should return fallback recommendations when news service fails', async () => {
    mockNewsService.getNews.mockRejectedValueOnce(new Error('Network error'));

    const result = await service.getRecommendations();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(3);
    // Fallback items have specific titles
    expect(result[0].interest).toBe('AI & DEFENSE');
  });
});
