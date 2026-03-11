import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { Repository } from 'typeorm';
import { EmailVerificationToken } from '../../database/entities/email-verification-token.entity';
import { User } from '../../database/entities/user.entity';
import { AuthMailerService } from './auth-mailer.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';

const scrypt = promisify(scryptCallback);
const TOKEN_PREFIX = 'briefly_';
const ALLOWED_OAUTH_PROVIDERS = new Set([
  'google',
  'gmail',
  'outlook',
  'slack',
  'facebook',
  'messenger',
]);

export interface SessionAuthResponse {
  token: string;
  user: { id: string; email: string; fullName: string };
}

export interface VerificationPendingResponse {
  requiresEmailVerification: true;
  email: string;
  emailVerificationSent: boolean;
  verificationExpiresAt: string;
  message: string;
  devVerificationUrl?: string;
}

export type AuthResponse = SessionAuthResponse | VerificationPendingResponse;

export type VerifyEmailStatus = 'verified' | 'already_verified' | 'expired' | 'invalid';

export interface VerifyEmailResult {
  status: VerifyEmailStatus;
  message: string;
}

interface SessionTokenPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
  jti: string;
}

@Injectable()
export class AuthService {
  private readonly tokenSecret: string;
  private readonly tokenTtlHours: number;
  private readonly verificationBaseUrl: string;
  private readonly verificationTokenTtlMinutes: number;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(EmailVerificationToken)
    private readonly verificationTokenRepo: Repository<EmailVerificationToken>,
    private readonly configService: ConfigService,
    private readonly authMailerService: AuthMailerService,
  ) {
    const configuredTokenSecret = this.configService.get<string>('auth.tokenSecret')?.trim();
    const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
    if (configuredTokenSecret) {
      this.tokenSecret = configuredTokenSecret;
    } else if (this.isProductionLike(nodeEnv)) {
      throw new Error('AUTH_TOKEN_SECRET is required in production/stage.');
    } else {
      this.tokenSecret = 'briefly-dev-token-secret';
    }

    const configuredTokenTtl = this.configService.get<number>('auth.tokenTtlHours');
    this.tokenTtlHours =
      typeof configuredTokenTtl === 'number' && configuredTokenTtl > 0
        ? configuredTokenTtl
        : 720;

    const configuredVerificationBase =
      this.configService.get<string>('email.verificationBaseUrl') ||
      'http://localhost:3001/api';
    this.verificationBaseUrl = configuredVerificationBase.replace(/\/+$/, '');

    const configuredVerificationTtl = this.configService.get<number>(
      'email.verificationTokenTtlMinutes',
    );
    this.verificationTokenTtlMinutes =
      typeof configuredVerificationTtl === 'number' && configuredVerificationTtl > 0
        ? configuredVerificationTtl
        : 1440;
  }

  async register(fullName: string, email: string, password: string): Promise<AuthResponse> {
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedName = this.normalizeName(fullName);

    if (!password || password.trim().length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long.');
    }

    const existing = await this.userRepo.findOne({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        authProvider: true,
        emailVerified: true,
        emailVerifiedAt: true,
      },
    });
    if (existing) {
      if (existing.authProvider !== 'local') {
        throw new ConflictException(
          'Account already exists via OAuth provider. Please login with that provider.',
        );
      }
      if (existing.emailVerified) {
        throw new ConflictException('Account already exists. Please login.');
      }
      return this.issueEmailVerification(existing);
    }

    const { hash, salt } = await this.hashPassword(password.trim());
    const user = this.userRepo.create({
      name: normalizedName,
      email: normalizedEmail,
      level: 'Explorer',
      authProvider: 'local',
      passwordHash: hash,
      passwordSalt: salt,
      emailVerified: false,
      emailVerifiedAt: null,
    });
    const saved = await this.userRepo.save(user);
    return this.issueEmailVerification(saved);
  }

  async login(email: string, password: string): Promise<SessionAuthResponse> {
    const normalizedEmail = this.normalizeEmail(email);

    if (!password || password.trim().length === 0) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const user = await this.userRepo.findOne({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        level: true,
        authProvider: true,
        passwordHash: true,
        passwordSalt: true,
        emailVerified: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (user.authProvider !== 'local') {
      throw new UnauthorizedException(
        `This account uses ${user.authProvider} login. Please continue with your provider.`,
      );
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Email not verified. Please check your inbox and verify first.');
    }

    if (!user.passwordHash || !user.passwordSalt) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isValid = await this.verifyPassword(
      password.trim(),
      user.passwordHash,
      user.passwordSalt,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return this.buildSessionResponse(user);
  }

  async oauthLogin(provider: string, deviceAuthCode: string): Promise<SessionAuthResponse> {
    const normalizedProvider = provider.trim().toLowerCase();
    if (!ALLOWED_OAUTH_PROVIDERS.has(normalizedProvider)) {
      throw new BadRequestException('Unsupported OAuth provider.');
    }
    if (!deviceAuthCode || deviceAuthCode.trim().length < 4) {
      throw new BadRequestException('Invalid OAuth authorization code.');
    }

    const email = `demo-${normalizedProvider}@briefly.app`;
    let user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      user = this.userRepo.create({
        name: normalizedProvider.charAt(0).toUpperCase() + normalizedProvider.slice(1),
        email,
        level: 'Explorer',
        authProvider: normalizedProvider,
        passwordHash: null,
        passwordSalt: null,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      });
      user = await this.userRepo.save(user);
    }

    return this.buildSessionResponse(user);
  }

  async resendVerification(email: string): Promise<VerificationPendingResponse> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.userRepo.findOne({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        authProvider: true,
        emailVerified: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException('No account found for this email.');
    }
    if (user.authProvider !== 'local') {
      throw new BadRequestException(
        `This account uses ${user.authProvider} login and does not require email verification.`,
      );
    }
    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified. Please login.');
    }

    return this.issueEmailVerification(user);
  }

  async verifyEmailToken(token: string): Promise<VerifyEmailResult> {
    const normalizedToken = (token || '').trim();
    if (normalizedToken.length < 32) {
      return {
        status: 'invalid',
        message: 'Verification link is invalid.',
      };
    }

    const now = new Date();
    const tokenHash = this.hashVerificationToken(normalizedToken);
    const record = await this.verificationTokenRepo.findOne({
      where: { tokenHash },
      relations: {
        user: true,
      },
    });

    if (!record) {
      return {
        status: 'invalid',
        message: 'Verification link is invalid or already removed.',
      };
    }

    if (record.consumedAt) {
      return {
        status: 'already_verified',
        message: 'Email is already verified. You can login now.',
      };
    }

    if (record.expiresAt.getTime() <= now.getTime()) {
      return {
        status: 'expired',
        message: 'Verification link has expired. Please request a new link.',
      };
    }

    if (record.user.emailVerified) {
      await this.verificationTokenRepo.update(record.id, { consumedAt: now });
      return {
        status: 'already_verified',
        message: 'Email is already verified. You can login now.',
      };
    }

    await this.userRepo.manager.transaction(async (manager) => {
      await manager.getRepository(User).update(record.user.id, {
        emailVerified: true,
        emailVerifiedAt: now,
      });
      await manager.getRepository(EmailVerificationToken).update(record.id, { consumedAt: now });
      await manager
        .getRepository(EmailVerificationToken)
        .createQueryBuilder()
        .delete()
        .from(EmailVerificationToken)
        .where('userId = :userId', { userId: record.user.id })
        .andWhere('id != :id', { id: record.id })
        .execute();
    });

    return {
      status: 'verified',
      message: 'Email verified successfully. You can login now.',
    };
  }

  verifySignedToken(rawToken: string): AuthenticatedUser {
    const token = (rawToken || '').trim();
    if (!token.startsWith(TOKEN_PREFIX)) {
      throw new UnauthorizedException('Invalid token prefix.');
    }

    const compact = token.slice(TOKEN_PREFIX.length);
    const [payloadEncoded, signature] = compact.split('.');
    if (!payloadEncoded || !signature) {
      throw new UnauthorizedException('Malformed token.');
    }

    const expectedSignature = createHmac('sha256', this.tokenSecret)
      .update(payloadEncoded)
      .digest('base64url');

    const expectedBuffer = Buffer.from(expectedSignature);
    const providedBuffer = Buffer.from(signature);
    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new UnauthorizedException('Invalid token signature.');
    }

    let payload: SessionTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf8')) as SessionTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid token payload.');
    }

    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      throw new UnauthorizedException('Invalid token claims.');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSeconds) {
      throw new UnauthorizedException('Token expired.');
    }

    return {
      id: payload.sub,
      email: payload.email.toLowerCase(),
    };
  }

  buildVerificationHtml(result: VerifyEmailResult): string {
    const statusColor: Record<VerifyEmailStatus, string> = {
      verified: '#16a34a',
      already_verified: '#2563eb',
      expired: '#dc2626',
      invalid: '#dc2626',
    };
    const title: Record<VerifyEmailStatus, string> = {
      verified: 'Email verified',
      already_verified: 'Already verified',
      expired: 'Link expired',
      invalid: 'Invalid link',
    };

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${title[result.status]}</title>
        </head>
        <body style="font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:24px;">
          <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
            <h1 style="margin:0 0 12px;font-size:24px;color:${statusColor[result.status]};">
              ${title[result.status]}
            </h1>
            <p style="margin:0 0 18px;font-size:16px;line-height:1.5;">
              ${result.message}
            </p>
            <p style="margin:0;font-size:14px;color:#475569;">
              Return to the Briefly app and continue with email login.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  private async issueEmailVerification(user: User): Promise<VerificationPendingResponse> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashVerificationToken(rawToken);
    const expiresAt = new Date(Date.now() + this.verificationTokenTtlMinutes * 60 * 1000);

    await this.verificationTokenRepo
      .createQueryBuilder()
      .delete()
      .from(EmailVerificationToken)
      .where('userId = :userId', { userId: user.id })
      .execute();

    await this.verificationTokenRepo.save(
      this.verificationTokenRepo.create({
        user,
        tokenHash,
        expiresAt,
        consumedAt: null,
      }),
    );

    const verificationUrl = `${this.verificationBaseUrl}/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
    const emailResult = await this.authMailerService.sendVerificationEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      verificationUrl,
      expiresAt,
    });

    const devVerificationUrl =
      emailResult.provider === 'console' && !this.isProductionLike()
        ? verificationUrl
        : undefined;

    return {
      requiresEmailVerification: true,
      email: user.email,
      emailVerificationSent: emailResult.delivered,
      verificationExpiresAt: expiresAt.toISOString(),
      message: 'Please verify your email before logging in.',
      devVerificationUrl,
    };
  }

  private buildSessionResponse(user: User): SessionAuthResponse {
    const token = this.createSignedToken(user);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.name,
      },
    };
  }

  private normalizeEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  private normalizeName(name: string): string {
    const value = (name || '').trim();
    return value.length > 0 ? value : 'User';
  }

  private async hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
    const passwordSalt = salt || randomBytes(16).toString('hex');
    const hashBuffer = (await scrypt(password, passwordSalt, 64)) as Buffer;
    return {
      hash: hashBuffer.toString('hex'),
      salt: passwordSalt,
    };
  }

  private async verifyPassword(
    password: string,
    expectedHash: string,
    salt: string,
  ): Promise<boolean> {
    const { hash } = await this.hashPassword(password, salt);
    const expected = Buffer.from(expectedHash, 'hex');
    const candidate = Buffer.from(hash, 'hex');

    if (expected.length !== candidate.length) {
      return false;
    }

    return timingSafeEqual(expected, candidate);
  }

  private hashVerificationToken(token: string): string {
    return createHash('sha256').update(`${token}:${this.tokenSecret}`).digest('hex');
  }

  private createSignedToken(user: User): string {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const payload = {
      sub: user.id,
      email: user.email,
      iat: nowSeconds,
      exp: nowSeconds + this.tokenTtlHours * 60 * 60,
      jti: randomBytes(12).toString('hex'),
    };

    const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.tokenSecret)
      .update(payloadEncoded)
      .digest('base64url');

    return `${TOKEN_PREFIX}${payloadEncoded}.${signature}`;
  }

  private isProductionLike(nodeEnvRaw?: string): boolean {
    const nodeEnv = (nodeEnvRaw || process.env.NODE_ENV || 'development').toLowerCase();
    return nodeEnv === 'production' || nodeEnv === 'stage';
  }
}
