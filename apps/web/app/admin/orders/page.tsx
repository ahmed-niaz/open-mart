'use client';

import * as React from 'react';
import {
  Search,
  CheckCircle,
  Truck,
  PackageCheck,
  XCircle,
  Eye,
} from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/layout/admin-page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { SlideOver } from '@/components/ui/slide-over';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { useOrders, type AdminOrder } from '@/hooks/admin/use-orders';
import { formatBDT, formatDate } from '@/lib/utils';

const ORDER_TABS = [
  { id: 'all', label: 'All Orders' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function AdminOrdersPage() {
  const [activeTab, setActiveTab] = React.useState('all');
  const [page, setPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedOrder, setSelectedOrder] = React.useState<AdminOrder | null>(
    null,
  );

  // Fulfillment Action Dialog States
  const [shippingOrder, setShippingOrder] = React.useState<AdminOrder | null>(
    null,
  );
  const [carrier, setCarrier] = React.useState('Steadfast');
  const [trackingNumber, setTrackingNumber] = React.useState('');

  const [cancellingOrder, setCancellingOrder] =
    React.useState<AdminOrder | null>(null);
  const [cancelReason, setCancelReason] = React.useState('');

  const {
    orders,
    total,
    totalPages,
    isLoading,
    confirmOrder,
    isConfirming,
    processOrder,
    isProcessing,
    shipOrder,
    isShipping,
    deliverOrder,
    isDelivering,
    cancelOrder,
    isCancelling,
  } = useOrders({
    page,
    limit: 10,
    status: activeTab,
  });

  // Filter client-side search query
  const filteredOrders = React.useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase().trim();
    return orders.filter(
      (o) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.shippingAddress?.recipientName?.toLowerCase().includes(q) ||
        o.shippingAddress?.recipientPhone?.includes(q),
    );
  }, [orders, searchQuery]);

  const handleShipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingOrder) return;
    await shipOrder({
      orderId: shippingOrder.id,
      carrier,
      trackingNumber: trackingNumber.trim() || undefined,
    });
    setShippingOrder(null);
    setTrackingNumber('');
  };

  const handleCancelSubmit = async () => {
    if (!cancellingOrder) return;
    await cancelOrder({
      orderId: cancellingOrder.id,
      reason: cancelReason.trim() || 'Cancelled by merchant operations',
    });
    setCancellingOrder(null);
    setCancelReason('');
  };

  const columns: Column<AdminOrder>[] = [
    {
      header: 'Order #',
      accessorKey: 'orderNumber',
      cell: (order) => (
        <span className="font-bold text-[#163A2B]">
          {order.orderNumber || `#${order.id.slice(0, 8)}`}
        </span>
      ),
    },
    {
      header: 'Customer',
      accessorKey: 'customerName',
      cell: (order) => (
        <div>
          <p className="font-semibold text-[#252A25]">
            {order.shippingAddress?.recipientName ||
              order.customerName ||
              'Customer'}
          </p>
          <p className="text-xs text-[#6B756D]">
            {order.shippingAddress?.recipientPhone || '-'}
          </p>
        </div>
      ),
    },
    {
      header: 'Destination',
      accessorKey: 'shippingAddress',
      cell: (order) => (
        <span className="text-xs text-[#252A25]">
          {order.shippingAddress?.city ||
            order.shippingAddress?.district ||
            'Dhaka'}
          , {order.shippingAddress?.division}
        </span>
      ),
    },
    {
      header: 'Total (BDT)',
      accessorKey: 'totalAmount',
      cell: (order) => (
        <div>
          <p className="font-bold text-[#163A2B]">
            {formatBDT(order.totalAmount)}
          </p>
          <span className="text-[10px] uppercase font-semibold text-[#6B756D]">
            {order.paymentMethod || 'COD'}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (order) => <StatusBadge status={order.status} />,
    },
    {
      header: 'Placed At',
      accessorKey: 'createdAt',
      cell: (order) => (
        <span className="text-xs text-[#6B756D]">
          {formatDate(order.createdAt)}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (order) => (
        <div
          className="flex items-center justify-end gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            fullWidth={false}
            onClick={() => setSelectedOrder(order)}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>

          <DropdownMenu
            actions={[
              {
                label: 'View Order Details',
                icon: <Eye />,
                onClick: () => setSelectedOrder(order),
              },
              ...(order.status === 'pending'
                ? [
                    {
                      label: 'Confirm Order',
                      icon: <CheckCircle />,
                      onClick: () => confirmOrder(order.id),
                    },
                  ]
                : []),
              ...(order.status === 'confirmed'
                ? [
                    {
                      label: 'Mark as Processing',
                      icon: <PackageCheck />,
                      onClick: () => processOrder(order.id),
                    },
                  ]
                : []),
              ...(order.status === 'confirmed' || order.status === 'processing'
                ? [
                    {
                      label: 'Dispatch / Ship Order',
                      icon: <Truck />,
                      onClick: () => setShippingOrder(order),
                    },
                  ]
                : []),
              ...(order.status === 'shipped'
                ? [
                    {
                      label: 'Mark as Delivered',
                      icon: <CheckCircle />,
                      onClick: () => deliverOrder(order.id),
                    },
                  ]
                : []),
              ...(!['delivered', 'cancelled', 'returned'].includes(order.status)
                ? [
                    {
                      label: 'Cancel Order',
                      icon: <XCircle />,
                      variant: 'destructive' as const,
                      onClick: () => setCancellingOrder(order),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <AdminPageHeader
        title="Order Management & Fulfillment"
        subtitle="Manage customer orders, update delivery pipeline, and dispatch consignments."
        breadcrumbs={[{ label: 'Orders' }]}
      />

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={ORDER_TABS}
          activeTab={activeTab}
          onChange={(tab) => {
            setActiveTab(tab);
            setPage(1);
          }}
        />

        <div className="w-full sm:w-72">
          <Input
            placeholder="Search order #, customer, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Orders Data Table */}
      <Card className="shadow-xs">
        <CardContent className="pt-5">
          <DataTable
            columns={columns}
            data={filteredOrders}
            isLoading={isLoading}
            emptyMessage={`No orders found matching filter '${activeTab}'.`}
            onRowClick={(order) => setSelectedOrder(order)}
            pagination={{
              page,
              totalPages,
              totalCount: total,
              onPageChange: (newPage) => setPage(newPage),
            }}
          />
        </CardContent>
      </Card>

      {/* Ship Order Modal */}
      <Modal
        isOpen={Boolean(shippingOrder)}
        onClose={() => setShippingOrder(null)}
        title="Dispatch & Ship Order"
        description={`Fulfill and assign courier tracking to Order #${shippingOrder?.orderNumber || shippingOrder?.id.slice(0, 8)}`}
        footer={
          <div className="flex w-full items-center gap-2">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => setShippingOrder(null)}
              disabled={isShipping}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              fullWidth
              loading={isShipping}
              onClick={handleShipSubmit}
            >
              Confirm Dispatch
            </Button>
          </div>
        }
      >
        <form onSubmit={handleShipSubmit} className="space-y-4 py-2">
          <Select
            label="Delivery Partner / Courier"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            options={[
              {
                label: 'Steadfast Courier (Bangladesh COD)',
                value: 'Steadfast',
              },
              { label: 'Pathao Courier', value: 'Pathao' },
              { label: 'RedX Delivery', value: 'RedX' },
              { label: 'Merchant In-House Fleet / Rider', value: 'InHouse' },
            ]}
          />

          <Input
            label="Courier Consignment / Tracking Code"
            placeholder="e.g. STDF-8947291"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
          />

          <div className="rounded-lg bg-[#FAF7F0] p-3 text-xs text-[#6B756D] border border-[#E5E0D5]">
            <p className="font-semibold text-[#163A2B] mb-0.5">
              Automated Event Pipeline:
            </p>
            Marking this order as shipped will automatically notify the customer
            and stage the consignment status into the outbox.
          </div>
        </form>
      </Modal>

      {/* Cancel Order Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(cancellingOrder)}
        onClose={() => setCancellingOrder(null)}
        onConfirm={handleCancelSubmit}
        title="Cancel Order & Release Inventory?"
        description={`Are you sure you want to cancel Order #${cancellingOrder?.orderNumber || cancellingOrder?.id.slice(0, 8)}? All reserved inventory units will be safely returned to warehouse stock and payments will be scheduled for refund.`}
        confirmLabel="Cancel Order"
        variant="destructive"
        loading={isCancelling}
      />

      {/* SlideOver Order Detail Preview */}
      <SlideOver
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title={
          selectedOrder
            ? `Order #${selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}`
            : 'Order Details'
        }
        description={`Placed on ${selectedOrder ? formatDate(selectedOrder.createdAt) : ''}`}
        footer={
          selectedOrder && (
            <div className="flex w-full flex-col gap-2">
              {selectedOrder.status === 'pending' && (
                <Button
                  variant="primary"
                  fullWidth
                  loading={isConfirming}
                  onClick={async () => {
                    await confirmOrder(selectedOrder.id);
                    setSelectedOrder(null);
                  }}
                >
                  <CheckCircle className="h-4 w-4" />
                  Confirm Order
                </Button>
              )}

              {selectedOrder.status === 'confirmed' && (
                <Button
                  variant="primary"
                  fullWidth
                  loading={isProcessing}
                  onClick={async () => {
                    await processOrder(selectedOrder.id);
                    setSelectedOrder(null);
                  }}
                >
                  <PackageCheck className="h-4 w-4" />
                  Mark as Processing
                </Button>
              )}

              {(selectedOrder.status === 'confirmed' ||
                selectedOrder.status === 'processing') && (
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    setShippingOrder(selectedOrder);
                    setSelectedOrder(null);
                  }}
                >
                  <Truck className="h-4 w-4" />
                  Ship Order
                </Button>
              )}

              {selectedOrder.status === 'shipped' && (
                <Button
                  variant="primary"
                  fullWidth
                  loading={isDelivering}
                  onClick={async () => {
                    await deliverOrder(selectedOrder.id);
                    setSelectedOrder(null);
                  }}
                >
                  <CheckCircle className="h-4 w-4" />
                  Mark Delivered (Collect COD)
                </Button>
              )}

              {!['delivered', 'cancelled', 'returned'].includes(
                selectedOrder.status,
              ) && (
                <Button
                  variant="destructive"
                  fullWidth
                  onClick={() => {
                    setCancellingOrder(selectedOrder);
                    setSelectedOrder(null);
                  }}
                >
                  <XCircle className="h-4 w-4" />
                  Cancel Order
                </Button>
              )}
            </div>
          )
        }
      >
        {selectedOrder && (
          <div className="space-y-6 text-sm">
            {/* Status overview */}
            <div className="flex items-center justify-between rounded-xl border border-[#E5E0D5] bg-[#FAF7F0] p-4">
              <div>
                <p className="text-xs text-[#6B756D]">Order Status</p>
                <div className="mt-1">
                  <StatusBadge status={selectedOrder.status} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#6B756D]">
                  Payment ({selectedOrder.paymentMethod || 'COD'})
                </p>
                <p className="font-bold text-sm text-[#267A46]">
                  {selectedOrder.paymentStatus || 'Pending'}
                </p>
              </div>
            </div>

            {/* Delivery address */}
            <div className="space-y-2 border-b border-[#E5E0D5]/70 pb-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B756D]">
                Shipping Recipient (Bangladesh)
              </h4>
              <p className="font-semibold text-[#252A25]">
                {selectedOrder.shippingAddress?.recipientName}
              </p>
              <p className="text-xs text-[#6B756D]">
                Mobile: {selectedOrder.shippingAddress?.recipientPhone}
              </p>
              <p className="text-xs text-[#252A25]">
                {selectedOrder.shippingAddress?.addressLine},{' '}
                {selectedOrder.shippingAddress?.area},{' '}
                {selectedOrder.shippingAddress?.district},{' '}
                {selectedOrder.shippingAddress?.division}
              </p>
            </div>

            {/* Line items list */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B756D]">
                Ordered Items ({selectedOrder.items?.length || 0})
              </h4>
              <div className="divide-y divide-[#E5E0D5]/60">
                {selectedOrder.items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-[#252A25]">
                        {item.productName}
                      </p>
                      <p className="text-[11px] text-[#6B756D]">
                        SKU: {item.productSku} • Qty: {item.quantity}
                      </p>
                    </div>
                    <p className="font-bold text-[#163A2B]">
                      {formatBDT(
                        item.subtotalAmount ||
                          item.unitPriceAmount * item.quantity,
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing breakdown */}
            <div className="rounded-xl border border-[#E5E0D5] bg-[#FAF7F0] p-4 space-y-2 text-xs">
              <div className="flex justify-between text-[#6B756D]">
                <span>Item Subtotal</span>
                <span>{formatBDT(selectedOrder.subtotalAmount)}</span>
              </div>
              <div className="flex justify-between text-[#6B756D]">
                <span>Shipping Fee</span>
                <span>{formatBDT(selectedOrder.shippingFeeAmount)}</span>
              </div>
              {selectedOrder.shippingFeeDiscountAmount > 0 && (
                <div className="flex justify-between text-[#267A46]">
                  <span>Shipping Promo</span>
                  <span>
                    -{formatBDT(selectedOrder.shippingFeeDiscountAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[#6B756D]">
                <span>VAT (15% Bangladesh MRP Included)</span>
                <span>{formatBDT(selectedOrder.taxAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-[#163A2B] border-t border-[#E5E0D5] pt-2">
                <span>Grand Total</span>
                <span>{formatBDT(selectedOrder.totalAmount)}</span>
              </div>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
