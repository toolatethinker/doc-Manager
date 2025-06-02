import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IngestionJob, IngestionStatus } from './entities/ingestion-job.entity';
import { CreateIngestionJobDto } from './dto/create-ingestion-job.dto';
import { UpdateIngestionJobDto } from './dto/update-ingestion-job.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { DocumentsService } from '../documents/documents.service';
import { DocumentStatus } from '../documents/entities/document.entity';

@Injectable()
export class IngestionService {
  constructor(
    @InjectRepository(IngestionJob)
    private ingestionJobsRepository: Repository<IngestionJob>,
    private documentsService: DocumentsService,
  ) {}

  async create(createIngestionJobDto: CreateIngestionJobDto, user: User): Promise<IngestionJob> {
    const document = await this.documentsService.findOne(createIngestionJobDto.documentId, user);
    
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.status === DocumentStatus.PROCESSING) {
      throw new BadRequestException('Document is already being processed');
    }

    const ingestionJob = this.ingestionJobsRepository.create({
      documentId: createIngestionJobDto.documentId,
      config: createIngestionJobDto.config || {},
      status: IngestionStatus.PENDING,
    });

    const savedJob = await this.ingestionJobsRepository.save(ingestionJob);

    await this.documentsService.updateStatus(
      createIngestionJobDto.documentId,
      DocumentStatus.PROCESSING,
      user,
    );

    this.simulateIngestionProcess(savedJob.id);

    return savedJob;
  }

  async findAll(user: User): Promise<IngestionJob[]> {
    const query = this.ingestionJobsRepository.createQueryBuilder('job')
      .leftJoinAndSelect('job.document', 'document')
      .leftJoinAndSelect('document.uploadedBy', 'user')
      .select([
        'job.id',
        'job.status',
        'job.errorMessage',
        'job.result',
        'job.config',
        'job.createdAt',
        'job.updatedAt',
        'job.startedAt',
        'job.completedAt',
        'document.id',
        'document.filename',
        'document.originalName',
        'user.id',
        'user.firstName',
        'user.lastName',
      ]);

    // Non-admin users can only see jobs for their own documents
    if (user.role !== UserRole.ADMIN) {
      query.where('document.uploadedById = :userId', { userId: user.id });
    }

    return await query.getMany();
  }

  async findOne(id: string, user: User): Promise<IngestionJob> {
    const job = await this.ingestionJobsRepository.findOne({
      where: { id },
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

    if (!job) {
      throw new NotFoundException('Ingestion job not found');
    }

    // Non-admin users can only access jobs for their own documents
    if (user.role !== UserRole.ADMIN && job.document.uploadedBy.id !== user.id) {
      throw new ForbiddenException('You can only access jobs for your own documents');
    }

    return job;
  }

  async update(id: string, updateIngestionJobDto: UpdateIngestionJobDto, user: User): Promise<IngestionJob> {
    const job = await this.findOne(id, user);

    // Only admins can update ingestion jobs
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can update ingestion jobs');
    }

    Object.assign(job, updateIngestionJobDto);

    if (updateIngestionJobDto.status === IngestionStatus.RUNNING && !job.startedAt) {
      job.startedAt = new Date();
    }

    if (
      updateIngestionJobDto.status &&
      [IngestionStatus.COMPLETED, IngestionStatus.FAILED, IngestionStatus.CANCELLED].includes(
        updateIngestionJobDto.status,
      ) &&
      !job.completedAt
    ) {
      job.completedAt = new Date();

      const documentStatus = updateIngestionJobDto.status === IngestionStatus.COMPLETED
        ? DocumentStatus.PROCESSED
        : DocumentStatus.FAILED;

      await this.documentsService.updateStatus(job.documentId, documentStatus, user);
    }

    return await this.ingestionJobsRepository.save(job);
  }

  async cancel(id: string, user: User): Promise<IngestionJob> {
    const job = await this.findOne(id, user);

    if (job.status === IngestionStatus.COMPLETED || job.status === IngestionStatus.FAILED) {
      throw new BadRequestException('Cannot cancel a completed or failed job');
    }

    // Only admins or document owners can cancel jobs
    if (user.role !== UserRole.ADMIN && job.document.uploadedBy.id !== user.id) {
      throw new ForbiddenException('You can only cancel jobs for your own documents');
    }

    job.status = IngestionStatus.CANCELLED;
    job.completedAt = new Date();

    const updatedJob = await this.ingestionJobsRepository.save(job);

    await this.documentsService.updateStatus(job.documentId, DocumentStatus.UPLOADED, user);

    return updatedJob;
  }

  async remove(id: string, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can delete ingestion jobs');
    }

    const result = await this.ingestionJobsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Ingestion job not found');
    }
  }

  // Webhook endpoint
  async handleWebhook(jobId: string, updateData: UpdateIngestionJobDto): Promise<IngestionJob> {
    const job = await this.ingestionJobsRepository.findOne({ where: { id: jobId } });
    
    if (!job) {
      throw new NotFoundException('Ingestion job not found');
    }

    Object.assign(job, updateData);

    if (updateData.status === IngestionStatus.RUNNING && !job.startedAt) {
      job.startedAt = new Date();
    }

    if (
      updateData.status &&
      [IngestionStatus.COMPLETED, IngestionStatus.FAILED, IngestionStatus.CANCELLED].includes(
        updateData.status,
      ) &&
      !job.completedAt
    ) {
      job.completedAt = new Date();
    }

    return await this.ingestionJobsRepository.save(job);
  }

  // Simulate ingestion process
  private async simulateIngestionProcess(jobId: string): Promise<void> {
    setTimeout(async () => {
      try {
        const job = await this.ingestionJobsRepository.findOne({ where: { id: jobId } });
        if (job) {
          job.status = IngestionStatus.RUNNING;
          job.startedAt = new Date();
          await this.ingestionJobsRepository.save(job);

          setTimeout(async () => {
            job.status = IngestionStatus.COMPLETED;
            job.completedAt = new Date();
            job.result = {
              extractedText: 'Sample extracted text from document...',
              summary: 'This is a sample summary of the document.',
              language: 'en',
              wordCount: 150,
            };
            await this.ingestionJobsRepository.save(job);
          }, 5000);
        }
      } catch (error) {
        console.error('Error in simulated ingestion process:', error);
      }
    }, 1000);
  }
} 