import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { NewsService } from '../news/news.service';
import axios from 'axios';

// Mock axios to avoid real LLM calls in tests
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ChatService', () => {
  let service: ChatService;

  const mockNewsService = {
    getSignals: jest.fn().mockResolvedValue([
      { id: '1', title: 'Top Story A', description: 'Desc A', icon: '🌍' },
      { id: '2', title: 'Top Story B', description: 'Desc B', icon: '⚡' },
      { id: '3', title: 'Top Story C', description: 'Desc C', icon: '🌱' },
    ]),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'llm.baseUrl': 'https://text.pollinations.ai',
        'llm.model': 'openai-fast',
      };
      return config[key] || '';
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: NewsService, useValue: mockNewsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call free LLM and return response', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: 'Here is my helpful answer about quantum computing.',
    });

    const result = await service.sendMessage('Explain quantum computing');

    expect(result).toHaveProperty('message');
    expect(result.message).toContain('quantum computing');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('should accept conversation history', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: 'Here is a follow-up response.',
    });

    const history = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there!' },
    ];

    const result = await service.sendMessage('Tell me more', history);

    expect(result).toHaveProperty('message');
    // Check that history is included in the prompt
    const callArg = mockedAxios.get.mock.calls[0][0] as string;
    expect(decodeURIComponent(callArg)).toContain('Hello');
  });

  it('should fall back to keyword responses when LLM fails', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('LLM unavailable'));

    const result = await service.sendMessage('What are the top news today?');

    expect(result).toHaveProperty('message');
    // Falls back to keyword handler which calls news service
    expect(result.message).toContain('Top Story A');
  });

  it('should fall back for finance queries when LLM fails', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('LLM unavailable'));

    const result = await service.sendMessage('How is the market doing?');

    expect(result.message).toMatch(/portfolio|Finance/i);
  });

  it('should fall back for weather queries when LLM fails', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('LLM unavailable'));

    const result = await service.sendMessage('What is the weather like?');

    expect(result.message).toMatch(/weather|Daily Pulse/i);
  });

  it('should fall back for schedule queries when LLM fails', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('LLM unavailable'));

    const result = await service.sendMessage('What meetings do I have today?');

    expect(result.message).toMatch(/calendar|Upcoming Tasks/i);
  });

  it('should fall back for email queries when LLM fails', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('LLM unavailable'));

    const result = await service.sendMessage('Check my inbox');

    expect(result.message).toMatch(/email|Email Summaries/i);
  });

  it('should handle empty message', async () => {
    const result = await service.sendMessage('');

    expect(result.message).toBe('Send any question and I will answer it.');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('should clean response prefixes', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: 'Assistant: Here is the cleaned response.',
    });

    const result = await service.sendMessage('Test');

    expect(result.message).toBe('Here is the cleaned response.');
  });

  it('should handle null LLM response and fall back', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: '',
    });

    const result = await service.sendMessage('Hello there');

    expect(result).toHaveProperty('message');
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });
});
