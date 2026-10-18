import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { RegisterCustomerCommand } from '../application/use-cases/register-customer/register-customer.command.js';
import { GoogleAuthCommand } from '../application/use-cases/google-auth/google-auth.command.js';
import { LoginCustomerCommand } from '../application/use-cases/login-customer/login-customer.command.js';
import { UpdateProfileCommand } from '../application/use-cases/update-profile/update-profile.command.js';
import { DeactivateCustomerCommand } from '../application/use-cases/deactivate-customer/deactivate-customer.command.js';
import { ActivateCustomerCommand } from '../application/use-cases/activate-customer/activate-customer.command.js';
import { GetCustomerByIdQuery } from '../application/queries/get-customer-by-id/get-customer-by-id.query.js';
import { ListCustomersQuery } from '../application/queries/list-customers/list-customers.query.js';
import { RegisterCustomerDto } from './dto/register-customer.dto.js';
import { GoogleAuthDto } from './dto/google-auth.dto.js';
import { LoginCustomerDto } from './dto/login-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { ListCustomerQueryDto } from './dto/list-customer-query.dto.js';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from '../../shared/domain/exceptions/application.exception.js';

@Controller('customers')
export class CustomerController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // -------------------------------------------------------------
  // Public Authentication Endpoints
  // -------------------------------------------------------------

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterCustomerDto) {
    const result = await this.commandBus.execute(
      new RegisterCustomerCommand(
        dto.email,
        dto.password,
        dto.firstName,
        dto.lastName,
        dto.phoneNumber,
      ),
    );
    return { data: result };
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleAuth(@Body() dto: GoogleAuthDto) {
    const result = await this.commandBus.execute(
      new GoogleAuthCommand(
        dto.googleId,
        dto.email,
        dto.firstName,
        dto.lastName,
        dto.avatarUrl,
      ),
    );
    return { data: result };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginCustomerDto) {
    const result = await this.commandBus.execute(
      new LoginCustomerCommand(dto.email, dto.password),
    );
    return { data: result };

    // return null
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
}
