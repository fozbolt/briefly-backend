import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import axios from 'axios';
import { Portfolio, Stock } from '../../common/interfaces/frontend-types';
import { DigestCache } from '../../database/entities/digest-cache.entity';

const CACHE_TTL_PORTFOLIO = 7200; // 2 hours (Alpha Vantage: 25 calls/day)
const CACHE_TTL_CRYPTO = 600; // 10 minutes

@Injectable()
export class FinanceService {
  private readonly alphaVantageKey: string;
  private readonly alphaVantageUrl: string;
  private readonly coinGeckoUrl: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(DigestCache)
    private cacheRepo: Repository<DigestCache>,
  ) {
    this.alphaVantageKey = this.configService.get<string>('apis.alphaVantage.key') || '';
    this.alphaVantageUrl = this.configService.get<string>('apis.alphaVantage.baseUrl') || '';
    this.coinGeckoUrl = this.configService.get<string>('apis.coinGecko.baseUrl') || '';
  }

  async getPortfolio(): Promise<Portfolio> {
    const cacheKey = 'finance:portfolio';
    const cached = await this.getFromCache<Portfolio>(cacheKey);
    if (cached) return cached;

    const stocks = await this.fetchStockData();
    const crypto = await this.fetchCryptoData();

    const allStocks = [...stocks, ...crypto];
    const totalChange = allStocks.length > 0
      ? allStocks.reduce((sum, s) => sum + parseFloat(s.change), 0) / allStocks.length
      : 0;

    const portfolio: Portfolio = {
      total: '$42,850.40',
      change: `${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(2)}%`,
      stocks: allStocks,
    };

    await this.saveCache(cacheKey, portfolio, CACHE_TTL_PORTFOLIO);
    return portfolio;
  }

  async getCrypto(): Promise<Stock[]> {
    const cacheKey = 'finance:crypto';
    const cached = await this.getFromCache<Stock[]>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchCryptoData();
    await this.saveCache(cacheKey, data, CACHE_TTL_CRYPTO);
    return data;
  }

  private async fetchStockData(): Promise<Stock[]> {
    if (!this.alphaVantageKey) {
      return this.getFallbackStocks();
    }

    const symbols = ['SPY', 'QQQ'];
    const names: Record<string, string> = { SPY: 'S&P 500', QQQ: 'NASDAQ' };

    try {
      const results = await Promise.allSettled(
        symbols.map((symbol) =>
          axios.get(this.alphaVantageUrl, {
            params: { function: 'GLOBAL_QUOTE', symbol, apikey: this.alphaVantageKey },
            timeout: 10000,
          }),
        ),
      );

      const stocks: Stock[] = [];
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          const quote = result.value.data['Global Quote'];
          if (quote && quote['10. change percent']) {
            const changeStr = quote['10. change percent'].replace('%', '');
            const change = parseFloat(changeStr);
            stocks.push({
              name: names[symbols[i]] || symbols[i],
              change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
              positive: change >= 0,
            });
          }
        }
      });

      return stocks.length > 0 ? stocks : this.getFallbackStocks();
    } catch (error) {
      console.error('Alpha Vantage error:', (error as Error).message);
      return this.getFallbackStocks();
    }
  }

  private async fetchCryptoData(): Promise<Stock[]> {
    try {
      const response = await axios.get(`${this.coinGeckoUrl}/simple/price`, {
        params: {
          ids: 'bitcoin,ethereum',
          vs_currencies: 'usd',
          include_24hr_change: 'true',
        },
        timeout: 10000,
      });

      const data = response.data;
      const stocks: Stock[] = [];

      if (data.bitcoin) {
        const change = data.bitcoin.usd_24h_change || 0;
        stocks.push({
          name: 'Bitcoin',
          change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
          positive: change >= 0,
        });
      }
      if (data.ethereum) {
        const change = data.ethereum.usd_24h_change || 0;
        stocks.push({
          name: 'Ethereum',
          change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
          positive: change >= 0,
        });
      }

      return stocks;
    } catch (error) {
      console.error('CoinGecko error:', (error as Error).message);
      return [];
    }
  }

  private getFallbackStocks(): Stock[] {
    return [
      { name: 'S&P 500', change: '+0.85%', positive: true },
      { name: 'NASDAQ', change: '-0.12%', positive: false },
    ];
  }

  private async getFromCache<T>(cacheKey: string): Promise<T | null> {
    try {
      const cached = await this.cacheRepo.findOne({
        where: { cacheKey, expiresAt: MoreThan(new Date()) },
      });
      return cached ? JSON.parse(cached.data) : null;
    } catch {
      return null;
    }
  }

  private async saveCache(cacheKey: string, data: unknown, ttl: number): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttl * 1000);
      const existing = await this.cacheRepo.findOne({ where: { cacheKey } });
      if (existing) {
        existing.data = JSON.stringify(data);
        existing.expiresAt = expiresAt;
        await this.cacheRepo.save(existing);
      } else {
        await this.cacheRepo.save({ cacheKey, data: JSON.stringify(data), ttlSeconds: ttl, expiresAt });
      }
    } catch (error) {
      console.error('Cache save error:', (error as Error).message);
    }
  }
}
