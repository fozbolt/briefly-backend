import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthResponse, AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OAuthLoginDto } from './dto/oauth-login.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto): Promise<AuthResponse> {
    const fullName = body.fullName || body.name || 'User';
    return this.authService.register(fullName, body.email, body.password);
  }

  @Post('login')
  async login(@Body() body: LoginDto): Promise<AuthResponse> {
    return this.authService.login(body.email, body.password);
  }

  @Post('oauth/:provider')
  async oauthLogin(
    @Param('provider') provider: string,
    @Body() body: OAuthLoginDto,
  ): Promise<AuthResponse> {
    return this.authService.oauthLogin(provider, body.deviceAuthCode, {
      email: body.email,
      fullName: body.fullName,
    });
  }

  @Post('resend-verification')
  async resendVerification(
    @Body() body: ResendVerificationDto,
  ): Promise<AuthResponse> {
    return this.authService.resendVerification(body.email);
  }

  @Post('request-password-reset')
  async requestPasswordReset(
    @Body() body: RequestPasswordResetDto,
  ): Promise<{ message: string; devResetUrl?: string }> {
    return this.authService.requestPasswordReset(body.email);
  }

  @Post('reset-password')
  async resetPassword(
    @Body() body: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(body.token, body.password);
  }

  @Get('verify-email')
  async verifyEmail(
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.authService.verifyEmailToken(token);
    const html = this.authService.buildVerificationHtml(result);
    const statusCode = result.status === 'verified' || result.status === 'already_verified'
      ? 200
      : 400;

    res.status(statusCode).type('html').send(html);
  }

  @Get('reset-password')
  async renderPasswordReset(
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const html = await this.authService.buildPasswordResetHtml(token);
    res.status(200).type('html').send(html);
  }
}
