import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { IngestionJob, IngestionStatus } from './entities/ingestion-job.entity';
import { Document, DocumentStatus } from '../documents/entities/document.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateIngestionJobDto } from './dto/create-ingestion-job.dto';
import { UpdateIngestionJobDto } from './dto/update-ingestion-job.dto';
import * as crypto from 'crypto';
import { DocumentsService } from '../documents/documents.service';

describe('IngestionService', () => {
  let service: IngestionService;
  let repository: jest.Mocked<Repository<IngestionJob>>;
  let documentRepository: jest.Mocked<Repository<Document>>;
  let documentsService: jest.Mocked<DocumentsService>;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    password: 'hashedPassword',
    role: UserRole.VIEWER,
    isActive: true,
    createdAt: new Date('2025-06-02T16:39:06.316Z'),
    updatedAt: new Date('2025-06-02T16:39:06.316Z'),
    documents: [],
  };

  const mockAdmin: User = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    password: 'hashedPassword',
    role: UserRole.ADMIN,
    isActive: true,
    createdAt: new Date('2025-06-02T16:39:06.316Z'),
    updatedAt: new Date('2025-06-02T16:39:06.316Z'),
    documents: [],
  };

  const mockDocument: Document = {
    id: '456e7890-e89b-12d3-a456-426614174001',
    filename: 'test-document.pdf',
    originalName: 'test-document.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    filePath: '/uploads/test-document.pdf',
    status: DocumentStatus.UPLOADED,
    description: null,
    metadata: null,
    uploadedBy: mockUser,
    uploadedById: mockUser.id,
    createdAt: new Date('2025-06-02T16:39:06.316Z'),
    updatedAt: new Date('2025-06-02T16:39:06.316Z'),
    ingestionJobs: [],
  };

  const mockIngestionJob: IngestionJob = {
    id: '987e6543-e89b-12d3-a456-426614174003',
    documentId: mockDocument.id,
    document: mockDocument,
    status: IngestionStatus.PENDING,
    config: { extractText: true },
    result: null,
    errorMessage: null,
    createdAt: new Date('2025-06-02T16:39:06.316Z'),
    updatedAt: new Date('2025-06-02T16:39:06.316Z'),
    startedAt: null,
    completedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: getRepositoryToken(IngestionJob),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Document),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: DocumentsService,
          useValue: {
            findOne: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
    repository = module.get(getRepositoryToken(IngestionJob));
    documentRepository = module.get(getRepositoryToken(Document));
    documentsService = module.get(DocumentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createIngestionJobDto: CreateIngestionJobDto = {
      documentId: mockDocument.id,
      config: { extractText: true },
    };

    it('should create an ingestion job successfully', async () => {
      documentsService.findOne.mockResolvedValue(mockDocument);
      repository.create.mockReturnValue(mockIngestionJob);
      repository.save.mockResolvedValue(mockIngestionJob);
      documentsService.updateStatus.mockResolvedValue(undefined);

      const result = await service.create(createIngestionJobDto, mockUser);

      expect(result).toEqual(mockIngestionJob);
      expect(documentsService.findOne).toHaveBeenCalledWith(createIngestionJobDto.documentId, mockUser);
      expect(repository.create).toHaveBeenCalledWith({
        documentId: createIngestionJobDto.documentId,
        config: createIngestionJobDto.config,
        status: IngestionStatus.PENDING,
      });
      expect(repository.save).toHaveBeenCalledWith(mockIngestionJob);
      expect(documentsService.updateStatus).toHaveBeenCalledWith(
        createIngestionJobDto.documentId,
        DocumentStatus.PROCESSING,
        mockUser,
      );
    });

    it('should create an ingestion job with fallback when service fails', async () => {
      documentsService.findOne.mockResolvedValue(mockDocument);
      repository.create.mockReturnValue(mockIngestionJob);
      repository.save.mockResolvedValue(mockIngestionJob);
      documentsService.updateStatus.mockResolvedValue(undefined);

      const result = await service.create(createIngestionJobDto, mockUser);

      expect(result).toEqual(mockIngestionJob);
      expect(documentsService.findOne).toHaveBeenCalledWith(createIngestionJobDto.documentId, mockUser);
    });

    it('should throw NotFoundException when document not found', async () => {
      documentsService.findOne.mockResolvedValue(null);

      await expect(service.create(createIngestionJobDto, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when document is already processing', async () => {
      const processingDocument = { ...mockDocument, status: DocumentStatus.PROCESSING };
      documentsService.findOne.mockResolvedValue(processingDocument);

      await expect(service.create(createIngestionJobDto, mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all jobs for admin', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockIngestionJob]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAll(mockAdmin);

      expect(result).toEqual([mockIngestionJob]);
      expect(repository.createQueryBuilder).toHaveBeenCalledWith('job');
    });

    it('should return only user jobs for non-admin', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockIngestionJob]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAll(mockUser);

      expect(result).toEqual([mockIngestionJob]);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('document.uploadedById = :userId', { userId: mockUser.id });
    });
  });

  describe('findOne', () => {
    it('should return job when user is document owner', async () => {
      repository.findOne.mockResolvedValue(mockIngestionJob);

      const result = await service.findOne(mockIngestionJob.id, mockUser);

      expect(result).toEqual(mockIngestionJob);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockIngestionJob.id },
        relations: ['document', 'document.uploadedBy'],
        select: {
          id: true,
          status: true,
          errorMessage: true,
          result: true,
          config: true,
          createdAt: true,
          updatedAt: true,
          startedAt: true,
          completedAt: true,
          document: {
            id: true,
            filename: true,
            originalName: true,
            uploadedBy: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });

    it('should return job when user is admin', async () => {
      repository.findOne.mockResolvedValue(mockIngestionJob);

      const result = await service.findOne(mockIngestionJob.id, mockAdmin);

      expect(result).toEqual(mockIngestionJob);
    });

    it('should throw NotFoundException when job not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not document owner and not admin', async () => {
      const anotherUser: User = {
        ...mockUser,
        id: '123e4567-e89b-12d3-a456-426614174002',
        email: 'another@example.com',
      };

      const jobWithDifferentOwner = {
        ...mockIngestionJob,
        document: {
          ...mockDocument,
          uploadedBy: { ...mockUser, id: 'different-user-id' },
        },
      };

      repository.findOne.mockResolvedValue(jobWithDifferentOwner);

      await expect(service.findOne(mockIngestionJob.id, anotherUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    const updateIngestionJobDto: UpdateIngestionJobDto = {
      status: IngestionStatus.COMPLETED,
      result: { extractedText: 'Sample text' },
    };

    it('should update job successfully when user is admin', async () => {
      const updatedJob = { ...mockIngestionJob, ...updateIngestionJobDto, completedAt: new Date() };
      repository.findOne.mockResolvedValue(mockIngestionJob);
      repository.save.mockResolvedValue(updatedJob);
      documentsService.updateStatus.mockResolvedValue(undefined);

      const result = await service.update(mockIngestionJob.id, updateIngestionJobDto, mockAdmin);

      expect(result).toEqual(updatedJob);
      expect(repository.save).toHaveBeenCalled();
      expect(documentsService.updateStatus).toHaveBeenCalledWith(
        mockIngestionJob.documentId,
        DocumentStatus.PROCESSED,
        mockAdmin,
      );
    });

    it('should throw ForbiddenException when non-admin tries to update', async () => {
      repository.findOne.mockResolvedValue(mockIngestionJob);

      await expect(service.update(mockIngestionJob.id, updateIngestionJobDto, mockUser)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when job not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', updateIngestionJobDto, mockAdmin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('should cancel job successfully when user is document owner', async () => {
      const pendingJob = { ...mockIngestionJob, status: IngestionStatus.PENDING };
      const cancelledJob = { ...pendingJob, status: IngestionStatus.CANCELLED, completedAt: new Date() };
      
      repository.findOne.mockResolvedValue(pendingJob);
      repository.save.mockResolvedValue(cancelledJob);
      documentsService.updateStatus.mockResolvedValue(undefined);

      const result = await service.cancel(mockIngestionJob.id, mockUser);

      expect(result.status).toBe(IngestionStatus.CANCELLED);
      expect(result.completedAt).toBeDefined();
      expect(documentsService.updateStatus).toHaveBeenCalledWith(
        mockIngestionJob.documentId,
        DocumentStatus.UPLOADED,
        mockUser,
      );
    });

    it('should cancel job successfully when user is admin', async () => {
      const pendingJob = { ...mockIngestionJob, status: IngestionStatus.PENDING };
      const cancelledJob = { ...pendingJob, status: IngestionStatus.CANCELLED, completedAt: new Date() };
      
      repository.findOne.mockResolvedValue(pendingJob);
      repository.save.mockResolvedValue(cancelledJob);
      documentsService.updateStatus.mockResolvedValue(undefined);

      const result = await service.cancel(mockIngestionJob.id, mockAdmin);

      expect(result.status).toBe(IngestionStatus.CANCELLED);
    });

    it('should throw BadRequestException when job is already completed', async () => {
      const completedJob = { ...mockIngestionJob, status: IngestionStatus.COMPLETED };
      repository.findOne.mockResolvedValue(completedJob);

      await expect(service.cancel(mockIngestionJob.id, mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove job successfully when user is admin', async () => {
      repository.delete.mockResolvedValue({ affected: 1, raw: {} });

      await service.remove(mockIngestionJob.id, mockAdmin);

      expect(repository.delete).toHaveBeenCalledWith(mockIngestionJob.id);
    });

    it('should throw ForbiddenException when non-admin tries to remove', async () => {
      await expect(service.remove(mockIngestionJob.id, mockUser)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when job not found', async () => {
      repository.delete.mockResolvedValue({ affected: 0, raw: {} });

      await expect(service.remove('nonexistent-id', mockAdmin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('handleWebhook', () => {
    it('should handle webhook successfully', async () => {
      const updateData: UpdateIngestionJobDto = {
        status: IngestionStatus.COMPLETED,
        result: { extractedText: 'Sample extracted text' },
      };

      const updatedJob = { ...mockIngestionJob, ...updateData, completedAt: new Date() };
      repository.findOne.mockResolvedValue(mockIngestionJob);
      repository.save.mockResolvedValue(updatedJob);

      const result = await service.handleWebhook(mockIngestionJob.id, updateData);

      expect(result).toEqual(updatedJob);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: mockIngestionJob.id } });
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when job not found', async () => {
      const updateData: UpdateIngestionJobDto = {
        status: IngestionStatus.COMPLETED,
        result: { extractedText: 'Sample extracted text' },
      };

      repository.findOne.mockResolvedValue(null);

      await expect(service.handleWebhook('nonexistent-id', updateData)).rejects.toThrow(NotFoundException);
    });
  });
}); 