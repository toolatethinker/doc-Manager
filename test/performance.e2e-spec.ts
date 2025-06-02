import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { DocumentsService } from '../src/documents/documents.service';

describe('Performance Tests (e2e)', () => {
  let app: INestApplication;
  let authService: AuthService;
  let usersService: UsersService;
  let documentsService: DocumentsService;
  let authToken: string;
  let testUserEmail: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');
    
    authService = moduleFixture.get<AuthService>(AuthService);
    usersService = moduleFixture.get<UsersService>(UsersService);
    documentsService = moduleFixture.get<DocumentsService>(DocumentsService);

    await app.init();

    // Create test user with unique email
    const timestamp = Date.now();
    testUserEmail = `perf-test-${timestamp}@example.com`;
    
    const testUser = await authService.register({
      email: testUserEmail,
      password: 'password123',
      firstName: 'Performance',
      lastName: 'Test',
    });
    authToken = testUser.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication Performance', () => {
    it('should handle multiple concurrent login requests', async () => {
      const startTime = Date.now();
      const concurrentRequests = 10;
      
      const loginPromises = Array(concurrentRequests).fill(null).map(() =>
        request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: testUserEmail,
            password: 'password123',
          })
      );

      const responses = await Promise.all(loginPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const failedResponses = responses.filter(res => res.status !== 200 && res.status !== 201);
      if (failedResponses.length > 0) {
        console.log('Failed responses:', failedResponses.map(r => ({ status: r.status, body: r.body })));
      }

      expect(duration).toBeLessThan(5000);
      expect(responses.every(res => res.status === 200 || res.status === 201)).toBe(true);
      
      console.log(`✅ ${concurrentRequests} concurrent logins completed in ${duration}ms`);
      console.log(`📊 Average response time: ${duration / concurrentRequests}ms per request`);
    });

    it('should maintain response time under load for token validation', async () => {
      const startTime = Date.now();
      const concurrentRequests = 50;
      
      const profilePromises = Array(concurrentRequests).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(profilePromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const failedResponses = responses.filter(res => res.status !== 200);
      if (failedResponses.length > 0) {
        console.log('Failed responses:', failedResponses.map(r => ({ status: r.status, body: r.body })));
      }

      expect(duration).toBeLessThan(3000);
      expect(responses.every(res => res.status === 200)).toBe(true);
      
      console.log(`✅ ${concurrentRequests} concurrent profile requests completed in ${duration}ms`);
      console.log(`📊 Average response time: ${duration / concurrentRequests}ms per request`);
    });
  });

  describe('Document Operations Performance', () => {
    it('should handle multiple document uploads efficiently', async () => {
      const startTime = Date.now();
      const concurrentUploads = 5;
      
      const testFileBuffer = Buffer.from('Test document content for performance testing');
      
      const uploadPromises = Array(concurrentUploads).fill(null).map((_, index) =>
        request(app.getHttpServer())
          .post('/api/documents/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', testFileBuffer, `perf-test-${Date.now()}-${index}.txt`)
          .field('description', `Performance test document ${index}`)
      );

      const responses = await Promise.all(uploadPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const failedResponses = responses.filter(res => res.status !== 201);
      if (failedResponses.length > 0) {
        console.log('Failed responses:', failedResponses.map(r => ({ status: r.status, body: r.body })));
      }

      expect(duration).toBeLessThan(10000);
      expect(responses.every(res => res.status === 201)).toBe(true);
      
      console.log(`✅ ${concurrentUploads} concurrent uploads completed in ${duration}ms`);
      console.log(`📊 Average upload time: ${duration / concurrentUploads}ms per file`);
    });

    it('should retrieve documents list efficiently under load', async () => {
      const startTime = Date.now();
      const concurrentRequests = 20;
      
      const listPromises = Array(concurrentRequests).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/api/documents')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(listPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const failedResponses = responses.filter(res => res.status !== 200);
      if (failedResponses.length > 0) {
        console.log('Failed responses:', failedResponses.map(r => ({ status: r.status, body: r.body })));
      }

      expect(duration).toBeLessThan(5000);
      expect(responses.every(res => res.status === 200)).toBe(true);
      
      console.log(`✅ ${concurrentRequests} concurrent document list requests completed in ${duration}ms`);
      console.log(`📊 Average response time: ${duration / concurrentRequests}ms per request`);
    });
  });

  describe('Database Performance', () => {
    it('should handle rapid user creation without performance degradation', async () => {
      const startTime = Date.now();
      const userCount = 10;
      const timestamp = Date.now();
      
      const userPromises = Array(userCount).fill(null).map((_, index) =>
        authService.register({
          email: `bulk-user-${timestamp}-${index}@example.com`,
          password: 'password123',
          firstName: `User${index}`,
          lastName: 'Test',
        })
      );

      const users = await Promise.all(userPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(8000);
      expect(users.length).toBe(userCount);
      expect(users.every(user => user.access_token)).toBe(true);
      
      console.log(`✅ ${userCount} users created in ${duration}ms`);
      console.log(`📊 Average creation time: ${duration / userCount}ms per user`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not have memory leaks during sustained operations', async () => {
      const initialMemory = process.memoryUsage();
      const iterations = 50;
      
      for (let i = 0; i < iterations; i++) {
        await request(app.getHttpServer())
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`);
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercentage = (memoryIncrease / initialMemory.heapUsed) * 100;

      expect(memoryIncreasePercentage).toBeLessThan(50);
      
      console.log(`📊 Memory usage after ${iterations} operations:`);
      console.log(`   Initial: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`   Final: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`   Increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB (${memoryIncreasePercentage.toFixed(2)}%)`);
    });
  });

  describe('API Response Time Benchmarks', () => {
    const performanceThresholds = {
      authentication: 500,
      documentUpload: 2000,
      documentRetrieval: 200,
      userOperations: 300,
    };

    it('should meet authentication response time benchmarks', async () => {
      const startTime = Date.now();
      
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: 'password123',
        });

      const responseTime = Date.now() - startTime;
      
      if (response.status !== 200 && response.status !== 201) {
        console.log('Auth response error:', { status: response.status, body: response.body });
      }
      
      expect(response.status === 200 || response.status === 201).toBe(true);
      expect(responseTime).toBeLessThan(performanceThresholds.authentication);
      
      console.log(`✅ Authentication response time: ${responseTime}ms (threshold: ${performanceThresholds.authentication}ms)`);
    });

    it('should meet document upload response time benchmarks', async () => {
      const testFileBuffer = Buffer.from('Test document for benchmark');
      const startTime = Date.now();
      
      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', testFileBuffer, `benchmark-test-${Date.now()}.txt`)
        .field('description', 'Benchmark test document');

      const responseTime = Date.now() - startTime;
      
      if (response.status !== 201) {
        console.log('Upload response error:', { status: response.status, body: response.body });
      }
      
      expect(response.status).toBe(201);
      expect(responseTime).toBeLessThan(performanceThresholds.documentUpload);
      
      console.log(`✅ Document upload response time: ${responseTime}ms (threshold: ${performanceThresholds.documentUpload}ms)`);
    });

    it('should meet document retrieval response time benchmarks', async () => {
      const startTime = Date.now();
      
      const response = await request(app.getHttpServer())
        .get('/api/documents')
        .set('Authorization', `Bearer ${authToken}`);

      const responseTime = Date.now() - startTime;
      
      if (response.status !== 200) {
        console.log('Retrieval response error:', { status: response.status, body: response.body });
      }
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(performanceThresholds.documentRetrieval);
      
      console.log(`✅ Document retrieval response time: ${responseTime}ms (threshold: ${performanceThresholds.documentRetrieval}ms)`);
    });
  });
}); 