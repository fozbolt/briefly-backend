import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import axios from 'axios';
import { DigestCache } from '../../database/entities/digest-cache.entity';
import { TrafficService } from './traffic.service';

jest.mock('axios');

describe('TrafficService', () => {
  let service: TrafficService;

  const mockCacheRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({}),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'apis.tomTom.key': '',
        'apis.tomTom.baseUrl': 'https://api.tomtom.com',
      };
      return config[key] || '';
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrafficService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(DigestCache), useValue: mockCacheRepo },
      ],
    }).compile();

    service = module.get<TrafficService>(TrafficService);
  });

  it('returns route-configuration prompt when inputs are missing', async () => {
    const result = await service.estimateTraffic('', '');
    expect(result.requiresRouteConfiguration).toBe(true);
    expect(result.chipLabel).toBe('Add route');
  });

  it('returns cached snapshot when available', async () => {
    mockCacheRepo.findOne.mockResolvedValueOnce({
      data: JSON.stringify({
        routeLabel: 'Home → Office',
        summary: 'Light traffic on your commute (18 min).',
        chipLabel: '18m • Light',
        trafficLevel: 'Light traffic',
        source: 'tomtom',
        requiresRouteConfiguration: false,
      }),
    });

    const result = await service.estimateTraffic('Home', 'Office');
    expect(result.source).toBe('tomtom');
    expect(result.chipLabel).toBe('18m • Light');
  });

  it('falls back to OSRM estimate when no TomTom key is configured', async () => {
    const mockedAxios = axios as jest.Mocked<typeof axios>;
    mockedAxios.get
      .mockResolvedValueOnce({ data: [{ lat: '46.0569', lon: '14.5058' }] })
      .mockResolvedValueOnce({ data: [{ lat: '46.1199', lon: '14.8153' }] })
      .mockResolvedValueOnce({
        data: {
          routes: [{ duration: 2100, distance: 25000 }],
        },
      });

    const result = await service.estimateTraffic('Ljubljana', 'Novo mesto');
    expect(result.source).toBe('osrm');
    expect(result.trafficLevel).toBe('Estimated drive time');
    expect(result.chipLabel).toContain('Estimate');
  });
});
