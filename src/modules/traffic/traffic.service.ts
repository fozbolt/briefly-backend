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
  source: 'tomtom' | 'osrm' | 'heuristic' | 'none';
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

interface OpenMeteoGeocodeResponse {
  results?: Array<{
    latitude?: number;
    longitude?: number;
  }>;
}

interface PhotonGeocodeResponse {
  features?: Array<{
    geometry?: {
      coordinates?: [number, number];
    };
  }>;
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
const GEOCODE_TIMEOUT_MS = 4000;
const ROUTE_TIMEOUT_MS = 5000;
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
      // Note: TomTom returns these values in milliseconds, not seconds
      const travelTimeMs = summary?.travelTimeInSeconds;
      const noTrafficTravelTimeMs = summary?.noTrafficTravelTimeInSeconds;
      const trafficDelayMs = summary?.trafficDelayInSeconds;
      if (
        typeof travelTimeMs !== 'number' ||
        typeof noTrafficTravelTimeMs !== 'number'
      ) {
        return null;
      }

      const durationMinutes = this.toMinutes(travelTimeMs / 1000); // Convert milliseconds to seconds first
      const delayRatio =
        noTrafficTravelTimeMs > 0
          ? Math.max(
              0,
              typeof trafficDelayMs === 'number'
                ? trafficDelayMs / 1000
                : (travelTimeMs - noTrafficTravelTimeMs) / 1000,
            ) / (noTrafficTravelTimeMs / 1000)
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
        return this.buildHeuristicEstimate(origin, destination, originCoords, destinationCoords);
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
      return this.buildHeuristicEstimate(origin, destination, originCoords, destinationCoords);
    }
  }

  private async geocode(query: string): Promise<Coordinate | null> {
    for (const candidate of this.buildGeocodeQueries(query)) {
      try {
        const openMeteo = await axios.get<OpenMeteoGeocodeResponse>(
          'https://geocoding-api.open-meteo.com/v1/search',
          {
            params: {
              name: candidate,
              count: 1,
              language: 'en',
              format: 'json',
            },
            timeout: GEOCODE_TIMEOUT_MS,
          },
        );
        const first = openMeteo.data.results?.[0];
        const lat = Number(first?.latitude ?? NaN);
        const lon = Number(first?.longitude ?? NaN);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          return { lat, lon };
        }
      } catch {
        // try the next source
      }

      try {
        const response = await axios.get<NominatimResult[]>(
          'https://nominatim.openstreetmap.org/search',
          {
            params: {
              q: candidate,
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
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          return { lat, lon };
        }
      } catch {
        // try next query
      }

      try {
        const photon = await axios.get<PhotonGeocodeResponse>('https://photon.komoot.io/api/', {
          params: {
            q: candidate,
            limit: 1,
          },
          timeout: GEOCODE_TIMEOUT_MS,
        });

        const coordinates = photon.data.features?.[0]?.geometry?.coordinates;
        const lon = Number(coordinates?.[0] ?? NaN);
        const lat = Number(coordinates?.[1] ?? NaN);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          return { lat, lon };
        }
      } catch {
        // try next query
      }
    }

    return null;
  }

  private buildGeocodeQueries(query: string): string[] {
    const trimmed = query.trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      return [];
    }

    const deAccented = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const withoutPostal = trimmed.replace(/\b\d{4,6}\b/g, ' ').replace(/\s+/g, ' ').trim();
    const asciiWithoutPostal = withoutPostal
      ? withoutPostal.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      : '';

    return [trimmed, withoutPostal, deAccented, asciiWithoutPostal].filter(
      (value, index, list) => value.length > 0 && list.indexOf(value) === index,
    );
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

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }

  private haversineKm(left: Coordinate, right: Coordinate): number {
    const earthRadiusKm = 6371;
    const dLat = this.toRadians(right.lat - left.lat);
    const dLon = this.toRadians(right.lon - left.lon);
    const lat1 = this.toRadians(left.lat);
    const lat2 = this.toRadians(right.lat);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private estimateDriveMinutesFromDistance(distanceKm: number): number {
    const roadMultiplier = distanceKm < 10 ? 1.5 : distanceKm < 40 ? 1.35 : 1.25;
    const adjustedKm = Math.max(1, distanceKm * roadMultiplier);
    const averageSpeedKmh =
      distanceKm < 8 ? 28 : distanceKm < 25 ? 42 : distanceKm < 100 ? 65 : 85;
    return Math.max(5, Math.round((adjustedKm / averageSpeedKmh) * 60));
  }

  private buildHeuristicEstimate(
    origin: string,
    destination: string,
    originCoords: Coordinate,
    destinationCoords: Coordinate,
  ): CommuteTrafficSnapshot {
    const routeLabel = this.formatRouteLabel(origin, destination);
    const distanceKm = this.haversineKm(originCoords, destinationCoords);
    const durationMinutes = this.estimateDriveMinutesFromDistance(distanceKm);
    return {
      routeLabel,
      summary: `Estimated commute time based on route distance (${durationMinutes} min).`,
      chipLabel: `${durationMinutes}m • Estimate`,
      trafficLevel: 'Estimated drive time',
      source: 'heuristic',
      requiresRouteConfiguration: false,
    };
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
