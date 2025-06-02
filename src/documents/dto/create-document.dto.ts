import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDocumentDto {
  @ApiProperty({ example: 'My important document' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: { category: 'legal', tags: ['contract', 'important'] } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
} 