import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { CreateDocumentDto } from './create-document.dto';
import { DocumentStatus } from '../entities/document.entity';

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;
} 