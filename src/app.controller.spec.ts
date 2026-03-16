import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              (
                {
                  'oauth.googleClientId': 'google-client-id',
                  'oauth.microsoftClientId': 'microsoft-client-id',
                  'oauth.microsoftTenantId': 'common',
                  'oauth.slackClientId': 'slack-client-id',
                  'oauth.slackScopes': 'channels:read',
                  'oauth.facebookAppId': 'facebook-app-id',
                  'oauth.facebookScopes': 'pages_show_list',
                  'apis.tomTom.key': 'tomtom-key',
                } as Record<string, string>
              )[key] || '',
          },
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health status', () => {
    const result = controller.getHealth();

    expect(result).toHaveProperty('status', 'ok');
    expect(result).toHaveProperty('timestamp');
    expect(typeof result.timestamp).toBe('string');
    // Timestamp should be a valid ISO string
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('should return public app config', () => {
    const result = controller.getPublicAppConfig();

    expect(result.oauth.googleClientId).toBe('google-client-id');
    expect(result.oauth.microsoftClientId).toBe('microsoft-client-id');
    expect(result.traffic.provider).toBe('tomtom');
    expect(result.traffic.liveTrafficEnabled).toBe(true);
  });
});
