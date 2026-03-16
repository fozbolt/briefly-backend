import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from '../../database/entities/user.entity';
import { EmailVerificationToken } from '../../database/entities/email-verification-token.entity';
import { AuthMailerService } from './auth-mailer.service';

type UserRecord = any;
type TokenRecord = any;

function createDeleteBuilder(tokens: TokenRecord[]) {
  let userId: string | null = null;
  let excludeId: string | null = null;

  return {
    delete() {
      return this;
    },
    from() {
      return this;
    },
    where(_query: string, params: Record<string, string>) {
      userId = params.userId;
      return this;
    },
    andWhere(_query: string, params: Record<string, string>) {
      excludeId = params.id;
      return this;
    },
    async execute() {
      for (let index = tokens.length - 1; index >= 0; index -= 1) {
        const token = tokens[index];
        if (userId && token.user.id !== userId) {
          continue;
        }
        if (excludeId && token.id === excludeId) {
          continue;
        }
        tokens.splice(index, 1);
      }
      return { affected: 1 };
    },
  };
}

describe('AuthService', () => {
  let service: AuthService;

  const mockUsers: UserRecord[] = [];
  const mockTokens: TokenRecord[] = [];

  const mockUserRepo = {
    findOne: jest.fn(async ({ where, select }: any) => {
      const found = mockUsers.find((u) => u.email === where.email);
      if (!found) {
        return null;
      }
      if (!select) {
        return found;
      }
      const picked: Record<string, unknown> = {};
      for (const [key, include] of Object.entries(select)) {
        if (include) {
          picked[key] = found[key];
        }
      }
      return picked;
    }),
    create: jest.fn((data: any) => ({
      id: `user-${Date.now()}-${Math.random()}`,
      level: 'Explorer',
      emailVerified: false,
      emailVerifiedAt: null,
      ...data,
    })),
    save: jest.fn(async (user: any) => {
      const existingIndex = mockUsers.findIndex((item) => item.id === user.id);
      if (existingIndex >= 0) {
        mockUsers[existingIndex] = { ...mockUsers[existingIndex], ...user };
        return mockUsers[existingIndex];
      }
      mockUsers.push(user);
      return user;
    }),
    update: jest.fn(async (id: string, patch: Record<string, unknown>) => {
      const user = mockUsers.find((item) => item.id === id);
      if (user) {
        Object.assign(user, patch);
      }
      return { affected: user ? 1 : 0 };
    }),
    manager: {
      transaction: jest.fn(async (callback: any) => {
        const manager = {
          getRepository: (entity: any) => {
            if (entity === User) {
              return {
                update: mockUserRepo.update,
              };
            }
            if (entity === EmailVerificationToken) {
              return {
                update: mockTokenRepo.update,
                createQueryBuilder: () => createDeleteBuilder(mockTokens),
              };
            }
            throw new Error('Unknown repository entity');
          },
        };
        return callback(manager);
      }),
    },
  };

  const mockTokenRepo = {
    create: jest.fn((data: any) => ({
      id: `token-${Date.now()}-${Math.random()}`,
      ...data,
    })),
    save: jest.fn(async (token: any) => {
      mockTokens.push(token);
      return token;
    }),
    createQueryBuilder: jest.fn(() => createDeleteBuilder(mockTokens)),
    findOne: jest.fn(async ({ where }: any) => {
      if (where?.tokenHash) {
        return mockTokens.find((token) => token.tokenHash === where.tokenHash) ?? null;
      }
      return null;
    }),
    update: jest.fn(async (id: string, patch: Record<string, unknown>) => {
      const token = mockTokens.find((item) => item.id === id);
      if (token) {
        Object.assign(token, patch);
      }
      return { affected: token ? 1 : 0 };
    }),
  };

  const mockMailerService = {
    sendVerificationEmail: jest.fn(async ({ verificationUrl }: any) => ({
      delivered: true,
      provider: 'console' as const,
      verificationUrl,
    })),
    sendPasswordResetEmail: jest.fn(async ({ resetUrl }: any) => ({
      delivered: true,
      provider: 'console' as const,
      resetUrl,
    })),
  };

  beforeEach(async () => {
    mockUsers.length = 0;
    mockTokens.length = 0;
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        {
          provide: getRepositoryToken(EmailVerificationToken),
          useValue: mockTokenRepo,
        },
        { provide: AuthMailerService, useValue: mockMailerService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'auth.tokenSecret') return 'unit-test-secret';
              if (key === 'auth.tokenTtlHours') return 24;
              if (key === 'email.verificationBaseUrl') return 'http://localhost:3001/api';
              if (key === 'email.verificationTokenTtlMinutes') return 60;
              if (key === 'email.provider') return 'console';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register and return verification-pending response', async () => {
    const result = await service.register('John Doe', 'john@test.com', 'password123');

    expect('requiresEmailVerification' in result).toBe(true);
    if ('requiresEmailVerification' in result) {
      expect(result.requiresEmailVerification).toBe(true);
      expect(result.email).toBe('john@test.com');
      expect(result.devVerificationUrl).toContain('/auth/verify-email?token=');
    }
    expect(mockUserRepo.save).toHaveBeenCalled();
    expect(mockMailerService.sendVerificationEmail).toHaveBeenCalled();
    expect(mockTokens.length).toBe(1);
  });

  it('should normalize email casing on registration', async () => {
    const result = await service.register('Case User', 'Case.User@TEST.com', 'password123');
    if ('requiresEmailVerification' in result) {
      expect(result.email).toBe('case.user@test.com');
    }
  });

  it('should reject duplicate verified registration', async () => {
    mockUsers.push({
      id: 'existing-1',
      name: 'John Doe',
      email: 'john@test.com',
      authProvider: 'local',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });

    await expect(
      service.register('John Doe', 'john@test.com', 'password123'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should resend verification for duplicate unverified registration', async () => {
    mockUsers.push({
      id: 'existing-2',
      name: 'John Doe',
      email: 'john@test.com',
      authProvider: 'local',
      emailVerified: false,
      emailVerifiedAt: null,
    });

    const result = await service.register('John Doe', 'john@test.com', 'password123');
    expect('requiresEmailVerification' in result).toBe(true);
    expect(mockUserRepo.create).not.toHaveBeenCalled();
    expect(mockMailerService.sendVerificationEmail).toHaveBeenCalled();
  });

  it('should reject login for non-existing user', async () => {
    await expect(service.login('newuser@test.com', 'password123')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('should reject login while email is not verified', async () => {
    const registerResult = await service.register('Jane Smith', 'jane@test.com', 'password123');
    expect('requiresEmailVerification' in registerResult).toBe(true);

    await expect(service.login('jane@test.com', 'password123')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('should verify email and allow login', async () => {
    const registerResult = await service.register('Jane Smith', 'jane@test.com', 'password123');
    const verificationUrl =
      'requiresEmailVerification' in registerResult ? registerResult.devVerificationUrl : '';
    const token = verificationUrl?.split('token=')[1] ?? '';
    expect(token.length).toBeGreaterThan(10);

    const verifyResult = await service.verifyEmailToken(decodeURIComponent(token));
    expect(verifyResult.status).toBe('verified');

    const loginResult = await service.login('jane@test.com', 'password123');
    expect(loginResult.user.email).toBe('jane@test.com');
    expect(loginResult.token).toMatch(/^briefly_/);
  });

  it('should resend verification for unverified users', async () => {
    const registerResult = await service.register('Resend User', 'resend@test.com', 'password123');
    expect('requiresEmailVerification' in registerResult).toBe(true);

    const resendResult = await service.resendVerification('resend@test.com');
    expect(resendResult.requiresEmailVerification).toBe(true);
    expect(resendResult.email).toBe('resend@test.com');
    expect(mockMailerService.sendVerificationEmail).toHaveBeenCalledTimes(2);
  });

  it('should reject expired verification links', async () => {
    const registerResult = await service.register('Expired User', 'expired@test.com', 'password123');
    const token =
      'requiresEmailVerification' in registerResult
        ? registerResult.devVerificationUrl?.split('token=')[1] ?? ''
        : '';
    expect(token).toBeTruthy();
    mockTokens[0].expiresAt = new Date(Date.now() - 1000);

    const verifyResult = await service.verifyEmailToken(decodeURIComponent(token));
    expect(verifyResult.status).toBe('expired');
  });

  it('should reject login with wrong password', async () => {
    const registerResult = await service.register('Jane Smith', 'jane@test.com', 'correct-password');
    const token =
      'requiresEmailVerification' in registerResult
        ? registerResult.devVerificationUrl?.split('token=')[1] ?? ''
        : '';
    await service.verifyEmailToken(decodeURIComponent(token));

    await expect(service.login('jane@test.com', 'wrong-password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('should reject password login for OAuth-only users', async () => {
    await service.oauthLogin('google', 'auth-code-123');
    await expect(
      service.login('demo-google@briefly.app', 'password123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should handle OAuth login', async () => {
    const result = await service.oauthLogin('google', 'auth-code-123');

    expect(result).toHaveProperty('token');
    expect(result.user.email).toBe('demo-google@briefly.app');
    expect(result.user.fullName).toBe('Google');
  });

  it('should use real provider profile information when available', async () => {
    const result = await service.oauthLogin('google', 'auth-code-123', {
      email: 'filip@gmail.com',
      fullName: 'Filip Ozbolt',
    });

    expect(result.user.email).toBe('filip@gmail.com');
    expect(result.user.fullName).toBe('Filip Ozbolt');
  });

  it('should reject unknown OAuth providers', async () => {
    await expect(service.oauthLogin('unsupported', 'auth-code-123')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should generate unique tokens', async () => {
    const regOne = await service.register('User One', 'user1@test.com', 'password123');
    const regTwo = await service.register('User Two', 'user2@test.com', 'password123');
    const tokenOne =
      'requiresEmailVerification' in regOne ? regOne.devVerificationUrl?.split('token=')[1] : '';
    const tokenTwo =
      'requiresEmailVerification' in regTwo ? regTwo.devVerificationUrl?.split('token=')[1] : '';
    expect(tokenOne).toBeTruthy();
    expect(tokenTwo).toBeTruthy();
    await service.verifyEmailToken(decodeURIComponent(tokenOne || ''));
    await service.verifyEmailToken(decodeURIComponent(tokenTwo || ''));

    const result1 = await service.login('user1@test.com', 'password123');
    const result2 = await service.login('user2@test.com', 'password123');

    expect(result1.token).not.toBe(result2.token);
  });

  it('should verify signed session token and extract user context', async () => {
    const registerResult = await service.register('Token User', 'token@test.com', 'password123');
    const token =
      'requiresEmailVerification' in registerResult
        ? registerResult.devVerificationUrl?.split('token=')[1] ?? ''
        : '';
    await service.verifyEmailToken(decodeURIComponent(token));

    const loginResult = await service.login('token@test.com', 'password123');
    const verified = service.verifySignedToken(loginResult.token);

    expect(verified).toEqual({
      id: loginResult.user.id,
      email: 'token@test.com',
    });
  });

  it('should reject malformed signed token', () => {
    expect(() => service.verifySignedToken('briefly_invalid.token')).toThrow(
      UnauthorizedException,
    );
  });

  it('should issue a password reset link for local verified users', async () => {
    const registerResult = await service.register('Reset User', 'reset@test.com', 'password123');
    const token =
      'requiresEmailVerification' in registerResult
        ? registerResult.devVerificationUrl?.split('token=')[1] ?? ''
        : '';
    await service.verifyEmailToken(decodeURIComponent(token));

    const result = await service.requestPasswordReset('reset@test.com');

    expect(result.message).toContain('If an account exists');
    expect(result.devResetUrl).toContain('/auth/reset-password?token=');
    expect(mockMailerService.sendPasswordResetEmail).toHaveBeenCalled();
  });

  it('should reset password with a valid token', async () => {
    const registerResult = await service.register('Reset User', 'reset2@test.com', 'password123');
    const verificationToken =
      'requiresEmailVerification' in registerResult
        ? registerResult.devVerificationUrl?.split('token=')[1] ?? ''
        : '';
    await service.verifyEmailToken(decodeURIComponent(verificationToken));

    const resetRequest = await service.requestPasswordReset('reset2@test.com');
    const resetToken = resetRequest.devResetUrl?.split('token=')[1] ?? '';
    expect(resetToken).toBeTruthy();

    await service.resetPassword(decodeURIComponent(resetToken), 'new-password-123');
    const loginResult = await service.login('reset2@test.com', 'new-password-123');
    expect(loginResult.user.email).toBe('reset2@test.com');
  });
});
