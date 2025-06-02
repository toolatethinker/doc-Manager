// Mock app-root-path before any other imports
jest.mock('app-root-path', () => ({
  path: '/mock/path',
  resolve: jest.fn(),
  toString: () => '/mock/path',
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from './documents.service';
import { Document, DocumentStatus } from './entities/document.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs and path modules
jest.mock('fs');
jest.mock('path');

describe('DocumentsService', () => {
  let service: DocumentsService;
  let repository: jest.Mocked<Repository<Document>>;
  let configService: jest.Mocked<ConfigService>;

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

  const mockDocument: Document = {
    id: '789e0123-e89b-12d3-a456-426614174002',
    filename: 'test-file.pdf',
    originalName: 'original-file.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    filePath: './uploads/test-file.pdf',
    status: DocumentStatus.UPLOADED,
    description: 'Test document',
    metadata: { category: 'test' },
    uploadedById: mockUser.id,
    uploadedBy: mockUser,
    createdAt: new Date(),
    updatedAt: new Date(),
    ingestionJobs: [],
  };

  // Helper function to create mock files with specific sizes
  const createMockFile = (sizeInBytes: number, originalname: string = 'test.pdf'): Express.Multer.File => ({
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: sizeInBytes,
    buffer: Buffer.alloc(sizeInBytes),
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: getRepositoryToken(Document),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    repository = module.get(getRepositoryToken(Document));
    configService = module.get(ConfigService);

    // Mock fs methods
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);
    (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);
    (path.join as jest.Mock).mockReturnValue('./uploads/test-file.pdf');

    // Mock config service defaults
    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'UPLOAD_PATH') return './uploads';
      return defaultValue;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDocumentDto: CreateDocumentDto = {
      description: 'Test document',
      metadata: { category: 'test' },
    };

    it('should create a document successfully', async () => {
      const file = createMockFile(1024, 'test.pdf');
      
      repository.create.mockReturnValue(mockDocument);
      repository.save.mockResolvedValue(mockDocument);

      const result = await service.create(file, createDocumentDto, mockUser);

      expect(result).toEqual(mockDocument);
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          uploadedById: mockUser.id,
          status: DocumentStatus.UPLOADED,
          description: createDocumentDto.description,
          metadata: createDocumentDto.metadata,
        })
      );
      expect(repository.save).toHaveBeenCalledWith(mockDocument);
    });

    it('should throw BadRequestException when no file provided', async () => {
      await expect(service.create(null, createDocumentDto, mockUser)).rejects.toThrow(
        new BadRequestException('No file provided')
      );
    });

    it('should create upload directory if it does not exist', async () => {
      // This test should verify that the constructor creates the directory
      // when the service is instantiated and the directory doesn't exist
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      // Re-create the service to trigger constructor
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DocumentsService,
          {
            provide: getRepositoryToken(Document),
            useValue: repository,
          },
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const newService = module.get<DocumentsService>(DocumentsService);

      expect(fs.mkdirSync).toHaveBeenCalledWith('./uploads', { recursive: true });
    });

    it('should handle different file types', async () => {
      const testCases = [
        { originalname: 'document.pdf', mimetype: 'application/pdf' },
        { originalname: 'image.jpg', mimetype: 'image/jpeg' },
        { originalname: 'document.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      ];

      for (const testCase of testCases) {
        const file = {
          ...createMockFile(1024, testCase.originalname),
          mimetype: testCase.mimetype,
        };
        
        repository.create.mockReturnValue({
          ...mockDocument,
          originalName: testCase.originalname,
          mimeType: testCase.mimetype,
        });
        repository.save.mockResolvedValue({
          ...mockDocument,
          originalName: testCase.originalname,
          mimeType: testCase.mimetype,
        });

        const result = await service.create(file, createDocumentDto, mockUser);

        expect(result.originalName).toBe(testCase.originalname);
        expect(result.mimeType).toBe(testCase.mimetype);
      }
    });

    it('should generate unique filename for uploaded file', async () => {
      const file = createMockFile(1024, 'test.pdf');
      
      repository.create.mockReturnValue(mockDocument);
      repository.save.mockResolvedValue(mockDocument);

      await service.create(file, createDocumentDto, mockUser);

      const createCall = repository.create.mock.calls[0][0];
      expect(createCall.filename).toMatch(/^[a-f0-9-]+-test\.pdf$/);
      expect(createCall.filename).not.toBe(file.originalname);
    });
  });

  describe('findAll', () => {
    it('should return all documents for admin', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockDocument]),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAll(mockAdmin);

      expect(result).toEqual([mockDocument]);
      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
    });

    it('should return only user documents for non-admin', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockDocument]),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAll(mockUser);

      expect(result).toEqual([mockDocument]);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'document.uploadedById = :userId', 
        { userId: mockUser.id }
      );
    });

    it('should return empty array when user has no documents', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAll(mockUser);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return document when user is owner', async () => {
      repository.findOne.mockResolvedValue(mockDocument);

      const result = await service.findOne(mockDocument.id, mockUser);

      expect(result).toEqual(mockDocument);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockDocument.id },
        relations: ['uploadedBy'],
        select: expect.any(Object),
      });
    });

    it('should return document when user is admin', async () => {
      repository.findOne.mockResolvedValue(mockDocument);

      const result = await service.findOne(mockDocument.id, mockAdmin);

      expect(result).toEqual(mockDocument);
    });

    it('should throw NotFoundException when document not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id', mockUser)).rejects.toThrow(
        new NotFoundException('Document not found')
      );
    });

    it('should throw ForbiddenException when user is not owner and not admin', async () => {
      const anotherUser = { ...mockUser, id: 'another-id' };
      const documentWithDifferentOwner = { ...mockDocument, uploadedById: 'different-owner-id' };

      repository.findOne.mockResolvedValue(documentWithDifferentOwner);

      await expect(service.findOne(mockDocument.id, anotherUser)).rejects.toThrow(
        new ForbiddenException('You can only access your own documents')
      );
    });
  });

  describe('update', () => {
    it('should update document successfully when user is owner', async () => {
      const updateDocumentDto: UpdateDocumentDto = {
        description: 'Updated description',
        metadata: { category: 'updated' },
      };

      repository.findOne.mockResolvedValue(mockDocument);
      repository.save.mockResolvedValue({ ...mockDocument, ...updateDocumentDto });

      const result = await service.update(mockDocument.id, updateDocumentDto, mockUser);

      expect(result).toEqual({ ...mockDocument, ...updateDocumentDto });
      expect(repository.save).toHaveBeenCalled();
    });

    it('should update document successfully when user is admin', async () => {
      const updateDocumentDto: UpdateDocumentDto = {
        description: 'Updated description',
        status: DocumentStatus.PROCESSED,
      };

      repository.findOne.mockResolvedValue(mockDocument);
      repository.save.mockResolvedValue({ ...mockDocument, ...updateDocumentDto });

      const result = await service.update(mockDocument.id, updateDocumentDto, mockAdmin);

      expect(result).toEqual({ ...mockDocument, ...updateDocumentDto });
    });

    it('should throw NotFoundException when document not found', async () => {
      const updateDocumentDto: UpdateDocumentDto = {
        description: 'Updated description',
      };

      repository.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', updateDocumentDto, mockUser)).rejects.toThrow(
        new NotFoundException('Document not found')
      );
    });

    it('should throw ForbiddenException when non-admin tries to update status', async () => {
      const updateDocumentDto: UpdateDocumentDto = {
        status: DocumentStatus.PROCESSED,
      };

      repository.findOne.mockResolvedValue(mockDocument);

      await expect(service.update(mockDocument.id, updateDocumentDto, mockUser)).rejects.toThrow(
        new ForbiddenException('Only admins can update document status')
      );
    });

    it('should throw ForbiddenException when user is not owner and not admin', async () => {
      const updateDocumentDto: UpdateDocumentDto = {
        description: 'Updated description',
      };
      const anotherUser = { ...mockUser, id: 'another-id' };
      const documentWithDifferentOwner = { ...mockDocument, uploadedById: 'different-owner-id' };

      repository.findOne.mockResolvedValue(documentWithDifferentOwner);

      await expect(service.update(mockDocument.id, updateDocumentDto, anotherUser)).rejects.toThrow(
        new ForbiddenException('You can only update your own documents')
      );
    });
  });

  describe('remove', () => {
    it('should remove document successfully when user is owner', async () => {
      repository.findOne.mockResolvedValue(mockDocument);
      repository.remove.mockResolvedValue(mockDocument);

      await service.remove(mockDocument.id, mockUser);

      expect(fs.unlinkSync).toHaveBeenCalledWith(mockDocument.filePath);
      expect(repository.remove).toHaveBeenCalledWith(mockDocument);
    });

    it('should remove document successfully when user is admin', async () => {
      repository.findOne.mockResolvedValue(mockDocument);
      repository.remove.mockResolvedValue(mockDocument);

      await service.remove(mockDocument.id, mockAdmin);

      expect(repository.remove).toHaveBeenCalledWith(mockDocument);
    });

    it('should throw NotFoundException when document not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id', mockUser)).rejects.toThrow(
        new NotFoundException('Document not found')
      );
    });

    it('should throw ForbiddenException when user is not owner and not admin', async () => {
      const anotherUser = { ...mockUser, id: 'another-id' };
      const documentWithDifferentOwner = { ...mockDocument, uploadedById: 'different-owner-id' };

      repository.findOne.mockResolvedValue(documentWithDifferentOwner);

      await expect(service.remove(mockDocument.id, anotherUser)).rejects.toThrow(
        new ForbiddenException('You can only delete your own documents')
      );
    });

    it('should not throw error if file does not exist on disk', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      repository.findOne.mockResolvedValue(mockDocument);
      repository.remove.mockResolvedValue(mockDocument);

      await service.remove(mockDocument.id, mockUser);

      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(repository.remove).toHaveBeenCalledWith(mockDocument);
    });
  });

  describe('downloadDocument', () => {
    it('should return file path and filename for download', async () => {
      repository.findOne.mockResolvedValue(mockDocument);

      const result = await service.downloadDocument(mockDocument.id, mockUser);

      expect(result).toEqual({
        filePath: mockDocument.filePath,
        filename: mockDocument.originalName,
      });
    });

    it('should throw NotFoundException when file not found on disk', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      repository.findOne.mockResolvedValue(mockDocument);

      await expect(service.downloadDocument(mockDocument.id, mockUser)).rejects.toThrow(
        new NotFoundException('File not found on disk')
      );
    });

    it('should work for different file types', async () => {
      const testCases = [
        { originalName: 'document.pdf', filePath: './uploads/document.pdf' },
        { originalName: 'image.jpg', filePath: './uploads/image.jpg' },
        { originalName: 'spreadsheet.xlsx', filePath: './uploads/spreadsheet.xlsx' },
      ];

      for (const testCase of testCases) {
        const doc = { ...mockDocument, ...testCase };
        repository.findOne.mockResolvedValue(doc);

        const result = await service.downloadDocument(doc.id, mockUser);

        expect(result).toEqual({
          filePath: testCase.filePath,
          filename: testCase.originalName,
        });
      }
    });
  });

  describe('updateStatus', () => {
    it('should update document status when user is admin', async () => {
      const newStatus = DocumentStatus.PROCESSED;
      repository.findOne.mockResolvedValue(mockDocument);
      repository.save.mockResolvedValue({ ...mockDocument, status: newStatus });

      const result = await service.updateStatus(mockDocument.id, newStatus, mockAdmin);

      expect(result.status).toBe(newStatus);
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is not admin', async () => {
      const newStatus = DocumentStatus.PROCESSED;

      await expect(service.updateStatus(mockDocument.id, newStatus, mockUser)).rejects.toThrow(
        new ForbiddenException('Only admins can update document status')
      );
    });

    it('should throw NotFoundException when document not found', async () => {
      const newStatus = DocumentStatus.PROCESSED;
      repository.findOne.mockResolvedValue(null);

      await expect(service.updateStatus('nonexistent-id', newStatus, mockAdmin)).rejects.toThrow(
        new NotFoundException('Document not found')
      );
    });

    it('should handle all document status transitions', async () => {
      const statusTransitions = [
        DocumentStatus.UPLOADED,
        DocumentStatus.PROCESSING,
        DocumentStatus.PROCESSED,
        DocumentStatus.FAILED,
      ];

      for (const status of statusTransitions) {
        repository.findOne.mockResolvedValue(mockDocument);
        repository.save.mockResolvedValue({ ...mockDocument, status });

        const result = await service.updateStatus(mockDocument.id, status, mockAdmin);

        expect(result.status).toBe(status);
      }
    });
  });

  describe('File System Operations', () => {
    it('should handle file system errors gracefully', async () => {
      const file = createMockFile(1024, 'test.pdf');
      const createDocumentDto: CreateDocumentDto = { description: 'Test' };
      
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File system error');
      });

      await expect(service.create(file, createDocumentDto, mockUser)).rejects.toThrow('File system error');
    });

    it('should use custom upload path when configured', async () => {
      const customPath = '/custom/upload/path';
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'UPLOAD_PATH') return customPath;
        return defaultValue;
      });

      // Re-create service with new config
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DocumentsService,
          {
            provide: getRepositoryToken(Document),
            useValue: repository,
          },
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const newService = module.get<DocumentsService>(DocumentsService);
      
      expect(configService.get).toHaveBeenCalledWith('UPLOAD_PATH', './uploads');
    });
  });
}); 