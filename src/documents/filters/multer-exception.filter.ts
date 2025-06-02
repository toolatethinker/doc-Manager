import { ExceptionFilter, Catch, ArgumentsHost, BadRequestException } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception.code === 'LIMIT_FILE_SIZE') {
      const maxSizeMB = Math.round(exception.limit / (1024 * 1024));
      return response.status(413).json({
        statusCode: 413,
        message: `File size exceeds the maximum allowed size of ${maxSizeMB}MB`,
        error: 'Payload Too Large',
      });
    }

    if (exception.code && exception.code.startsWith('LIMIT_')) {
      return response.status(400).json({
        statusCode: 400,
        message: exception.message || 'File upload error',
        error: 'Bad Request',
      });
    }

    throw exception;
  }
} 