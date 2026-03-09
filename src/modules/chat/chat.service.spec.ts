import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { NewsService } from '../news/news.service';

describe('ChatService', () => {
  let service: ChatService;

  const mockNewsService = {
    getSignals: jest.fn().mockResolvedValue([
      { id: '1', title: 'Top Story A', description: 'Desc A', icon: '🌍' },
      { id: '2', title: 'Top Story B', description: 'Desc B', icon: '⚡' },
      { id: '3', title: 'Top Story C', description: 'Desc C', icon: '🌱' },
    ]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: NewsService, useValue: mockNewsService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should respond to news-related queries', async () => {
    const result = await service.sendMessage('What are the top news today?');

    expect(result).toHaveProperty('message');
    expect(result.message).toContain('Top Story A');
    expect(result.message).toContain('Top Story B');
    expect(result.message).toContain('Top Story C');
  });

  it('should respond to morning digest queries', async () => {
    const result = await service.sendMessage('Show me my morning digest');

    expect(result.message).toContain('morning digest');
  });

  it('should respond to finance queries', async () => {
    const result = await service.sendMessage('How is the market doing?');

    expect(result.message).toContain('portfolio');
  });

  it('should respond to weather queries', async () => {
    const result = await service.sendMessage('What is the weather like?');

    expect(result.message).toContain('weather');
  });

  it('should respond to schedule queries', async () => {
    const result = await service.sendMessage('What meetings do I have today?');

    expect(result.message).toContain('calendar');
  });

  it('should respond to email queries', async () => {
    const result = await service.sendMessage('Check my inbox');

    expect(result.message).toContain('email');
  });

  it('should give generic help for unknown queries', async () => {
    const result = await service.sendMessage('Hello there');

    expect(result.message).toContain('I can help you with');
    expect(result.message).toContain('📰');
  });

  it('should handle news service failure gracefully', async () => {
    mockNewsService.getSignals.mockRejectedValueOnce(new Error('API down'));

    const result = await service.sendMessage('What are the news?');

    expect(result).toHaveProperty('message');
    expect(typeof result.message).toBe('string');
  });
});
