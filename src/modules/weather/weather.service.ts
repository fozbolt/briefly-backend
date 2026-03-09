import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import axios from 'axios';
import { Weather } from '../../common/interfaces/frontend-types';
import { DigestCache } from '../../database/entities/digest-cache.entity';

const WEATHER_ICON_MAP: Record<string, string> = {
  '01d': '☀️', '01n': '🌙', '02d': '⛅', '02n': '☁️',
  '03d': '☁️', '03n': '☁️', '04d': '☁️', '04n': '☁️',
  '09d': '🌧️', '09n': '🌧️', '10d': '🌦️', '10n': '🌧️',
  '11d': '⛈️', '11n': '⛈️', '13d': '🌨️', '13n': '🌨️',
  '50d': '🌫️', '50n': '🌫️',
};

const CACHE_TTL = 1800; // 30 minutes

@Injectable()
export class WeatherService {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(DigestCache)
    private cacheRepo: Repository<DigestCache>,
  ) {
    this.apiKey = this.configService.get<string>('apis.openWeatherMap.key') || '';
    this.baseUrl = this.configService.get<string>('apis.openWeatherMap.baseUrl') || '';
  }

  async getWeather(lat: number, lon: number): Promise<Weather> {
    const cacheKey = `weather:${lat.toFixed(2)}:${lon.toFixed(2)}`;

    // Check cache
    const cached = await this.cacheRepo.findOne({
      where: { cacheKey, expiresAt: MoreThan(new Date()) },
    });
    if (cached) {
      return JSON.parse(cached.data);
    }

    // Fetch from OpenWeatherMap
    if (!this.apiKey) {
      return this.getFallbackWeather();
    }

    try {
      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: { lat, lon, appid: this.apiKey, units: 'imperial' },
        timeout: 10000,
      });

      const data = response.data;
      const iconCode = data.weather?.[0]?.icon || '01d';

      const weather: Weather = {
        temp: Math.round(data.main.temp),
        unit: 'F',
        condition: data.weather?.[0]?.main || 'Clear',
        description: `${data.weather?.[0]?.description || 'Clear skies'}. High of ${Math.round(data.main.temp_max)}°.`,
        icon: WEATHER_ICON_MAP[iconCode] || '☀️',
      };

      // Save to cache
      await this.saveCache(cacheKey, weather);
      return weather;
    } catch (error) {
      console.error('OpenWeatherMap API error:', (error as Error).message);
      return this.getFallbackWeather();
    }
  }

  private getFallbackWeather(): Weather {
    return {
      temp: 72,
      unit: 'F',
      condition: 'Partly Cloudy',
      description: 'Weather data temporarily unavailable.',
      icon: '⛅',
    };
  }

  private async saveCache(cacheKey: string, data: Weather): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + CACHE_TTL * 1000);
      const existing = await this.cacheRepo.findOne({ where: { cacheKey } });
      if (existing) {
        existing.data = JSON.stringify(data);
        existing.expiresAt = expiresAt;
        await this.cacheRepo.save(existing);
      } else {
        await this.cacheRepo.save({
          cacheKey,
          data: JSON.stringify(data),
          ttlSeconds: CACHE_TTL,
          expiresAt,
        });
      }
    } catch (error) {
      console.error('Cache save error:', (error as Error).message);
    }
  }
}
