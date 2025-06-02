import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { DocumentStatus } from './entities/document.entity';

@ApiTags('documents')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a document' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @ApiResponse({ status: 400, description: 'No file provided' })
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() createDocumentDto: CreateDocumentDto,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    console.log("Ye chala");
    return this.documentsService.create(file, createDocumentDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all documents (filtered by user role)' })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully' })
  findAll(@Request() req) {
    return this.documentsService.findAll(req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document by ID' })
  @ApiResponse({ status: 200, description: 'Document retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.documentsService.findOne(id, req.user);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download document file' })
  @ApiResponse({ status: 200, description: 'File downloaded successfully' })
  @ApiResponse({ status: 404, description: 'Document or file not found' })
  async downloadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const { filePath, filename } = await this.documentsService.downloadDocument(id, req.user);
    res.download(filePath, filename);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update document metadata' })
  @ApiResponse({ status: 200, description: 'Document updated successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
    @Request() req,
  ) {
    return this.documentsService.update(id, updateDocumentDto, req.user);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update document status (Admin only)' })
  @ApiResponse({ status: 200, description: 'Document status updated successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: DocumentStatus,
    @Request() req,
  ) {
    return this.documentsService.updateStatus(id, status, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete document' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.documentsService.remove(id, req.user);
  }
} 