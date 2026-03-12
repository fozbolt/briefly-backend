import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import axios from 'axios';
import { DigestCache } from '../../database/entities/digest-cache.entity';

type TrafficLevel =
  | 'Light traffic'
  | 'Moderate traffic'
  | 'Heavy traffic'
  | 'Estimated drive time'
  | 'Traffic unavailable';

export interface CommuteTrafficSnapshot {
  routeLabel: string;
  summary: string;
  chipLabel: string;
  trafficLevel: TrafficLevel;
  source: 'tomtom' | 'osrm' | 'none';
  requiresRouteConfiguration: boolean;
}

interface Coordinate {
  lat: number;
  lon: number;
}

interface NominatimResult {
  lat?: string;
  lon?: string;
}

interface TomTomRouteResponse {
  routes?: Array<{
    summary?: {
      lengthInMeters?: number;
      travelTimeInSeconds?: number;
      noTrafficTravelTimeInSeconds?: number;
      trafficDelayInSeconds?: number;
    };
  }>;
}

interface OsrmRouteResponse {
  routes?: Array<{
    duration?: number;
    distance?: number;
  }>;
}

const CACHE_TTL_SECONDS = 60;
const GEOCODE_TIMEOUT_MS = 2500;
const ROUTE_TIMEOUT_MS = 3500;
const NOMINATIM_USER_AGENT = 'briefly-backend/1.0 (contact: support@briefly.app)';

