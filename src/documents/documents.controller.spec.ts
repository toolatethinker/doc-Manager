import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { User, UserRole } from '../users/entities/user.entity';
import { Document, DocumentStatus } from './entities/document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let documentsService: jest.Mocked<DocumentsService>;
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
    filename: 'test-document.pdf',
    originalName: 'test-document.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    filePath: '/uploads/test-document.pdf',
    status: DocumentStatus.UPLOADED,
    description: 'Test document',
    metadata: { category: 'test' },
    uploadedBy: mockUser,
    uploadedById: mockUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    ingestionJobs: [],
  };

  const createMockFile = (size: number, originalname: string = 'test.pdf'): Express.Multer.File => ({
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype: 'application/pdf',
    size,
    buffer: Buffer.alloc(size),
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        {
          provide: DocumentsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            downloadDocument: jest.fn(),
            updateStatus: jest.fn(),
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

    controller = module.get<DocumentsController>(DocumentsController);
    documentsService = module.get(DocumentsService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadDocument', () => {
    const createDocumentDto: CreateDocumentDto = {
      description: 'Test document',
      metadata: { category: 'test' },
    };

    it('should upload document successfully', async () => {
      const file = createMockFile(1024 * 1024); // 1MB file
      documentsService.create.mockResolvedValue(mockDocument);

      const result = await controller.uploadDocument(
        file,
        createDocumentDto,
        { user: mockUser } as any,
      );

      expect(result).toEqual(mockDocument);
      expect(documentsService.create).toHaveBeenCalledWith(file, createDocumentDto, mockUser);
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(
        controller.uploadDocument(
          undefined as any,
          createDocumentDto,
          { user: mockUser } as any,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(documentsService.create).not.toHaveBeenCalled();
    });

    // Note: File size validation is now handled by Multer configuration and MulterExceptionFilter
    // These tests would be integration tests that test the actual Multer behavior
  });

  describe('findAllDocuments', () => {
    it('should return all documents for user', async () => {
      const documents = [mockDocument];
      documentsService.findAll.mockResolvedValue(documents);

      const result = await controller.findAllDocuments({ user: mockUser } as any);

      expect(result).toEqual(documents);
      expect(documentsService.findAll).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('findDocumentById', () => {
    it('should return document by id', async () => {
      documentsService.findOne.mockResolvedValue(mockDocument);

      const result = await controller.findDocumentById(mockDocument.id, { user: mockUser } as any);

      expect(result).toEqual(mockDocument);
      expect(documentsService.findOne).toHaveBeenCalledWith(mockDocument.id, mockUser);
    });
  });

  describe('downloadDocument', () => {
    it('should download document successfully', async () => {
      const downloadInfo = {
        filePath: '/uploads/test-document.pdf',
        filename: 'test-document.pdf',
      };

      documentsService.downloadDocument.mockResolvedValue(downloadInfo);

      const mockResponse = {
        download: jest.fn(),
      } as any as Response;

      await controller.downloadDocument(mockDocument.id, { user: mockUser } as any, mockResponse);

      expect(documentsService.downloadDocument).toHaveBeenCalledWith(mockDocument.id, mockUser);
      expect(mockResponse.download).toHaveBeenCalledWith(downloadInfo.filePath, downloadInfo.filename);
    });
  });

  describe('updateDocumentById', () => {
    it('should update document successfully', async () => {
      const updateDto: UpdateDocumentDto = {
        description: 'Updated description',
      };

      const updatedDocument = { ...mockDocument, ...updateDto };
      documentsService.update.mockResolvedValue(updatedDocument);

      const result = await controller.updateDocumentById(
        mockDocument.id,
        updateDto,
        { user: mockUser } as any,
      );

      expect(result).toEqual(updatedDocument);
      expect(documentsService.update).toHaveBeenCalledWith(mockDocument.id, updateDto, mockUser);
    });
  });

  describe('updateDocumentStatus', () => {
    it('should update document status successfully when user is admin', async () => {
      const newStatus = DocumentStatus.PROCESSED;
      const updatedDocument = { ...mockDocument, status: newStatus };

      documentsService.updateStatus.mockResolvedValue(updatedDocument);

      const result = await controller.updateDocumentStatus(
        mockDocument.id,
        newStatus,
        { user: mockAdmin } as any,
      );

      expect(result).toEqual(updatedDocument);
      expect(documentsService.updateStatus).toHaveBeenCalledWith(mockDocument.id, newStatus, mockAdmin);
    });
  });

  describe('deleteDocument', () => {
    it('should delete document successfully', async () => {
      documentsService.remove.mockResolvedValue(undefined);

      await controller.deleteDocument(mockDocument.id, { user: mockUser } as any);

      expect(documentsService.remove).toHaveBeenCalledWith(mockDocument.id, mockUser);
    });
  });
}); 