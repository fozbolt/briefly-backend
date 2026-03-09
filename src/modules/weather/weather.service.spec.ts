import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WeatherService } from './weather.service';
import { DigestCache } from '../../database/entities/digest-cache.entity';

describe('WeatherService', () => {
  let service: WeatherService;

  const mockCacheRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({}),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'apis.openWeatherMap.key': '', // No API key → will use fallback
        'apis.openWeatherMap.baseUrl': 'https://api.openweathermap.org/data/2.5',
      };
      return config[key] || '';
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeatherService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(DigestCache), useValue: mockCacheRepo },
      ],
    }).compile();

    service = module.get<WeatherService>(WeatherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return fallback weather when no API key configured', async () => {
    const result = await service.getWeather(40.71, -74.0);

    expect(result).toBeDefined();
    expect(result.temp).toBe(72);
    expect(result.unit).toBe('F');
    expect(result.condition).toBe('Partly Cloudy');
    expect(result.icon).toBe('⛅');
    expect(typeof result.description).toBe('string');
  });

  it('should return cached weather when available', async () => {
    const cachedWeather = {
      temp: 65,
      unit: 'F',
      condition: 'Sunny',
      description: 'Beautiful day',
      icon: '☀️',
    };
    mockCacheRepo.findOne.mockResolvedValueOnce({
      data: JSON.stringify(cachedWeather),
    });

    const result = await service.getWeather(40.71, -74.0);

    expect(result).toEqual(cachedWeather);
    expect(mockCacheRepo.findOne).toHaveBeenCalled();
  });

  it('should return Weather interface with all required fields', async () => {
    const result = await service.getWeather(51.5, -0.12);

    expect(result).toHaveProperty('temp');
    expect(result).toHaveProperty('unit');
    expect(result).toHaveProperty('condition');
    expect(result).toHaveProperty('description');
    expect(result).toHaveProperty('icon');
    expect(typeof result.temp).toBe('number');
    expect(typeof result.unit).toBe('string');
    expect(typeof result.condition).toBe('string');
  });
});
