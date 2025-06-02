import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Repository<User>>;

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
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const createUserDto: CreateUserDto = {
        email: 'new@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'password123',
        role: UserRole.VIEWER,
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockUser);
      repository.save.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { email: createUserDto.email } });
      expect(repository.create).toHaveBeenCalledWith(createUserDto);
      expect(repository.save).toHaveBeenCalledWith(mockUser);
    });

    it('should throw ConflictException when user already exists', async () => {
      const createUserDto: CreateUserDto = {
        email: 'existing@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'password123',
      };

      repository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { email: createUserDto.email } });
    });
  });

  describe('findAll', () => {
    it('should return all users without passwords', async () => {
      const users = [mockUser, mockAdmin];
      repository.find.mockResolvedValue(users);

      const result = await service.findAll();

      expect(result).toEqual(users);
      expect(repository.find).toHaveBeenCalledWith({
        select: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'createdAt', 'updatedAt'],
      });
    });
  });

  describe('findById', () => {
    it('should return user by id without password', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'createdAt', 'updatedAt'],
      });
    });

    it('should return null when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return user by email with password', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail(mockUser.email);

      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: mockUser.email },
      });
    });
  });

  describe('update', () => {
    it('should update user successfully when admin updates any user', async () => {
      const updateUserDto: UpdateUserDto = {
        firstName: 'Updated',
        role: UserRole.EDITOR,
      };

      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockResolvedValue({ ...mockUser, ...updateUserDto });

      const result = await service.update(mockUser.id, updateUserDto, mockAdmin);

      expect(result).toEqual({ ...mockUser, ...updateUserDto });
      expect(repository.save).toHaveBeenCalled();
    });

    it('should allow user to update their own profile', async () => {
      const updateUserDto: UpdateUserDto = {
        firstName: 'Updated',
      };

      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockResolvedValue({ ...mockUser, ...updateUserDto });

      const result = await service.update(mockUser.id, updateUserDto, mockUser);

      expect(result).toEqual({ ...mockUser, ...updateUserDto });
    });

    it('should throw NotFoundException when user not found', async () => {
      const updateUserDto: UpdateUserDto = {
        firstName: 'Updated',
      };

      repository.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', updateUserDto, mockAdmin)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when non-admin tries to update role', async () => {
      const updateUserDto: UpdateUserDto = {
        role: UserRole.ADMIN,
      };

      repository.findOne.mockResolvedValue(mockUser);

      await expect(service.update(mockUser.id, updateUserDto, mockUser)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user tries to update another user', async () => {
      const updateUserDto: UpdateUserDto = {
        firstName: 'Updated',
      };
      const anotherUser = { ...mockUser, id: 'another-id' };

      repository.findOne.mockResolvedValue(anotherUser);

      await expect(service.update(anotherUser.id, updateUserDto, mockUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should delete user successfully when admin', async () => {
      repository.delete.mockResolvedValue({ affected: 1, raw: {} });

      await service.remove(mockUser.id, mockAdmin);

      expect(repository.delete).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw ForbiddenException when non-admin tries to delete', async () => {
      await expect(service.remove(mockUser.id, mockUser)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when admin tries to delete themselves', async () => {
      await expect(service.remove(mockAdmin.id, mockAdmin)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.delete.mockResolvedValue({ affected: 0, raw: {} });

      await expect(service.remove('nonexistent-id', mockAdmin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRole', () => {
    it('should update user role successfully when admin', async () => {
      const newRole = UserRole.EDITOR;
      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockResolvedValue({ ...mockUser, role: newRole });

      const result = await service.updateRole(mockUser.id, newRole, mockAdmin);

      expect(result.role).toBe(newRole);
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when non-admin tries to update role', async () => {
      await expect(service.updateRole(mockUser.id, UserRole.ADMIN, mockUser)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.updateRole('nonexistent-id', UserRole.EDITOR, mockAdmin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserStatus', () => {
    it('should toggle user status successfully when admin', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockResolvedValue({ ...mockUser, isActive: false });

      const result = await service.updateUserStatus(mockUser.id, mockAdmin);

      expect(result.isActive).toBe(false);
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when non-admin tries to update status', async () => {
      await expect(service.updateUserStatus(mockUser.id, mockUser)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when admin tries to deactivate themselves', async () => {
      await expect(service.updateUserStatus(mockAdmin.id, mockAdmin)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.updateUserStatus('nonexistent-id', mockAdmin)).rejects.toThrow(NotFoundException);
    });
  });
}); 