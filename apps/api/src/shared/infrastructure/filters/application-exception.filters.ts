import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../domain/exceptions/application.exception.js';

const CODE_TO_HTTP_STATUS: Record<ApplicationExceptionCode, HttpStatus> = {
  [ApplicationExceptionCode.VALIDATION_ERROR]: HttpStatus.BAD_REQUEST,
  [ApplicationExceptionCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ApplicationExceptionCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [ApplicationExceptionCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ApplicationExceptionCode.INTERNAL_SERVER_ERROR]:
    HttpStatus.INTERNAL_SERVER_ERROR,
  [ApplicationExceptionCode.CONFLICT]: HttpStatus.CONFLICT,
};

@Catch(ApplicationException)
export class ApplicationExceptionFilter implements ExceptionFilter {
  catch(exception: ApplicationException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status =
      CODE_TO_HTTP_STATUS[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      path: request.url,
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}
