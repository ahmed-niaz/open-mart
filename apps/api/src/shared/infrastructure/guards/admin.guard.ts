import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../domain/exceptions/application.exception.js';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user || (user.scope !== 'admin' && user.role !== 'admin')) {
      throw new ApplicationException(
        'Forbidden: Admin access required',
        ApplicationExceptionCode.FORBIDDEN,
      );
    }

    return true;
  }
}
