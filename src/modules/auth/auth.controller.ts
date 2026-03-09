import { Controller, Post, Body, Param } from '@nestjs/common';
import { AuthService, AuthResponse } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() body: { fullName?: string; name?: string; email: string; password?: string },
  ): Promise<AuthResponse> {
    const fullName = body.fullName || body.name || 'User';
    return this.authService.register(fullName, body.email, body.password || '');
  }

  @Post('login')
  async login(
    @Body() body: { email: string; password?: string },
  ): Promise<AuthResponse> {
    return this.authService.login(body.email, body.password || '');
  }

  @Post('oauth/:provider')
  async oauthLogin(
    @Param('provider') provider: string,
    @Body() body: { deviceAuthCode: string },
  ): Promise<AuthResponse> {
    return this.authService.oauthLogin(provider, body.deviceAuthCode);
  }
}
