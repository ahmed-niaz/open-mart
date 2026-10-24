'use client';

import * as React from 'react';
import { CreditCard, RotateCcw } from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/layout/admin-page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { usePayments, type AdminPayment } from '@/hooks/admin/use-payments';
import { formatBDT, formatDate } from '@/lib/utils';

export default function AdminPaymentsPage() {
  const [refundingPayment, setRefundingPayment] =
    React.useState<AdminPayment | null>(null);
  const [refundAmountBDT, setRefundAmountBDT] = React.useState<number>(0);
  const [refundReason, setRefundReason] = React.useState('');

  const { payments, isLoading, refundPayment, isRefunding } = usePayments();

  const handleOpenRefund = (payment: AdminPayment) => {
    setRefundingPayment(payment);
    const maxRefundable =
      (payment.amountCents - payment.refundedAmountCents) / 100;
    setRefundAmountBDT(maxRefundable);
    setRefundReason('Customer returned items');
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundingPayment) return;
    await refundPayment({
      paymentId: refundingPayment.id,
      amountCents: Math.round(refundAmountBDT * 100),
      reason: refundReason.trim(),
    });
    setRefundingPayment(null);
  };

  const columns: Column<AdminPayment>[] = [
    {
      header: 'Payment ID',
      accessorKey: 'id',
      cell: (p) => (
        <span className="font-mono text-xs font-semibold text-[#163A2B]">
          #{p.id.slice(0, 8)}
        </span>
      ),
    },
    {
      header: 'Linked Order',
      accessorKey: 'orderId',
      cell: (p) => (
        <span className="font-mono text-xs text-[#6B756D]">
          #{p.orderId.slice(0, 8)}
        </span>
      ),
    },
    {
      header: 'Amount (BDT)',
      accessorKey: 'amountCents',
      cell: (p) => (
        <div>
          <p className="font-bold text-xs text-[#252A25]">
            {formatBDT(p.amountCents)}
          </p>
          {p.refundedAmountCents > 0 && (
            <p className="text-[10px] text-[#C53030]">
              Refunded: {formatBDT(p.refundedAmountCents)}
            </p>
          )}
        </div>
      ),
    },
    {
      header: 'Channel / Gateway',
      accessorKey: 'provider',
      cell: (p) => (
        <span className="inline-flex items-center gap-1 rounded-md border border-[#E5E0D5] bg-[#FAF7F0] px-2 py-0.5 text-[11px] font-bold uppercase text-[#252A25]">
          <CreditCard className="h-3 w-3 text-[#163A2B]" />
          {p.provider}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (p) => <StatusBadge status={p.status} />,
    },
    {
      header: 'Gateway Reference',
      accessorKey: 'gatewayTransactionId',
      cell: (p) => (
        <span className="font-mono text-xs text-[#6B756D]">
          {p.gatewayTransactionId || 'N/A (Cash on Delivery)'}
        </span>
      ),
    },
    {
      header: 'Timestamp',
      accessorKey: 'createdAt',
      cell: (p) => (
        <span className="text-xs text-[#6B756D]">
          {formatDate(p.createdAt)}
        </span>
      ),
    },
    {
      header: 'Action',
      align: 'right',
      cell: (p) =>
        p.status === 'completed' && p.amountCents > p.refundedAmountCents ? (
          <Button
            variant="outline"
            size="sm"
            fullWidth={false}
            onClick={() => handleOpenRefund(p)}
            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
          >
            Refund
          </Button>
        ) : (
          <span className="text-xs text-[#6B756D]">-</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Payment Gateways & Two-Phase Refund Center"
        subtitle="Stripe, SSLCommerz, and COD disbursement audit ledger with asynchronous refund states."
        breadcrumbs={[{ label: 'Financials' }, { label: 'Payments' }]}
      />

      <Card className="shadow-xs">
        <CardContent className="pt-5">
          <DataTable
            columns={columns}
            data={payments}
            isLoading={isLoading}
            emptyMessage="No payment transactions recorded yet."
          />
        </CardContent>
      </Card>

      {/* Process Refund Modal */}
      <Modal
        isOpen={Boolean(refundingPayment)}
        onClose={() => setRefundingPayment(null)}
        title="Issue Payment Refund"
        description={`Process partial or full gateway refund for payment #${refundingPayment?.id.slice(0, 8)}`}
        footer={
          <div className="flex w-full items-center gap-2">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => setRefundingPayment(null)}
              disabled={isRefunding}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="refund-form"
              variant="primary"
              fullWidth
              loading={isRefunding}
            >
              Disburse Refund
            </Button>
          </div>
        }
      >
        <form
          id="refund-form"
          onSubmit={handleRefundSubmit}
          className="space-y-4 py-2"
        >
          <Input
            label="Refund Amount (BDT ৳) *"
            type="number"
            step="1"
            min="1"
            value={refundAmountBDT}
            onChange={(e) => setRefundAmountBDT(Number(e.target.value))}
            required
          />

          <Input
            label="Reason for Refund *"
            placeholder="e.g. Return of damaged item after inspection"
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            required
          />

          <div className="rounded-lg bg-[#FAF7F0] p-3 text-xs text-[#6B756D] border border-[#E5E0D5]">
            <p className="font-semibold text-[#163A2B] mb-0.5">
              Two-Phase Execution Policy:
            </p>
            For Stripe and SSLCommerz, an asynchronous API call will be made to
            the gateway. For Cash-on-Delivery, an offline ledger record is
            created for manual bKash/Nagad disbursement.
          </div>
        </form>
      </Modal>
    </div>
  );
}
