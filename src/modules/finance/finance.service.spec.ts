import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import axios from 'axios';
import { FinanceService } from './finance.service';
import { DigestCache } from '../../database/entities/digest-cache.entity';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FinanceService', () => {
  let service: FinanceService;

  const mockCacheRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({}),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'apis.alphaVantage.key': '', // No key → fallback stocks
        'apis.alphaVantage.baseUrl': 'https://www.alphavantage.co/query',
        'apis.coinGecko.baseUrl': 'https://api.coingecko.com/api/v3',
      };
      return config[key] || '';
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url.includes('/simple/price')) {
        return {
          data: {
            bitcoin: { usd_24h_change: 1.23 },
            ethereum: { usd_24h_change: -0.45 },
          },
        } as any;
      }

      if (url.includes('/chart/')) {
        const symbol = decodeURIComponent(url.split('/chart/')[1] ?? '');
        const mockMap: Record<string, { shortName: string; regularMarketPrice: number; chartPreviousClose: number }> = {
          '^GSPC': { shortName: 'S&P 500', regularMarketPrice: 5050, chartPreviousClose: 5000 },
          '^IXIC': { shortName: 'NASDAQ Composite', regularMarketPrice: 16000, chartPreviousClose: 16100 },
          'BTC-USD': { shortName: 'Bitcoin USD', regularMarketPrice: 68000, chartPreviousClose: 67000 },
        };
        const meta = mockMap[symbol] ?? { shortName: symbol || 'Market', regularMarketPrice: 100, chartPreviousClose: 99 };
        return {
          data: {
            chart: {
              result: [{ meta }],
            },
          },
        } as any;
      }

      return { data: {} } as any;
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(DigestCache), useValue: mockCacheRepo },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch crypto data from provider response', async () => {
    const result = await service.getCrypto();

    expect(Array.isArray(result)).toBe(true);
    const btc = result.find((s) => s.name === 'Bitcoin');
    const eth = result.find((s) => s.name === 'Ethereum');
    expect(btc).toBeDefined();
    expect(eth).toBeDefined();
    expect(btc?.change).toBe('+1.23%');
    expect(eth?.change).toBe('-0.45%');
  });

  it('should return portfolio with correct structure', async () => {
    const result = await service.getPortfolio();

    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('change');
    expect(result).toHaveProperty('stocks');
    expect(typeof result.total).toBe('string');
    expect(typeof result.change).toBe('string');
    expect(Array.isArray(result.stocks)).toBe(true);

    // Should have at least fallback stocks
    expect(result.stocks.length).toBeGreaterThanOrEqual(2);

    for (const stock of result.stocks) {
      expect(stock).toHaveProperty('name');
      expect(stock).toHaveProperty('change');
      expect(stock).toHaveProperty('positive');
      expect(typeof stock.positive).toBe('boolean');
    }
  });

  it('should include fallback stocks when no Alpha Vantage key', async () => {
    const result = await service.getPortfolio();

    // Without API key, portfolio should still include major market indexes.
    const stockNames = result.stocks.map((s) => s.name);
    expect(stockNames).toContain('S&P 500');
    expect(stockNames.some((name) => name.toUpperCase().includes('NASDAQ'))).toBe(true);
  });

  it('should cache portfolio data', async () => {
    await service.getPortfolio();
    expect(mockCacheRepo.save).toHaveBeenCalled();
  });
});
