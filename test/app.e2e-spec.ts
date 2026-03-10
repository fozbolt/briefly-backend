import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Briefly API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/health', () => {
    it('should return ok status', () => {
      return request(app.getHttpServer())
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
      return request(app.getHttpServer())
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
      return request(app.getHttpServer())
        .get('/api/news')
        .expect(200)
        .expect((res: any) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    }, 30000);
  });

  describe('GET /api/news/signals', () => {
    it('should return top 3 signals', () => {
      return request(app.getHttpServer())
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
      return request(app.getHttpServer())
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
      return request(app.getHttpServer())
        .get('/api/finance/crypto')
        .expect(200)
        .expect((res: any) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    }, 15000);
  });

  describe('GET /api/content/books', () => {
    it('should return a book recommendation', () => {
      return request(app.getHttpServer())
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
      return request(app.getHttpServer())
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
      return request(app.getHttpServer())
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
      return request(app.getHttpServer())
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
      return request(app.getHttpServer())
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
      return request(app.getHttpServer())
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
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'E2E Test User', email: `e2e-${Date.now()}@test.com` })
        .expect(201)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('token');
          expect(res.body).toHaveProperty('user');
          expect(res.body.token).toMatch(/^briefly_/);
        });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login a user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'e2e-login@test.com' })
        .expect(201)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('token');
          expect(res.body).toHaveProperty('user');
        });
    });
  });

  describe('POST /api/chat/bri', () => {
    it('should respond to chat messages', () => {
      return request(app.getHttpServer())
        .post('/api/chat/bri')
        .send({ message: 'What are the top news?' })
        .expect(201)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('message');
          expect(typeof res.body.message).toBe('string');
        });
    }, 30000);

    it('should accept conversation history', () => {
      return request(app.getHttpServer())
        .post('/api/chat/bri')
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

  describe('GET /api/listen/narration', () => {
    it('should return narration payload', () => {
      return request(app.getHttpServer())
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
