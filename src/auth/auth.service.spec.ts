import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../users/entities/user.entity';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    password: 'hashedPassword',
    role: UserRole.VIEWER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    documents: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(email, password);

      expect(result).toEqual(mockUser);
      expect(usersService.findByEmail).toHaveBeenCalledWith(email);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
    });

    it('should return null when user not found', async () => {
      const email = 'nonexistent@example.com';
      const password = 'password123';

      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
      expect(usersService.findByEmail).toHaveBeenCalledWith(email);
    });

    it('should return null when password is invalid', async () => {
      const email = 'test@example.com';
      const password = 'wrongpassword';

      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
    });
  });

  describe('login', () => {
    it('should return access token and user without password', async () => {
      const accessToken = 'jwt-token';
      jwtService.sign.mockReturnValue(accessToken);

      const result = await service.login(mockUser);

      expect(result).toEqual({
        access_token: accessToken,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          role: mockUser.role,
          isActive: mockUser.isActive,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
          documents: mockUser.documents,
        },
      });

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
    });
  });

  describe('register', () => {
    it('should create user and return login response', async () => {
      const userData = {
        email: 'new@example.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Smith',
      };
      const hashedPassword = 'hashedPassword123';
      const accessToken = 'jwt-token';

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      usersService.create.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue(accessToken);

      const result = await service.register(userData);

      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
      expect(usersService.create).toHaveBeenCalledWith({
        ...userData,
        password: hashedPassword,
      });
      expect(result).toEqual({
        access_token: accessToken,
        user: expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
        }),
      });
    });
  });

  describe('validateToken', () => {
    it('should return user when token is valid', async () => {
      const token = 'valid-token';
      const payload = { sub: mockUser.id };

      jwtService.verify.mockReturnValue(payload);
      usersService.findById.mockResolvedValue(mockUser);

      const result = await service.validateToken(token);

      expect(result).toEqual(mockUser);
      expect(jwtService.verify).toHaveBeenCalledWith(token);
      expect(usersService.findById).toHaveBeenCalledWith(payload.sub);
    });

    it('should return null when token is invalid', async () => {
      const token = 'invalid-token';

      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await service.validateToken(token);

      expect(result).toBeNull();
      expect(jwtService.verify).toHaveBeenCalledWith(token);
    });

    it('should return null when user not found', async () => {
      const token = 'valid-token';
      const payload = { sub: 'nonexistent-id' };

      jwtService.verify.mockReturnValue(payload);
      usersService.findById.mockResolvedValue(null);

      const result = await service.validateToken(token);

      expect(result).toBeNull();
    });
  });
}); 