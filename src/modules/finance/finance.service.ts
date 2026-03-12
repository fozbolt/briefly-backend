import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import axios from 'axios';
import { Portfolio, Stock } from '../../common/interfaces/frontend-types';
import { DigestCache } from '../../database/entities/digest-cache.entity';

const CACHE_TTL_PORTFOLIO = 900; // 15 minutes
const CACHE_TTL_CRYPTO = 600; // 10 minutes
const YAHOO_CHART_URL = 'https://query2.finance.yahoo.com/v8/finance/chart';
const DEFAULT_SYMBOLS = ['^GSPC', '^IXIC', 'BTC-USD'];

export interface QuoteSnapshot {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  changePercent: number;
}

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

  async getPortfolio(symbols: string[] = []): Promise<Portfolio> {
    const targetSymbols = symbols.length > 0
      ? symbols.slice(0, 6).map((s) => s.trim().toUpperCase())
      : DEFAULT_SYMBOLS;

    const cacheKey = `finance:portfolio:${targetSymbols.join(',')}`;
    const cached = await this.getFromCache<Portfolio>(cacheKey);
    if (cached) return cached;

    const stocks = (await this.fetchYahooQuoteSnapshots(targetSymbols)).map((snapshot) => ({
      name: snapshot.name,
      change: `${snapshot.changePercent >= 0 ? '+' : ''}${snapshot.changePercent.toFixed(2)}%`,
      positive: snapshot.changePercent >= 0,
    }));

    const totalChange = stocks.length > 0
      ? stocks.reduce((sum, s) => sum + parseFloat(s.change), 0) / stocks.length
      : 0;

    const portfolio: Portfolio = {
      total: `Your assets averaged ${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(2)}% today`,
      change: `${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(2)}%`,
      stocks,
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

  async getQuoteSnapshots(symbols: string[] = []): Promise<QuoteSnapshot[]> {
    const targetSymbols = symbols.length > 0
      ? Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))).slice(0, 50)
      : DEFAULT_SYMBOLS;

    return this.fetchYahooQuoteSnapshots(targetSymbols);
  }

  private async fetchYahooQuoteSnapshots(symbols: string[]): Promise<QuoteSnapshot[]> {
    try {
      const results = await Promise.allSettled(
        symbols.map((symbol) =>
          axios.get(`${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}`, {
            params: { interval: '1d', range: '1d' },
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Briefly/1.0)' },
          }),
        ),
      );

      const snapshots: QuoteSnapshot[] = [];
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        const meta = result.value.data?.chart?.result?.[0]?.meta;
        if (!meta) continue;

        const price = meta.regularMarketPrice ?? 0;
        const prevClose = meta.chartPreviousClose ?? price;
        const pct = prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : 0;

        snapshots.push({
          symbol: String(meta.symbol ?? meta.exchangeName ?? meta.shortName ?? 'MARKET').toUpperCase(),
          name: meta.shortName ?? meta.symbol ?? 'Market',
          price,
          previousClose: prevClose,
          changePercent: pct,
        });
      }

      return snapshots;
    } catch (error) {
      console.error('Yahoo Finance error:', (error as Error).message);
      return [];
    }
  }

  private async fetchStockData(): Promise<Stock[]> {
    return (await this.fetchYahooQuoteSnapshots(DEFAULT_SYMBOLS)).map((snapshot) => ({
      name: snapshot.name,
      change: `${snapshot.changePercent >= 0 ? '+' : ''}${snapshot.changePercent.toFixed(2)}%`,
      positive: snapshot.changePercent >= 0,
    }));
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
