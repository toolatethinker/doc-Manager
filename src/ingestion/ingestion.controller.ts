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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { IngestionService } from './ingestion.service';
import { CreateIngestionJobDto } from './dto/create-ingestion-job.dto';
import { UpdateIngestionJobDto } from './dto/update-ingestion-job.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('ingestion')
@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('jobs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new ingestion job' })
  @ApiResponse({ status: 201, description: 'Ingestion job created successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 400, description: 'Document is already being processed' })
  create(@Body() createIngestionJobDto: CreateIngestionJobDto, @Request() req) {
    return this.ingestionService.create(createIngestionJobDto, req.user);
  }

  @Get('jobs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all ingestion jobs (filtered by user role)' })
  @ApiResponse({ status: 200, description: 'Ingestion jobs retrieved successfully' })
  findAll(@Request() req) {
    return this.ingestionService.findAll(req.user);
  }

  @Get('jobs/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get ingestion job by ID' })
  @ApiResponse({ status: 200, description: 'Ingestion job retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Ingestion job not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.ingestionService.findOne(id, req.user);
  }

  @Patch('jobs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update ingestion job (Admin only)' })
  @ApiResponse({ status: 200, description: 'Ingestion job updated successfully' })
  @ApiResponse({ status: 404, description: 'Ingestion job not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateIngestionJobDto: UpdateIngestionJobDto,
    @Request() req,
  ) {
    return this.ingestionService.update(id, updateIngestionJobDto, req.user);
  }

  @Post('jobs/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel ingestion job' })
  @ApiResponse({ status: 200, description: 'Ingestion job cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Cannot cancel completed or failed job' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.ingestionService.cancel(id, req.user);
  }

  @Delete('jobs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete ingestion job (Admin only)' })
  @ApiResponse({ status: 200, description: 'Ingestion job deleted successfully' })
  @ApiResponse({ status: 404, description: 'Ingestion job not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.ingestionService.remove(id, req.user);
  }

  @Post('webhook/:jobId')
  @ApiOperation({ summary: 'Webhook endpoint for external ingestion services' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 404, description: 'Ingestion job not found' })
  handleWebhook(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() updateData: UpdateIngestionJobDto,
  ) {
    return this.ingestionService.handleWebhook(jobId, updateData);
  }
} 