@Injectable()
export class TrafficService {
  private readonly tomTomKey: string;
  private readonly tomTomBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(DigestCache)
    private readonly cacheRepo: Repository<DigestCache>,
  ) {
    this.tomTomKey = this.configService.get<string>('apis.tomTom.key') || '';
    this.tomTomBaseUrl =
      this.configService.get<string>('apis.tomTom.baseUrl') ||
      'https://api.tomtom.com';
  }

  async estimateTraffic(
    origin: string,
    destination: string,
  ): Promise<CommuteTrafficSnapshot> {
    const normalizedOrigin = origin.trim();
    const normalizedDestination = destination.trim();
    if (!normalizedOrigin || !normalizedDestination) {
      return {
        routeLabel: '',
        summary: 'Add a commute route in Settings to get live traffic checks.',
        chipLabel: 'Add route',
        trafficLevel: 'Traffic unavailable',
        source: 'none',
        requiresRouteConfiguration: true,
      };
    }

    const cacheKey = `traffic:${normalizedOrigin.toLowerCase()}::${normalizedDestination.toLowerCase()}`;
    const cached = await this.cacheRepo.findOne({
      where: { cacheKey, expiresAt: MoreThan(new Date()) },
    });
    if (cached) {
      return JSON.parse(cached.data) as CommuteTrafficSnapshot;
    }

    const tomTom = await this.fetchTomTomTraffic(normalizedOrigin, normalizedDestination);
    if (tomTom) {
      await this.saveCache(cacheKey, tomTom);
      return tomTom;
    }

    const osrm = await this.fetchOsrmEstimate(normalizedOrigin, normalizedDestination);
    if (osrm) {
      await this.saveCache(cacheKey, osrm);
      return osrm;
    }

    const routeLabel = this.formatRouteLabel(normalizedOrigin, normalizedDestination);
    const unavailable: CommuteTrafficSnapshot = {
      routeLabel,
      summary: `Traffic data is currently unavailable for ${routeLabel}.`,
      chipLabel: 'Traffic n/a',
      trafficLevel: 'Traffic unavailable',
      source: 'none',
      requiresRouteConfiguration: false,
    };
    await this.saveCache(cacheKey, unavailable);
    return unavailable;
  }

  private async fetchTomTomTraffic(
    origin: string,
    destination: string,
  ): Promise<CommuteTrafficSnapshot | null> {
    if (!this.tomTomKey) {
      return null;
    }

    const [originCoords, destinationCoords] = await Promise.all([
      this.geocode(origin),
      this.geocode(destination),
    ]);
    if (!originCoords || !destinationCoords) {
      return null;
    }

    try {
      const response = await axios.get<TomTomRouteResponse>(
        `${this.tomTomBaseUrl}/routing/1/calculateRoute/${originCoords.lat},${originCoords.lon}:${destinationCoords.lat},${destinationCoords.lon}/json`,
        {
          params: {
            traffic: true,
            travelMode: 'car',
            routeType: 'fastest',
            computeTravelTimeFor: 'all',
            key: this.tomTomKey,
          },
          timeout: ROUTE_TIMEOUT_MS,
        },
      );

      const summary = response.data.routes?.[0]?.summary;
      const travelTimeInSeconds = summary?.travelTimeInSeconds;
      const noTrafficTravelTimeInSeconds = summary?.noTrafficTravelTimeInSeconds;
      const trafficDelayInSeconds = summary?.trafficDelayInSeconds;
      if (
        typeof travelTimeInSeconds !== 'number' ||
        typeof noTrafficTravelTimeInSeconds !== 'number'
      ) {
        return null;
      }

      const durationMinutes = this.toMinutes(travelTimeInSeconds);
      const delayRatio =
        noTrafficTravelTimeInSeconds > 0
          ? Math.max(
              0,
              typeof trafficDelayInSeconds === 'number'
                ? trafficDelayInSeconds
                : travelTimeInSeconds - noTrafficTravelTimeInSeconds,
            ) / noTrafficTravelTimeInSeconds
          : 0;
      const trafficLevel = this.classifyByDelay(delayRatio);
      const routeLabel = this.formatRouteLabel(origin, destination);

      return {
        routeLabel,
        summary: `${trafficLevel} on your commute (${durationMinutes} min).`,
        chipLabel: `${durationMinutes}m • ${trafficLevel.replace(' traffic', '')}`,
        trafficLevel,
        source: 'tomtom',
        requiresRouteConfiguration: false,
      };
    } catch {
      return null;
    }
  }

  private async fetchOsrmEstimate(
    origin: string,
    destination: string,
  ): Promise<CommuteTrafficSnapshot | null> {
    const [originCoords, destinationCoords] = await Promise.all([
      this.geocode(origin),
      this.geocode(destination),
    ]);
    if (!originCoords || !destinationCoords) {
      return null;
    }

    try {
      const response = await axios.get<OsrmRouteResponse>(
        `https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destinationCoords.lon},${destinationCoords.lat}`,
        {
          params: { overview: 'false' },
          timeout: ROUTE_TIMEOUT_MS,
        },
      );
      const route = response.data.routes?.[0];
      if (!route?.duration) {
        return null;
      }
      const durationMinutes = this.toMinutes(route.duration);
      const routeLabel = this.formatRouteLabel(origin, destination);
      return {
        routeLabel,
        summary: `Estimated drive time on your commute (${durationMinutes} min).`,
        chipLabel: `${durationMinutes}m • Estimate`,
        trafficLevel: 'Estimated drive time',
        source: 'osrm',
        requiresRouteConfiguration: false,
      };
    } catch {
      return null;
    }
  }

  private async geocode(query: string): Promise<Coordinate | null> {
    try {
      const response = await axios.get<NominatimResult[]>(
        'https://nominatim.openstreetmap.org/search',
        {
          params: {
            q: query,
            format: 'jsonv2',
            limit: 1,
          },
          headers: {
            'User-Agent': NOMINATIM_USER_AGENT,
            'Accept-Language': 'en',
          },
          timeout: GEOCODE_TIMEOUT_MS,
        },
      );

      const first = response.data[0];
      const lat = Number(first?.lat ?? NaN);
      const lon = Number(first?.lon ?? NaN);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
      }
      return { lat, lon };
    } catch {
      return null;
    }
  }

  private classifyByDelay(delayRatio: number): TrafficLevel {
    if (delayRatio >= 0.35) {
      return 'Heavy traffic';
    }
    if (delayRatio >= 0.15) {
      return 'Moderate traffic';
    }
    return 'Light traffic';
  }

  private toMinutes(seconds: number): number {
    return Math.max(1, Math.round(seconds / 60));
  }

  private formatRouteLabel(origin: string, destination: string): string {
    return `${origin.trim()} → ${destination.trim()}`;
  }

  private async saveCache(
    cacheKey: string,
    snapshot: CommuteTrafficSnapshot,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000);
    const existing = await this.cacheRepo.findOne({ where: { cacheKey } });
    if (existing) {
      existing.data = JSON.stringify(snapshot);
      existing.ttlSeconds = CACHE_TTL_SECONDS;
      existing.expiresAt = expiresAt;
      await this.cacheRepo.save(existing);
      return;
    }

    await this.cacheRepo.save({
      cacheKey,
      data: JSON.stringify(snapshot),
      ttlSeconds: CACHE_TTL_SECONDS,
      expiresAt,
    });
  }
}
