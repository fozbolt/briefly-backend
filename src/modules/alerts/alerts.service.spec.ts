import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import axios from 'axios';
import { AlertsService } from './alerts.service';
import { User } from '../../database/entities/user.entity';
import { UserPreference } from '../../database/entities/user-preference.entity';
import { PushDevice } from '../../database/entities/push-device.entity';
import { FinanceService } from '../finance/finance.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AlertsService', () => {
  let service: AlertsService;

  let users: User[];
  let preferences: UserPreference[];
  let devices: PushDevice[];

  const userRepo = {
    findOne: jest.fn(async ({ where }: any) => users.find((user) => user.id === where.id) ?? null),
  };

  const preferenceRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const userId = where?.user?.id;
      return preferences.find((preference) => preference.user?.id === userId) ?? null;
    }),
    save: jest.fn(async (preference: UserPreference) => {
      if (!preference.id) {
        preference.id = `pref-${preferences.length + 1}`;
      }
      const index = preferences.findIndex((item) => item.id === preference.id);
      if (index >= 0) {
        preferences[index] = preference;
      } else {
        preferences.push(preference);
      }
      return preference;
    }),
    create: jest.fn((payload: Partial<UserPreference>) => payload),
    find: jest.fn(async ({ where }: any) =>
      preferences.filter(
        (preference) => preference.priceAlertsEnabled === where.priceAlertsEnabled,
      ),
    ),
  };

  const deviceRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      if (where?.expoPushToken) {
        return devices.find((device) => device.expoPushToken === where.expoPushToken) ?? null;
      }
      return null;
    }),
    save: jest.fn(async (device: PushDevice) => {
      if (!device.id) {
        device.id = `device-${devices.length + 1}`;
      }
      const index = devices.findIndex((item) => item.id === device.id);
      if (index >= 0) {
        devices[index] = device;
      } else {
        devices.push(device);
      }
      return device;
    }),
    count: jest.fn(async ({ where }: any) =>
      devices.filter((device) => device.user?.id === where?.user?.id).length,
    ),
    delete: jest.fn(async (criteria: any) => {
      const tokenList = Array.isArray(criteria?.expoPushToken?._value)
        ? criteria.expoPushToken._value
        : null;

      devices = devices.filter((device) => {
        if (tokenList) {
          return !tokenList.includes(device.expoPushToken);
        }
        if (criteria?.expoPushToken && device.expoPushToken !== criteria.expoPushToken) {
          return true;
        }
        if (criteria?.user?.id && device.user?.id !== criteria.user.id) {
          return true;
        }
        return false;
      });
      return { affected: 1 };
    }),
    find: jest.fn(async ({ where }: any) => {
      const ids = where?.user?.id?._value ?? null;
      if (Array.isArray(ids)) {
        return devices.filter((device) => ids.includes(device.user?.id));
      }
      if (where?.user?.id) {
        return devices.filter((device) => device.user?.id === where.user.id);
      }
      return [...devices];
    }),
    update: jest.fn(async (id: string, patch: Partial<PushDevice>) => {
      const match = devices.find((device) => device.id === id);
      if (match) {
        Object.assign(match, patch);
      }
      return { affected: match ? 1 : 0 };
    }),
    create: jest.fn((payload: Partial<PushDevice>) => payload),
  };

  const financeService = {
    getQuoteSnapshots: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, unknown> = {
        'priceAlerts.enabled': false,
        'priceAlerts.pollIntervalMs': 60_000,
        'priceAlerts.defaultThresholdPercent': 3,
        'priceAlerts.expoPushUrl': 'https://exp.host/--/api/v2/push/send',
        'priceAlerts.expoAccessToken': '',
      };
      return values[key];
    }),
  };

  beforeEach(async () => {
    users = [
      {
        id: 'user-1',
        name: 'Alert User',
        email: 'alerts@test.com',
      } as User,
    ];
    preferences = [];
    devices = [];
    mockedAxios.post.mockResolvedValue({
      data: {
        data: [{ status: 'ok' }],
      },
    } as any);
    (financeService.getQuoteSnapshots as jest.Mock).mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: ConfigService, useValue: configService },
        { provide: FinanceService, useValue: financeService },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(UserPreference), useValue: preferenceRepo },
        { provide: getRepositoryToken(PushDevice), useValue: deviceRepo },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
  });

  it('registers a push device and persists alert settings', async () => {
    await service.registerPushDevice('user-1', {
      expoPushToken: 'ExponentPushToken[unit-test-token]',
      platform: 'ios',
    });

    const settings = await service.updatePriceAlertSettings('user-1', {
      enabled: true,
      thresholdPercent: 4,
      trackedAssets: ['aapl', 'NVDA', 'aapl'],
    });

    expect(settings.enabled).toBe(true);
    expect(settings.thresholdPercent).toBe(4);
    expect(settings.trackedAssets).toEqual(['AAPL', 'NVDA']);
    expect(settings.devicesRegistered).toBe(1);
  });

  it('sends a push notification when a tracked asset crosses the threshold', async () => {
    preferences.push({
      id: 'pref-1',
      user: users[0],
      interests: [],
      regions: [],
      trackedAssets: ['AAPL'],
      priceAlertsEnabled: true,
      priceAlertThresholdPercent: 3,
      priceAlertState: {
        AAPL: {
          baselinePrice: 100,
          lastPrice: 100,
          lastTriggeredAt: null,
          lastDirection: null,
        },
      },
      tempUnit: 'C',
      weatherLat: null as any,
      weatherLon: null as any,
      updatedAt: new Date(),
    } as UserPreference);
    devices.push({
      id: 'device-1',
      user: users[0],
      expoPushToken: 'ExponentPushToken[unit-test-token]',
      platform: 'ios',
      lastSentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as PushDevice);
    (financeService.getQuoteSnapshots as jest.Mock).mockResolvedValue([
      {
        symbol: 'AAPL',
        name: 'Apple',
        price: 104,
        previousClose: 100,
        changePercent: 4,
      },
    ]);

    const result = await service.checkPriceAlertsNow();

    expect(result.processedUsers).toBe(1);
    expect(result.sentNotifications).toBe(1);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(preferences[0].priceAlertState?.AAPL.baselinePrice).toBe(104);
    expect(preferences[0].priceAlertState?.AAPL.lastDirection).toBe('up');
  });
});
