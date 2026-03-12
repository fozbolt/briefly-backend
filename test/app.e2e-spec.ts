import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Briefly API (e2e)', () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());

  const extractVerificationToken = (responseBody: any): string => {
    const verificationUrl = responseBody?.devVerificationUrl as string | undefined;
    const token = verificationUrl?.split('token=')[1];
    if (!token) {
      throw new Error('Missing dev verification token in register response');
    }
    return token;
  };

  const createVerifiedSession = async (): Promise<{ email: string; password: string; token: string }> => {
    const email = `e2e-chat-${Date.now()}-${Math.floor(Math.random() * 10000)}@test.com`;
    const password = 'password123';
    const registerResponse = await api()
      .post('/api/auth/register')
      .send({ name: 'Chat User', email, password })
      .expect(201);

    const verificationToken = extractVerificationToken(registerResponse.body);
    await api()
      .get(`/api/auth/verify-email?token=${verificationToken}`)
      .expect(200);

    const loginResponse = await api()
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);

    return {
      email,
      password,
      token: loginResponse.body.token,
    };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    await app.listen(0);
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /api/health', () => {
    it('should return ok status', () => {
      return api()
        .get('/api/health')
        .expect(200)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  describe('GET /api/weather', () => {
    it('should return weather data', () => {
      return api()
        .get('/api/weather?lat=40.71&lon=-74.00')
        .expect(200)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('temp');
          expect(res.body).toHaveProperty('unit');
          expect(res.body).toHaveProperty('condition');
          expect(res.body).toHaveProperty('description');
          expect(res.body).toHaveProperty('icon');
        });
    }, 15000);
  });

  describe('GET /api/news', () => {
    it('should return news array', () => {
      return api()
        .get('/api/news')
        .expect(200)
        .expect((res: any) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    }, 30000);
  });

  describe('GET /api/news/signals', () => {
    it('should return top 3 signals', () => {
      return api()
        .get('/api/news/signals')
        .expect(200)
        .expect((res: any) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeLessThanOrEqual(3);
        });
    }, 30000);
  });

  describe('GET /api/finance/portfolio', () => {
    it('should return portfolio with stocks', () => {
      return api()
        .get('/api/finance/portfolio')
        .expect(200)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('change');
          expect(res.body).toHaveProperty('stocks');
          expect(Array.isArray(res.body.stocks)).toBe(true);
        });
    }, 15000);
  });

  describe('GET /api/finance/crypto', () => {
    it('should return crypto data', () => {
      return api()
        .get('/api/finance/crypto')
        .expect(200)
        .expect((res: any) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    }, 15000);
  });

  describe('GET /api/content/books', () => {
    it('should return a book recommendation', () => {
      return api()
        .get('/api/content/books')
        .expect(200)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('title');
          expect(res.body).toHaveProperty('readTime');
          expect(res.body).toHaveProperty('image');
        });
    }, 20000);
  });

  describe('GET /api/content/career-tips', () => {
    it('should return a career tip', () => {
      return api()
        .get('/api/content/career-tips')
        .expect(200)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('title');
          expect(res.body).toHaveProperty('readTime');
          expect(res.body).toHaveProperty('tag');
        });
    }, 20000);
  });

  describe('GET /api/content/quotes', () => {
    it('should return a daily quote', () => {
      return api()
        .get('/api/content/quotes')
        .expect(200)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('text');
          expect(res.body).toHaveProperty('author');
        });
    }, 15000);
  });

  describe('GET /api/content/recommendations', () => {
    it('should return recommendations array', () => {
      return api()
        .get('/api/content/recommendations')
        .expect(200)
        .expect((res: any) => {
          expect(Array.isArray(res.body)).toBe(true);
          if (res.body.length > 0) {
            expect(res.body[0]).toHaveProperty('id');
            expect(res.body[0]).toHaveProperty('title');
            expect(res.body[0]).toHaveProperty('interest');
          }
        });
    }, 30000);
  });

  describe('GET /api/social/pulse', () => {
    it('should return social pulse', () => {
      return api()
        .get('/api/social/pulse')
        .expect(200)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('twitter');
          expect(res.body).toHaveProperty('linkedin');
        });
    }, 20000);
  });

  describe('GET /api/digest', () => {
    it('should return full digest', () => {
      return api()
        .get('/api/digest?lat=40.71&lon=-74.00')
        .expect(200)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('weather');
          expect(res.body).toHaveProperty('tasks');
          expect(res.body).toHaveProperty('emails');
          expect(res.body).toHaveProperty('signals');
          expect(res.body).toHaveProperty('portfolio');
          expect(res.body).toHaveProperty('book');
          expect(res.body).toHaveProperty('careerTip');
          expect(res.body).toHaveProperty('socialPulse');
          expect(res.body).toHaveProperty('recommendations');
          expect(res.body).toHaveProperty('generatedAt');
        });
    }, 60000);
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', () => {
      return api()
        .post('/api/auth/register')
        .send({
          name: 'E2E Test User',
          email: `e2e-${Date.now()}@test.com`,
          password: 'password123',
        })
        .expect(201)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('requiresEmailVerification', true);
          expect(res.body).toHaveProperty('email');
          expect(res.body).toHaveProperty('verificationExpiresAt');
        });
    });

    it('should return verification flow for duplicate unverified registration', async () => {
      const email = `dup-${Date.now()}@test.com`;
      await api()
        .post('/api/auth/register')
        .send({ name: 'Duplicate User', email, password: 'password123' })
        .expect(201);

      return api()
        .post('/api/auth/register')
        .send({ name: 'Duplicate User', email, password: 'password123' })
        .expect(201)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('requiresEmailVerification', true);
          expect(res.body).toHaveProperty('email', email.toLowerCase());
        });
    });

    it('should reject duplicate registration after email is verified', async () => {
      const email = `dup-verified-${Date.now()}@test.com`;
      const registerResponse = await api()
        .post('/api/auth/register')
        .send({ name: 'Duplicate Verified User', email, password: 'password123' })
        .expect(201);

      const verificationToken = extractVerificationToken(registerResponse.body);
      await api()
        .get(`/api/auth/verify-email?token=${verificationToken}`)
        .expect(200);

      return api()
        .post('/api/auth/register')
        .send({ name: 'Duplicate Verified User', email, password: 'password123' })
        .expect(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login a user with valid credentials', async () => {
      const email = `e2e-login-${Date.now()}@test.com`;
      const password = 'password123';
      const registerResponse = await api()
        .post('/api/auth/register')
        .send({ name: 'Login User', email, password })
        .expect(201);
      const token = extractVerificationToken(registerResponse.body);

      await api()
        .get(`/api/auth/verify-email?token=${token}`)
        .expect(200);

      return api()
        .post('/api/auth/login')
        .send({ email, password })
        .expect(201)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('token');
          expect(res.body).toHaveProperty('user');
        });
    });

    it('should reject invalid credentials', () => {
      return api()
        .post('/api/auth/login')
        .send({ email: 'does-not-exist@test.com', password: 'password123' })
        .expect(401);
    });

    it('should block login until email is verified', async () => {
      const email = `e2e-unverified-${Date.now()}@test.com`;
      const password = 'password123';
      await api()
        .post('/api/auth/register')
        .send({ name: 'Unverified User', email, password })
        .expect(201);

      return api()
        .post('/api/auth/login')
        .send({ email, password })
        .expect(403);
    });
  });

  describe('POST /api/chat/bri', () => {
    it('should respond to chat messages', async () => {
      const session = await createVerifiedSession();
      return api()
        .post('/api/chat/bri')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ message: 'What are the top news?' })
        .expect(201)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('message');
          expect(typeof res.body.message).toBe('string');
        });
    }, 30000);

    it('should accept conversation history', async () => {
      const session = await createVerifiedSession();
      return api()
        .post('/api/chat/bri')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          message: 'Tell me more',
          history: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ],
        })
        .expect(201)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('message');
          expect(typeof res.body.message).toBe('string');
        });
    }, 30000);
  });

  describe('Authenticated price alert endpoints', () => {
    it('stores alert settings and device registrations for the logged-in user', async () => {
      const session = await createVerifiedSession();
      const expoPushToken = `ExponentPushToken[e2e-${Date.now()}]`;

      await api()
        .post('/api/alerts/price/device')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ expoPushToken, platform: 'ios' })
        .expect(201)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('registered', true);
          expect(res.body).toHaveProperty('devices', 1);
        });

      await api()
        .put('/api/alerts/price')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          enabled: true,
          thresholdPercent: 4,
          trackedAssets: ['aapl', 'NVDA'],
        })
        .expect(200)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('enabled', true);
          expect(res.body).toHaveProperty('thresholdPercent', 4);
          expect(res.body.trackedAssets).toEqual(['AAPL', 'NVDA']);
          expect(res.body).toHaveProperty('devicesRegistered', 1);
        });

      await api()
        .get('/api/alerts/price')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(200)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('enabled', true);
          expect(res.body.trackedAssets).toEqual(['AAPL', 'NVDA']);
        });

      await api()
        .delete('/api/alerts/price/device')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ expoPushToken })
        .expect(200)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('removed', true);
          expect(res.body).toHaveProperty('devices', 0);
        });
    });

    it('rejects unauthenticated access', () => {
      return api()
        .get('/api/alerts/price')
        .expect(401);
    });
  });

  describe('GET /api/listen/narration', () => {
    it('should return narration payload', () => {
      return api()
        .get('/api/listen/narration?userName=TestUser')
        .expect(200)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('script');
          expect(res.body).toHaveProperty('sections');
          expect(res.body).toHaveProperty('estimatedDurationSec');
          expect(res.body).toHaveProperty('generatedAtLabel');
          expect(typeof res.body.script).toBe('string');
          expect(res.body.script.length).toBeGreaterThan(50);
          expect(Array.isArray(res.body.sections)).toBe(true);
          expect(res.body.sections.length).toBe(6);
          expect(res.body.script).toContain('TestUser');
        });
    }, 30000);
  });
});
