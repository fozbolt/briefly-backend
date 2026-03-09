import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FinanceService } from './finance.service';
import { DigestCache } from '../../database/entities/digest-cache.entity';

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

  it('should fetch real crypto data from CoinGecko', async () => {
    const result = await service.getCrypto();

    expect(Array.isArray(result)).toBe(true);
    // CoinGecko is free, no key needed - should return real data
    if (result.length > 0) {
      const btc = result.find((s) => s.name === 'Bitcoin');
      const eth = result.find((s) => s.name === 'Ethereum');

      if (btc) {
        expect(btc).toHaveProperty('name', 'Bitcoin');
        expect(btc).toHaveProperty('change');
        expect(btc).toHaveProperty('positive');
        expect(typeof btc.change).toBe('string');
        expect(btc.change).toMatch(/[+-]?\d+\.\d+%/);
      }

      if (eth) {
        expect(eth).toHaveProperty('name', 'Ethereum');
      }
    }
  }, 15000);

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
  }, 15000);

  it('should include fallback stocks when no Alpha Vantage key', async () => {
    const result = await service.getPortfolio();

    // Without API key, should have fallback S&P 500 and NASDAQ
    const stockNames = result.stocks.map((s) => s.name);
    expect(stockNames).toContain('S&P 500');
    expect(stockNames).toContain('NASDAQ');
  }, 15000);

  it('should cache portfolio data', async () => {
    await service.getPortfolio();
    expect(mockCacheRepo.save).toHaveBeenCalled();
  }, 15000);
});
