import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { Request } from 'express';

import { AdminJwtGuard } from '../../shared/infrastructure/guards/admin-jwt.guard.js';
import { PermissionsGuard } from '../../shared/infrastructure/guards/permissions.guard.js';
import { RequirePermissions } from '../../shared/presentation/decorators/require-permissions.decorator.js';
import { AdminPermission } from '../../shared/infrastructure/guards/admin-permissions.js';
import type { AuthenticatedUser } from '../../shared/presentation/interfaces/authenticated-user.interface.js';
import { RefundPaymentDto } from './dto/refund-payment.dto.js';
import { RefundPaymentCommand } from '../application/use-cases/refund-payment/refund-payment.command.js';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepositoryPort,
} from '../application/ports/payment.repository.js';
import { PaymentId } from '../domain/value-objects/payment-id.vo.js';

@Controller('admin/payments')
@UseGuards(AdminJwtGuard, PermissionsGuard)
export class PaymentAdminController {
  constructor(
    private readonly commandBus: CommandBus,
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepositoryPort,
  ) {}

  /**
   * POST /api/admin/payments/:id/refund
   * Issue a full or partial refund for a payment (online gateway or offline payout).
   */
  @Post(':id/refund')
  @RequirePermissions(AdminPermission.PAYMENTS_REFUND)
  async refund(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RefundPaymentDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user as AuthenticatedUser;
    const initiatedBy = user ? `admin:${user.id}` : 'admin:unknown';

    // If amount is not specified, refund remaining refundable balance
    let amountCents = dto.amountCents;
    if (!amountCents) {
      const payment = await this.paymentRepository.findById(
        PaymentId.fromString(id),
      );
      if (!payment) {
        throw new NotFoundException(`Payment '${id}' was not found`);
      }
      amountCents = payment.amount.toCents() - payment.refundedAmount.toCents();
    }

    const result = await this.commandBus.execute(
      new RefundPaymentCommand(
        id,
        amountCents,
        dto.reason,
        initiatedBy,
        dto.isOfflinePayout ?? false,
        dto.offlineReference,
      ),
    );

    return { data: result };
  }

  /**
   * GET /api/admin/payments/:id/refunds
   * List all refund records for a given payment.
   */
  @Get(':id/refunds')
  @RequirePermissions(AdminPermission.PAYMENTS_READ)
  async getRefundsByPaymentId(@Param('id', new ParseUUIDPipe()) id: string) {
    const refunds = await this.paymentRepository.findRefundsByPaymentId(
      PaymentId.fromString(id),
    );

    return {
      data: refunds.map((r) => ({
        id: r.id,
        paymentId: r.paymentId,
        orderId: r.orderId,
        amountCents: r.amount.toCents(),
        currency: r.amount.getCurrency(),
        reason: r.reason,
        status: r.status,
        gatewayRefundId: r.gatewayRefundId,
        isOfflinePayout: r.isOfflinePayout,
        offlineReference: r.offlineReference,
        failureReason: r.failureReason,
        initiatedBy: r.initiatedBy,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      })),
    };
  }

  /**
   * GET /api/admin/payments/order/:orderId/refunds
   * List all refund records for an order.
   */
  @Get('order/:orderId/refunds')
  @RequirePermissions(AdminPermission.PAYMENTS_READ)
  async getRefundsByOrderId(
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
  ) {
    const refunds = await this.paymentRepository.findRefundsByOrderId(orderId);

    return {
      data: refunds.map((r) => ({
        id: r.id,
        paymentId: r.paymentId,
        orderId: r.orderId,
        amountCents: r.amount.toCents(),
        currency: r.amount.getCurrency(),
        reason: r.reason,
        status: r.status,
        gatewayRefundId: r.gatewayRefundId,
        isOfflinePayout: r.isOfflinePayout,
        offlineReference: r.offlineReference,
        failureReason: r.failureReason,
        initiatedBy: r.initiatedBy,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      })),
    };
  }
}
