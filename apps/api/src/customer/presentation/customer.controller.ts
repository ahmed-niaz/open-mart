import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Request, Response } from 'express';

import { RegisterCustomerCommand } from '../application/use-cases/register-customer/register-customer.command.js';
import { GoogleAuthCommand } from '../application/use-cases/google-auth/google-auth.command.js';
import { LoginCustomerCommand } from '../application/use-cases/login-customer/login-customer.command.js';
import { RefreshTokenCommand } from '../application/use-cases/refresh-token/refresh-token.command.js';
import { UpdateProfileCommand } from '../application/use-cases/update-profile/update-profile.command.js';
import { DeactivateCustomerCommand } from '../application/use-cases/deactivate-customer/deactivate-customer.command.js';
import { ActivateCustomerCommand } from '../application/use-cases/activate-customer/activate-customer.command.js';
import { GetCustomerByIdQuery } from '../application/queries/get-customer-by-id/get-customer-by-id.query.js';
import { ListCustomersQuery } from '../application/queries/list-customers/list-customers.query.js';
import { RegisterCustomerDto } from './dto/register-customer.dto.js';
import { GoogleAuthDto } from './dto/google-auth.dto.js';
import { LoginCustomerDto } from './dto/login-customer.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { ListCustomerQueryDto } from './dto/list-customer-query.dto.js';
import type { AuthResponseDto } from '../application/dto/auth-response.dto.js';
import type { TokenResponseDto } from '../application/dto/token-response.dto.js';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import {
  TOKEN_SERVICE_PORT,
  type TokenServicePort,
} from '../../shared/application/ports/token-service.port.js';
import { AuthCookieHelper } from '../../shared/infrastructure/auth/auth-cookie.helper.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../shared/domain/exceptions/application.exception.js';

@Controller('customers')
export class CustomerController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject(TOKEN_SERVICE_PORT)
    private readonly tokenService: TokenServicePort,
  ) {}

  // -------------------------------------------------------------
  // Public Authentication Endpoints (Dual Token)
  // -------------------------------------------------------------

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterCustomerDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.commandBus.execute<
      RegisterCustomerCommand,
      AuthResponseDto
    >(
      new RegisterCustomerCommand(
        dto.email,
        dto.password,
        dto.firstName,
        dto.lastName,
        dto.phoneNumber,
      ),
    );

    this.setTokenCookies(res, result.accessToken, result.refreshToken);
    return { data: result };
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleAuth(
    @Body() dto: GoogleAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.commandBus.execute<
      GoogleAuthCommand,
      AuthResponseDto
    >(
      new GoogleAuthCommand(
        dto.googleId,
        dto.email,
        dto.firstName,
        dto.lastName,
        dto.avatarUrl,
      ),
    );

    this.setTokenCookies(res, result.accessToken, result.refreshToken);
    return { data: result };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginCustomerDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.commandBus.execute<
      LoginCustomerCommand,
      AuthResponseDto
    >(new LoginCustomerCommand(dto.email, dto.password));

    this.setTokenCookies(res, result.accessToken, result.refreshToken);
    return { data: result };
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token =
      dto?.refreshToken || AuthCookieHelper.extractCookie(req, 'refresh_token');

    if (!token) {
      throw new ApplicationException(
        'Refresh token is required in request body or cookie',
        ApplicationExceptionCode.VALIDATION_ERROR,
      );
    }

    const result = await this.commandBus.execute<
      RefreshTokenCommand,
      TokenResponseDto
    >(new RefreshTokenCommand(token));

    this.setTokenCookies(res, result.accessToken, result.refreshToken);
    return { data: result };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    AuthCookieHelper.clearAuthCookies(res, '/api/customers');
    return { data: { message: 'Logged out successfully' } };
  }

  // -------------------------------------------------------------
  // Authenticated Current Customer Endpoints (/me)
  // MUST precede parameterized routes (/:id) to avoid UUID pipe errors
  // -------------------------------------------------------------

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.queryBus.execute(
      new GetCustomerByIdQuery(user.id),
    );
    return { data: result };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCustomerDto,
  ) {
    const result = await this.commandBus.execute(
      new UpdateProfileCommand(
        user.id,
        dto.firstName,
        dto.lastName,
        dto.phoneNumber,
        dto.avatarUrl,
      ),
    );
    return { data: result };
  }

  // -------------------------------------------------------------
  // Protected Customer Management Endpoints
  // -------------------------------------------------------------

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Query() query: ListCustomerQueryDto) {
    const result = await this.queryBus.execute(
      new ListCustomersQuery(
        query.page,
        query.limit,
        query.search,
        query.isActive,
      ),
    );
    return result;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.id !== id) {
      throw new ApplicationException(
        'Forbidden: You are not authorized to view another customer profile',
        ApplicationExceptionCode.FORBIDDEN,
      );
    }
    const result = await this.queryBus.execute(new GetCustomerByIdQuery(id));
    return { data: result };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCustomerDto,
  ) {
    if (user.id !== id) {
      throw new ApplicationException(
        'Forbidden: You are not authorized to modify another customer profile',
        ApplicationExceptionCode.FORBIDDEN,
      );
    }
    const result = await this.commandBus.execute(
      new UpdateProfileCommand(
        id,
        dto.firstName,
        dto.lastName,
        dto.phoneNumber,
        dto.avatarUrl,
      ),
    );
    return { data: result };
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard)
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    await this.commandBus.execute(new DeactivateCustomerCommand(id));
    return { data: { message: 'Customer account deactivated successfully' } };
  }

  @Patch(':id/activate')
  @UseGuards(JwtAuthGuard)
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    await this.commandBus.execute(new ActivateCustomerCommand(id));
    return { data: { message: 'Customer account activated successfully' } };
  }

  // -------------------------------------------------------------
  // Private Helper Methods
  // -------------------------------------------------------------

  private setTokenCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    AuthCookieHelper.setAuthCookies(
      res,
      accessToken,
      refreshToken,
      {
        accessTokenMaxAgeMs: this.tokenService.getAccessTokenMaxAgeMs(),
        refreshTokenMaxAgeMs: this.tokenService.getRefreshTokenMaxAgeMs(),
      },
      '/api/customers',
    );
  }
}
