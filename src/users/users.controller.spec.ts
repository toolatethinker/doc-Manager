import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

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

  const mockAdmin: User = {
    id: '456e7890-e89b-12d3-a456-426614174001',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    password: 'hashedPassword',
    role: UserRole.ADMIN,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    documents: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            updateRole: jest.fn(),
            updateUserStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const createUserDto: CreateUserDto = {
        email: 'new@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'password123',
        role: UserRole.VIEWER,
      };

      usersService.create.mockResolvedValue(mockUser);

      const result = await controller.createUser(createUserDto);

      expect(result).toEqual(mockUser);
      expect(usersService.create).toHaveBeenCalledWith(createUserDto);
    });
  });

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      const users = [mockUser, mockAdmin];
      usersService.findAll.mockResolvedValue(users);

      const result = await controller.getAllUsers();

      expect(result).toEqual(users);
      expect(usersService.findAll).toHaveBeenCalled();
    });
  });

  describe('getUserProfile', () => {
    it('should return current user profile', async () => {
      const mockRequest = { user: mockUser };
      usersService.findById.mockResolvedValue(mockUser);

      const result = await controller.getUserProfile(mockRequest);

      expect(result).toEqual(mockUser);
      expect(usersService.findById).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      usersService.findById.mockResolvedValue(mockUser);

      const result = await controller.getUserById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(usersService.findById).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('updateProfile', () => {
    it('should update current user profile', async () => {
      const updateUserDto: UpdateUserDto = {
        firstName: 'Updated',
      };
      const mockRequest = { user: mockUser };
      const updatedUser = { ...mockUser, ...updateUserDto };

      usersService.update.mockResolvedValue(updatedUser);

      const result = await controller.updateProfile(mockRequest, updateUserDto);

      expect(result).toEqual(updatedUser);
      expect(usersService.update).toHaveBeenCalledWith(mockUser.id, updateUserDto, mockUser);
    });
  });

  describe('updateUserById', () => {
    it('should update user by id', async () => {
      const updateUserDto: UpdateUserDto = {
        firstName: 'Updated',
        role: UserRole.EDITOR,
      };
      const mockRequest = { user: mockAdmin };
      const updatedUser = { ...mockUser, ...updateUserDto };

      usersService.update.mockResolvedValue(updatedUser);

      const result = await controller.updateUserById(mockUser.id, updateUserDto, mockRequest);

      expect(result).toEqual(updatedUser);
      expect(usersService.update).toHaveBeenCalledWith(mockUser.id, updateUserDto, mockAdmin);
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status', async () => {
      const mockRequest = { user: mockAdmin };
      const updatedUser = { ...mockUser, isActive: false };

      usersService.updateUserStatus.mockResolvedValue(updatedUser);

      const result = await controller.updateUserStatus(mockUser.id, mockRequest);

      expect(result).toEqual(updatedUser);
      expect(usersService.updateUserStatus).toHaveBeenCalledWith(mockUser.id, mockAdmin);
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      const mockRequest = { user: mockAdmin };

      usersService.remove.mockResolvedValue(undefined);

      await controller.deleteUser(mockUser.id, mockRequest);

      expect(usersService.remove).toHaveBeenCalledWith(mockUser.id, mockAdmin);
    });
  });
}); 