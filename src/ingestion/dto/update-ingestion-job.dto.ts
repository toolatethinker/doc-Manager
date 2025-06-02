import { IsOptional, IsEnum, IsString, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IngestionStatus } from '../entities/ingestion-job.entity';

export class UpdateIngestionJobDto {
  @ApiProperty({ enum: IngestionStatus, required: false })
  @IsOptional()
  @IsEnum(IngestionStatus)
  status?: IngestionStatus;

  @ApiProperty({ example: 'Processing failed due to unsupported file format', required: false })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiProperty({ 
    example: { 
      extractedText: 'Document content...', 
      summary: 'Brief summary...', 
      language: 'en' 
    },
    required: false 
  })
  @IsOptional()
  @IsObject()
  result?: Record<string, any>;
} 