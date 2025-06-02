import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User, UserRole } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

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

  const mockLoginResponse = {
    access_token: 'jwt-token',
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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerDto: RegisterDto = {
        email: 'new@example.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      authService.register.mockResolvedValue(mockLoginResponse);

      const result = await controller.register(registerDto);

      expect(result).toEqual(mockLoginResponse);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });

    it('should handle registration errors', async () => {
      const registerDto: RegisterDto = {
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      authService.register.mockRejectedValue(new Error('User already exists'));

      await expect(controller.register(registerDto)).rejects.toThrow('User already exists');
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockRequest = {
        user: mockUser,
      };

      authService.login.mockResolvedValue(mockLoginResponse);

      const result = await controller.login(mockRequest, loginDto);

      expect(result).toEqual(mockLoginResponse);
      expect(authService.login).toHaveBeenCalledWith(mockUser);
    });

    it('should handle login with invalid credentials', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const mockRequest = {
        user: null,
      };

      authService.login.mockRejectedValue(new Error('Invalid credentials'));

      await expect(controller.login(mockRequest, loginDto)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const result = await controller.logout();

      expect(result).toEqual({ message: 'Logout successful' });
    });
  });
}); 