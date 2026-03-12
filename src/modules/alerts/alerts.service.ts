import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { In, Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { UserPreference } from '../../database/entities/user-preference.entity';
import { PushDevice } from '../../database/entities/push-device.entity';
import { FinanceService, type QuoteSnapshot } from '../finance/finance.service';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';
import { UpdatePriceAlertSettingsDto } from './dto/update-price-alert-settings.dto';

type AlertDirection = 'up' | 'down';

type AlertStateRecord = Record<
  string,
  {
    baselinePrice: number;
    lastPrice: number;
    lastTriggeredAt?: string | null;
    lastDirection?: AlertDirection | null;
  }
>;

interface TriggeredAsset {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  direction: AlertDirection;
}

interface ExpoPushTicket {
  status?: 'ok' | 'error';
  details?: {
    error?: string;
  };
}

interface ExpoPushResponse {
  data?: ExpoPushTicket[];
}

export interface PriceAlertSettingsResponse {
  enabled: boolean;
  thresholdPercent: number;
  trackedAssets: string[];
  devicesRegistered: number;
}

@Injectable()
export class AlertsService implements OnModuleInit, OnModuleDestroy {
  private readonly pollingEnabled: boolean;
  private readonly pollIntervalMs: number;
  private readonly defaultThresholdPercent: number;
  private readonly expoPushUrl: string;
  private readonly expoAccessToken: string;
  private pollTimer: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserPreference)
    private readonly preferenceRepo: Repository<UserPreference>,
    @InjectRepository(PushDevice)
    private readonly deviceRepo: Repository<PushDevice>,
    private readonly configService: ConfigService,
    private readonly financeService: FinanceService,
  ) {
    this.pollingEnabled = Boolean(this.configService.get<boolean>('priceAlerts.enabled'));
    this.pollIntervalMs = Math.max(
      60_000,
      this.configService.get<number>('priceAlerts.pollIntervalMs') ?? 300_000,
    );
    this.defaultThresholdPercent = Math.min(
      25,
      Math.max(0.5, this.configService.get<number>('priceAlerts.defaultThresholdPercent') ?? 3),
    );
    this.expoPushUrl =
      this.configService.get<string>('priceAlerts.expoPushUrl') ||
      'https://exp.host/--/api/v2/push/send';
    this.expoAccessToken =
      this.configService.get<string>('priceAlerts.expoAccessToken') || '';
  }

  onModuleInit(): void {
    if (!this.pollingEnabled) {
      return;
    }

    this.pollTimer = setInterval(() => {
      void this.checkPriceAlertsNow();
    }, this.pollIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async getPriceAlertSettings(userId: string): Promise<PriceAlertSettingsResponse> {
    const [preference, deviceCount] = await Promise.all([
      this.getOrCreatePreference(userId),
      this.deviceRepo.count({ where: { user: { id: userId } } }),
    ]);

    return this.toSettingsResponse(preference, deviceCount);
  }

  async updatePriceAlertSettings(
    userId: string,
    payload: UpdatePriceAlertSettingsDto,
  ): Promise<PriceAlertSettingsResponse> {
    const preference = await this.getOrCreatePreference(userId);
    const nextTrackedAssets =
      payload.trackedAssets !== undefined
        ? this.normalizeTrackedAssets(payload.trackedAssets)
        : this.normalizeTrackedAssets(preference.trackedAssets ?? []);
    const nextThreshold =
      payload.thresholdPercent !== undefined
        ? this.normalizeThresholdPercent(payload.thresholdPercent)
        : this.normalizeThresholdPercent(preference.priceAlertThresholdPercent);
    const nextEnabled =
      payload.enabled !== undefined ? Boolean(payload.enabled) : Boolean(preference.priceAlertsEnabled);

    const trackedAssetsChanged =
      JSON.stringify(nextTrackedAssets) !==
      JSON.stringify(this.normalizeTrackedAssets(preference.trackedAssets ?? []));
    const thresholdChanged =
      nextThreshold !== this.normalizeThresholdPercent(preference.priceAlertThresholdPercent);
    const enabledChanged = nextEnabled !== Boolean(preference.priceAlertsEnabled);

    preference.trackedAssets = nextTrackedAssets;
    preference.priceAlertsEnabled = nextEnabled;
    preference.priceAlertThresholdPercent = nextThreshold;
    if (trackedAssetsChanged || thresholdChanged || enabledChanged) {
      preference.priceAlertState = {};
    }

    await this.preferenceRepo.save(preference);

    const deviceCount = await this.deviceRepo.count({ where: { user: { id: userId } } });
    return this.toSettingsResponse(preference, deviceCount);
  }

  async registerPushDevice(
    userId: string,
    payload: RegisterPushDeviceDto,
  ): Promise<{ registered: true; devices: number }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User account not found.');
    }

    const expoPushToken = payload.expoPushToken.trim();
    const platform = payload.platform?.trim() || 'unknown';
    const existing = await this.deviceRepo.findOne({ where: { expoPushToken } });

    if (existing) {
      existing.user = user;
      existing.platform = platform;
      await this.deviceRepo.save(existing);
    } else {
      await this.deviceRepo.save(
        this.deviceRepo.create({
          user,
          expoPushToken,
          platform,
        }),
      );
    }

    const devices = await this.deviceRepo.count({ where: { user: { id: userId } } });
    return { registered: true, devices };
  }

  async removePushDevice(
    userId: string,
    expoPushToken: string,
  ): Promise<{ removed: true; devices: number }> {
    await this.deviceRepo.delete({
      expoPushToken: expoPushToken.trim(),
      user: { id: userId },
    });

    const devices = await this.deviceRepo.count({ where: { user: { id: userId } } });
    return { removed: true, devices };
  }

  async sendTestNotification(userId: string): Promise<{ sent: true; devices: number }> {
    const devices = await this.deviceRepo.find({ where: { user: { id: userId } } });
    if (devices.length === 0) {
      throw new BadRequestException('No registered push devices for this account.');
    }

    await this.sendPushToDevices(
      devices,
      'Briefly price alerts are live',
      'You will now receive push notifications when tracked assets move beyond your threshold.',
      {
        type: 'price-alert-test',
      },
    );

    return { sent: true, devices: devices.length };
  }

  async checkPriceAlertsNow(): Promise<{ processedUsers: number; sentNotifications: number }> {
    if (this.isPolling) {
      return { processedUsers: 0, sentNotifications: 0 };
    }
    this.isPolling = true;

    try {
      const preferences = await this.preferenceRepo.find({
        where: { priceAlertsEnabled: true },
        relations: { user: true },
      });
      if (preferences.length === 0) {
        return { processedUsers: 0, sentNotifications: 0 };
      }

      const activePreferences = preferences.filter(
        (preference) => this.normalizeTrackedAssets(preference.trackedAssets ?? []).length > 0,
      );
      if (activePreferences.length === 0) {
        return { processedUsers: 0, sentNotifications: 0 };
      }

      const userIds = activePreferences.map((preference) => preference.user?.id).filter(Boolean) as string[];
      const devices = await this.deviceRepo.find({
        where: { user: { id: In(userIds) } },
        relations: { user: true },
      });
      const devicesByUserId = new Map<string, PushDevice[]>();
      for (const device of devices) {
        const bucket = devicesByUserId.get(device.user.id) ?? [];
        bucket.push(device);
        devicesByUserId.set(device.user.id, bucket);
      }

      const preferencesWithDevices = activePreferences.filter((preference) =>
        (devicesByUserId.get(preference.user.id) ?? []).length > 0,
      );
      if (preferencesWithDevices.length === 0) {
        return { processedUsers: 0, sentNotifications: 0 };
      }

      const trackedSymbols = Array.from(
        new Set(
          preferencesWithDevices.flatMap((preference) =>
            this.normalizeTrackedAssets(preference.trackedAssets ?? []),
          ),
        ),
      );
      const snapshots = await this.financeService.getQuoteSnapshots(trackedSymbols);
      const quoteMap = new Map<string, QuoteSnapshot>(
        snapshots.map((snapshot) => [snapshot.symbol.toUpperCase(), snapshot]),
      );

      let sentNotifications = 0;
      const nowIso = new Date().toISOString();

      for (const preference of preferencesWithDevices) {
        const tracked = this.normalizeTrackedAssets(preference.trackedAssets ?? []);
        const state = this.normalizeAlertState(preference.priceAlertState);
        const nextState: AlertStateRecord = {};
        const triggered: TriggeredAsset[] = [];

        for (const symbol of tracked) {
          const quote = quoteMap.get(symbol);
          if (!quote || quote.price <= 0) {
            continue;
          }

          const currentState = state[symbol];
          const baselinePrice =
            currentState && currentState.baselinePrice > 0 ? currentState.baselinePrice : quote.price;
          const changePercent =
            baselinePrice > 0 ? ((quote.price - baselinePrice) / baselinePrice) * 100 : 0;
          const direction: AlertDirection = changePercent >= 0 ? 'up' : 'down';

          if (!currentState || currentState.baselinePrice <= 0) {
            nextState[symbol] = {
              baselinePrice: quote.price,
              lastPrice: quote.price,
              lastTriggeredAt: currentState?.lastTriggeredAt ?? null,
              lastDirection: currentState?.lastDirection ?? null,
            };
            continue;
          }

          if (Math.abs(changePercent) >= this.normalizeThresholdPercent(preference.priceAlertThresholdPercent)) {
            triggered.push({
              symbol,
              name: quote.name,
              price: quote.price,
              changePercent,
              direction,
            });
            nextState[symbol] = {
              baselinePrice: quote.price,
              lastPrice: quote.price,
              lastTriggeredAt: nowIso,
              lastDirection: direction,
            };
            continue;
          }

          nextState[symbol] = {
            baselinePrice,
            lastPrice: quote.price,
            lastTriggeredAt: currentState.lastTriggeredAt ?? null,
            lastDirection: currentState.lastDirection ?? null,
          };
        }

        preference.priceAlertState = nextState;
        await this.preferenceRepo.save(preference);

        if (triggered.length === 0) {
          continue;
        }

        const targetDevices = devicesByUserId.get(preference.user.id) ?? [];
        await this.sendPushToDevices(
          targetDevices,
          this.buildAlertTitle(triggered),
          this.buildAlertBody(triggered, this.normalizeThresholdPercent(preference.priceAlertThresholdPercent)),
          {
            type: 'price-alert',
            symbols: triggered.map((item) => item.symbol),
          },
        );
        sentNotifications += 1;
      }

      return {
        processedUsers: preferencesWithDevices.length,
        sentNotifications,
      };
    } finally {
      this.isPolling = false;
    }
  }

  private async getOrCreatePreference(userId: string): Promise<UserPreference> {
    const existing = await this.preferenceRepo.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });
    if (existing) {
      if (typeof existing.priceAlertThresholdPercent !== 'number' || existing.priceAlertThresholdPercent <= 0) {
        existing.priceAlertThresholdPercent = this.defaultThresholdPercent;
        await this.preferenceRepo.save(existing);
      }
      return existing;
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User account not found.');
    }

    return this.preferenceRepo.save(
      this.preferenceRepo.create({
        user,
        interests: [],
        regions: [],
        trackedAssets: [],
        priceAlertsEnabled: false,
        priceAlertThresholdPercent: this.defaultThresholdPercent,
        priceAlertState: {},
        tempUnit: 'C',
      }),
    );
  }

  private normalizeTrackedAssets(raw: string[] | null | undefined): string[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return Array.from(
      new Set(
        raw
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim().toUpperCase())
          .filter((item) => item.length > 0)
          .slice(0, 20),
      ),
    );
  }

  private normalizeThresholdPercent(raw: number | null | undefined): number {
    if (typeof raw !== 'number' || Number.isNaN(raw)) {
      return this.defaultThresholdPercent;
    }
    return Math.min(25, Math.max(0.5, Number(raw.toFixed(2))));
  }

  private normalizeAlertState(raw: UserPreference['priceAlertState']): AlertStateRecord {
    if (!raw || typeof raw !== 'object') {
      return {};
    }

    const result: AlertStateRecord = {};
    for (const [symbol, value] of Object.entries(raw)) {
      if (!value || typeof value !== 'object') {
        continue;
      }
      const baselinePrice = typeof value.baselinePrice === 'number' ? value.baselinePrice : 0;
      const lastPrice = typeof value.lastPrice === 'number' ? value.lastPrice : 0;
      result[symbol.toUpperCase()] = {
        baselinePrice,
        lastPrice,
        lastTriggeredAt:
          typeof value.lastTriggeredAt === 'string' ? value.lastTriggeredAt : null,
        lastDirection:
          value.lastDirection === 'up' || value.lastDirection === 'down'
            ? value.lastDirection
            : null,
      };
    }

    return result;
  }

  private toSettingsResponse(
    preference: UserPreference,
    devicesRegistered: number,
  ): PriceAlertSettingsResponse {
    return {
      enabled: Boolean(preference.priceAlertsEnabled),
      thresholdPercent: this.normalizeThresholdPercent(preference.priceAlertThresholdPercent),
      trackedAssets: this.normalizeTrackedAssets(preference.trackedAssets ?? []),
      devicesRegistered,
    };
  }

  private buildAlertTitle(triggered: TriggeredAsset[]): string {
    if (triggered.length === 1) {
      return `Price alert: ${triggered[0].symbol}`;
    }
    return `${triggered.length} tracked assets moved`;
  }

  private buildAlertBody(triggered: TriggeredAsset[], thresholdPercent: number): string {
    if (triggered.length === 1) {
      const asset = triggered[0];
      return `${asset.symbol} is ${asset.direction} ${Math.abs(asset.changePercent).toFixed(2)}% since your last alert baseline. Current price ${asset.price.toFixed(2)}.`;
    }

    const summary = triggered
      .slice(0, 3)
      .map((asset) => `${asset.symbol} ${asset.changePercent >= 0 ? '+' : ''}${asset.changePercent.toFixed(2)}%`)
      .join(', ');
    return `${summary} crossed your ${thresholdPercent.toFixed(1)}% alert threshold.`;
  }

  private async sendPushToDevices(
    devices: PushDevice[],
    title: string,
    body: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (devices.length === 0) {
      return;
    }

    const messages = devices.map((device) => ({
      to: device.expoPushToken,
      sound: 'default',
      title,
      body,
      data,
    }));

    try {
      const response = await axios.post<ExpoPushResponse>(this.expoPushUrl, messages, {
        timeout: 10_000,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(this.expoAccessToken
            ? { Authorization: `Bearer ${this.expoAccessToken}` }
            : {}),
        },
      });

      const tickets = Array.isArray(response.data?.data) ? response.data.data : [];
      const invalidTokens: string[] = [];
      const deliveredIds: string[] = [];

      tickets.forEach((ticket, index) => {
        const device = devices[index];
        if (!device) {
          return;
        }
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(device.expoPushToken);
          return;
        }
        deliveredIds.push(device.id);
      });

      if (invalidTokens.length > 0) {
        await this.deviceRepo.delete({ expoPushToken: In(invalidTokens) });
      }
      if (deliveredIds.length > 0) {
        const now = new Date();
        await Promise.all(
          deliveredIds.map((id) =>
            this.deviceRepo.update(id, {
              lastSentAt: now,
            }),
          ),
        );
      }
    } catch {
      // Keep polling resilient even when Expo push is temporarily unavailable.
    }
  }
}
