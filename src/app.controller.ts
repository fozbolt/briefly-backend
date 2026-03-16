import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('public/app-config')
  getPublicAppConfig(): {
    oauth: {
      googleClientId: string;
      microsoftClientId: string;
      microsoftTenantId: string;
      slackClientId: string;
      slackScopes: string;
      facebookAppId: string;
      facebookScopes: string;
    };
    traffic: {
      provider: 'tomtom' | 'fallback';
      liveTrafficEnabled: boolean;
    };
  } {
    const googleClientId = this.configService.get<string>('oauth.googleClientId') || '';
    const microsoftClientId = this.configService.get<string>('oauth.microsoftClientId') || '';
    const microsoftTenantId =
      this.configService.get<string>('oauth.microsoftTenantId') || 'common';
    const slackClientId = this.configService.get<string>('oauth.slackClientId') || '';
    const slackScopes = this.configService.get<string>('oauth.slackScopes') || '';
    const facebookAppId = this.configService.get<string>('oauth.facebookAppId') || '';
    const facebookScopes = this.configService.get<string>('oauth.facebookScopes') || '';
    const tomTomKey = this.configService.get<string>('apis.tomTom.key') || '';

    return {
      oauth: {
        googleClientId,
        microsoftClientId,
        microsoftTenantId,
        slackClientId,
        slackScopes,
        facebookAppId,
        facebookScopes,
      },
      traffic: {
        provider: tomTomKey ? 'tomtom' : 'fallback',
        liveTrafficEnabled: tomTomKey.length > 0,
      },
    };
  }
}
