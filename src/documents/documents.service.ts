import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Document, DocumentStatus } from './entities/document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { User, UserRole } from '../users/entities/user.entity';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DocumentsService {
  private readonly uploadPath: string;

  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
    private configService: ConfigService,
  ) {
    this.uploadPath = this.configService.get<string>('UPLOAD_PATH', './uploads');
    
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  async create(
    file: Express.Multer.File,
    createDocumentDto: CreateDocumentDto,
    user: User,
  ): Promise<Document> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const filename = `${uuidv4()}-${file.originalname}`;
    const filePath = path.join(this.uploadPath, filename);

    fs.writeFileSync(filePath, file.buffer);

    const document = this.documentsRepository.create({
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      filePath,
      description: createDocumentDto.description,
      metadata: createDocumentDto.metadata,
      uploadedById: user.id,
      status: DocumentStatus.UPLOADED,
    });

    return await this.documentsRepository.save(document);
  }

  async findAll(user: User): Promise<Document[]> {
    const query = this.documentsRepository.createQueryBuilder('document')
      .leftJoinAndSelect('document.uploadedBy', 'user')
      .select([
        'document.id',
        'document.filename',
        'document.filePath',
        'document.originalName',
        'document.mimeType',
        'document.size',
        'document.status',
        'document.description',
        'document.metadata',
        'document.createdAt',
        'document.updatedAt',
        'user.id',
        'user.firstName',
        'user.lastName',
        'user.email',
      ]);

    // Non-admin users can only see their own documents
    if (user.role !== UserRole.ADMIN) {
      query.where('document.uploadedById = :userId', { userId: user.id });
    }

    return await query.getMany();
  }

  async findOne(id: string, user: User): Promise<Document> {
    const document = await this.documentsRepository.findOne({
      where: { id },
      relations: ['uploadedBy'],
      select: {
        id: true,
        filename: true,
        filePath: true,
        originalName: true,
        mimeType: true,
        size: true,
        status: true,
        description: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Non-admin users can only access their own documents
    if (user.role !== UserRole.ADMIN && document.uploadedById !== user.id) {
      throw new ForbiddenException('You can only access your own documents');
    }

    return document;
  }

  async update(
    id: string,
    updateDocumentDto: UpdateDocumentDto,
    user: User,
  ): Promise<Document> {
    const document = await this.documentsRepository.findOne({ where: { id } });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Only admins or document owners can update documents
    if (user.role !== UserRole.ADMIN && document.uploadedById !== user.id) {
      throw new ForbiddenException('You can only update your own documents');
    }

    // Only admins can update document status
    if (updateDocumentDto.status && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can update document status');
    }

    Object.assign(document, updateDocumentDto);
    return await this.documentsRepository.save(document);
  }

  async remove(id: string, user: User): Promise<void> {
    const document = await this.documentsRepository.findOne({ where: { id } });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Only admins or document owners can delete documents
    if (user.role !== UserRole.ADMIN && document.uploadedById !== user.id) {
      throw new ForbiddenException('You can only delete your own documents');
    }

    // Delete file from disk
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    await this.documentsRepository.remove(document);
  }

  async downloadDocument(id: string, user: User): Promise<{ filePath: string; filename: string }> {
    const document = await this.findOne(id, user);

    if (!fs.existsSync(document.filePath)) {
      throw new NotFoundException('File not found on disk');
    }

    return {
      filePath: document.filePath,
      filename: document.originalName,
    };
  }

  async updateStatus(id: string, status: DocumentStatus, user: User): Promise<Document> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can update document status');
    }

    const document = await this.documentsRepository.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    document.status = status;
    return await this.documentsRepository.save(document);
  }
} 