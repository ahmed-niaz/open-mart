export interface InitiatePaymentResponseDto {
  paymentId: string;
  orderId: string;
  provider: string;
  status: string;
  amount: number; // in minor currency units (cents for USD)
  currency: string;
  checkoutUrl?: string;
  transactionId: string;
  clientSecret?: string;
  metadata?: Record<string, unknown> | null;
}

