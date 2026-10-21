export interface RefundPaymentResultDto {
  refundId: string;
  paymentId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  gatewayRefundId?: string | null;
  isOfflinePayout: boolean;
  failureReason?: string | null;
}
