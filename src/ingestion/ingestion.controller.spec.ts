import { Test, TestingModule } from '@nestjs/testing';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { IngestionJob, IngestionStatus } from './entities/ingestion-job.entity';
import { Document, DocumentStatus } from '../documents/entities/document.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateIngestionJobDto } from './dto/create-ingestion-job.dto';
import { UpdateIngestionJobDto } from './dto/update-ingestion-job.dto';

describe('IngestionController', () => {
  let controller: IngestionController;
  let service: jest.Mocked<IngestionService>;

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

  const mockIngestionJob: IngestionJob = {
    id: '987e6543-e89b-12d3-a456-426614174003',
    documentId: mockDocument.id,
    document: mockDocument,
    status: IngestionStatus.PENDING,
    result: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    config: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRequest = { user: mockUser };
  const mockAdminRequest = { user: mockAdmin };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [
        {
          provide: IngestionService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            cancel: jest.fn(),
            remove: jest.fn(),
            handleWebhook: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<IngestionController>(IngestionController);
    service = module.get(IngestionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createIngestionJob', () => {
    it('should create an ingestion job successfully', async () => {
      const createIngestionJobDto: CreateIngestionJobDto = {
        documentId: mockDocument.id,
      };

      service.create.mockResolvedValue(mockIngestionJob);

      const result = await controller.createIngestionJob(createIngestionJobDto, mockRequest);

      expect(result).toEqual(mockIngestionJob);
      expect(service.create).toHaveBeenCalledWith(createIngestionJobDto, mockUser);
    });
  });

  describe('findAllIngestionJobs', () => {
    it('should return all ingestion jobs', async () => {
      const jobs = [mockIngestionJob];
      service.findAll.mockResolvedValue(jobs);

      const result = await controller.findAllIngestionJobs(mockRequest);

      expect(result).toEqual(jobs);
      expect(service.findAll).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('findIngestionJobById', () => {
    it('should return an ingestion job by id', async () => {
      service.findOne.mockResolvedValue(mockIngestionJob);

      const result = await controller.findIngestionJobById(mockIngestionJob.id, mockRequest);

      expect(result).toEqual(mockIngestionJob);
      expect(service.findOne).toHaveBeenCalledWith(mockIngestionJob.id, mockUser);
    });
  });

  describe('updateIngestionJobById', () => {
    it('should update an ingestion job', async () => {
      const updateIngestionJobDto: UpdateIngestionJobDto = {
        status: IngestionStatus.COMPLETED,
        result: { extractedText: 'Sample text' },
      };
      const updatedJob = { ...mockIngestionJob, ...updateIngestionJobDto };

      service.update.mockResolvedValue(updatedJob);

      const result = await controller.updateIngestionJobById(mockIngestionJob.id, updateIngestionJobDto, mockAdminRequest);

      expect(result).toEqual(updatedJob);
      expect(service.update).toHaveBeenCalledWith(mockIngestionJob.id, updateIngestionJobDto, mockAdmin);
    });
  });

  describe('cancelIngestionJob', () => {
    it('should cancel an ingestion job', async () => {
      const cancelledJob = { ...mockIngestionJob, status: IngestionStatus.CANCELLED };

      service.cancel.mockResolvedValue(cancelledJob);

      const result = await controller.cancelIngestionJob(mockIngestionJob.id, mockRequest);

      expect(result).toEqual(cancelledJob);
      expect(service.cancel).toHaveBeenCalledWith(mockIngestionJob.id, mockUser);
    });
  });

  describe('deleteIngestionJob', () => {
    it('should remove an ingestion job', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.deleteIngestionJob(mockIngestionJob.id, mockAdminRequest);

      expect(service.remove).toHaveBeenCalledWith(mockIngestionJob.id, mockAdmin);
    });
  });

  describe('handleWebhook', () => {
    it('should handle webhook successfully', async () => {
      const updateData: UpdateIngestionJobDto = {
        status: IngestionStatus.COMPLETED,
        result: { extractedText: 'Sample text' },
      };
      const jobId = mockIngestionJob.id;
      const updatedJob = { ...mockIngestionJob, status: IngestionStatus.COMPLETED, result: { extractedText: 'Sample text' } };

      service.handleWebhook.mockResolvedValue(updatedJob);

      const result = await controller.handleWebhook(jobId, updateData);

      expect(result).toEqual(updatedJob);
      expect(service.handleWebhook).toHaveBeenCalledWith(jobId, updateData);
    });
  });
}); 