export interface PaymentDetailsDto {
  id: string;
  orderId: string;
  customerId: string | null;
  provider: string;
  status: string;
  amount: number; // in cents
  currency: string;
  transactionId: string | null;
  failureCode: string | null;
  failureReason: string | null;
  refundedAmount: number;
  paidAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

