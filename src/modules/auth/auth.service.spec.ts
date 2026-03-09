import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { User } from '../../database/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;

  const mockUsers: any[] = [];

  const mockUserRepo = {
    findOne: jest.fn(({ where }: any) => {
      const found = mockUsers.find((u) => u.email === where.email);
      return Promise.resolve(found || null);
    }),
    create: jest.fn((data: any) => ({
      id: 'test-uuid-' + Date.now(),
      ...data,
    })),
    save: jest.fn((user: any) => {
      mockUsers.push(user);
      return Promise.resolve(user);
    }),
  };

  beforeEach(async () => {
    mockUsers.length = 0;
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register a new user', async () => {
    const result = await service.register('John Doe', 'john@test.com', 'password123');

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('user');
    expect(result.token).toMatch(/^briefly_/);
    expect(result.user.email).toBe('john@test.com');
    expect(result.user.fullName).toBe('John');
    expect(mockUserRepo.create).toHaveBeenCalled();
    expect(mockUserRepo.save).toHaveBeenCalled();
  });

  it('should return existing user on duplicate registration', async () => {
    // Register first
    await service.register('John Doe', 'john@test.com', 'password123');

    // Register again with same email
    const result = await service.register('John Doe', 'john@test.com', 'password123');

    expect(result.user.email).toBe('john@test.com');
    // Should not create a second user
    expect(mockUserRepo.create).toHaveBeenCalledTimes(1);
  });

  it('should login and auto-create user', async () => {
    const result = await service.login('newuser@test.com', 'password');

    expect(result).toHaveProperty('token');
    expect(result.token).toMatch(/^briefly_/);
    expect(result.user.email).toBe('newuser@test.com');
  });

  it('should login with existing user', async () => {
    // Create user first
    await service.register('Jane Smith', 'jane@test.com', 'pass');

    // Login
    const result = await service.login('jane@test.com', 'pass');

    expect(result.user.email).toBe('jane@test.com');
  });

  it('should handle OAuth login', async () => {
    const result = await service.oauthLogin('google', 'auth-code-123');

    expect(result).toHaveProperty('token');
    expect(result.user.email).toBe('demo-google@briefly.app');
    expect(result.user.fullName).toBe('Alex');
  });

  it('should generate unique tokens', async () => {
    const result1 = await service.login('user1@test.com', 'pass');
    const result2 = await service.login('user2@test.com', 'pass');

    expect(result1.token).not.toBe(result2.token);
  });
});
