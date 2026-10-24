'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  ShoppingBag,
  Receipt,
  Zap,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  Package,
  Eye,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import { AdminPageHeader } from '@/components/admin/layout/admin-page-header';
import { KpiCard } from '@/components/ui/kpi-card';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { SlideOver } from '@/components/ui/slide-over';
import { useAnalytics } from '@/hooks/admin/use-analytics';
import { useOrders, type AdminOrder } from '@/hooks/admin/use-orders';
import { formatBDT, formatDate } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  pending: '#B7791F',
  confirmed: '#3973AC',
  processing: '#2F855A',
  shipped: '#163A2B',
  delivered: '#267A46',
  cancelled: '#C53030',
  returned: '#6B756D',
};

export default function AdminDashboardPage() {
  const [period, setPeriod] = React.useState('30d');
  const [selectedOrder, setSelectedOrder] = React.useState<AdminOrder | null>(
    null,
  );

  const {
    summary,
    isLoadingSummary,
    salesChart,
    isLoadingSalesChart,
    orderStatus,
    isLoadingOrderStatus,
    topProducts,
    isLoadingTopProducts,
    inventoryHealth,
    refetchAll,
  } = useAnalytics(period);

  const { orders: recentOrders, isLoading: isLoadingRecentOrders } = useOrders({
    limit: 5,
    page: 1,
  });

  const recentOrderColumns: Column<AdminOrder>[] = [
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
          <p className="font-medium text-[#252A25]">
            {order.shippingAddress?.recipientName ||
              order.customerName ||
              'Guest Buyer'}
          </p>
          <p className="text-[11px] text-[#6B756D]">
            {order.shippingAddress?.recipientPhone ||
              order.customerPhone ||
              '-'}
          </p>
        </div>
      ),
    },
    {
      header: 'Total',
      accessorKey: 'totalAmount',
      cell: (order) => (
        <span className="font-bold text-[#252A25]">
          {formatBDT(order.totalAmount)}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (order) => <StatusBadge status={order.status} />,
    },
    {
      header: 'Date',
      accessorKey: 'createdAt',
      cell: (order) => (
        <span className="text-xs text-[#6B756D]">
          {formatDate(order.createdAt)}
        </span>
      ),
    },
    {
      header: 'Action',
      align: 'right',
      cell: (order) => (
        <Button
          variant="ghost"
          size="sm"
          fullWidth={false}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedOrder(order);
          }}
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header with Period Switcher */}
      <AdminPageHeader
        title="Operations & Performance Dashboard"
        subtitle="Live sales metrics, order fulfillment pipeline, and inventory status."
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-[#E5E0D5] bg-white p-1 text-xs font-semibold text-[#6B756D]">
              {[
                { label: 'Today', value: 'today' },
                { label: '7 Days', value: '7d' },
                { label: '30 Days', value: '30d' },
                { label: 'This Month', value: 'this_month' },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setPeriod(item.value)}
                  className={`rounded-md px-3 py-1.5 transition-all cursor-pointer ${
                    period === item.value
                      ? 'bg-[#163A2B] text-white font-bold shadow-xs'
                      : 'hover:text-[#163A2B] hover:bg-[#FAF7F0]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              fullWidth={false}
              onClick={() => refetchAll()}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Revenue"
          value={
            isLoadingSummary ? '...' : formatBDT(summary?.totalRevenue || 0)
          }
          change={summary?.revenueChange}
          icon={TrendingUp}
          changeLabel="vs previous period"
        />
        <KpiCard
          title="Total Orders"
          value={isLoadingSummary ? '...' : String(summary?.totalOrders || 0)}
          change={summary?.ordersChange}
          icon={ShoppingBag}
          changeLabel="vs previous period"
        />
        <KpiCard
          title="Avg. Order Value"
          value={
            isLoadingSummary
              ? '...'
              : formatBDT(summary?.averageOrderValue || 0)
          }
          change={summary?.aovChange}
          icon={Receipt}
          changeLabel="vs previous period"
        />
        <KpiCard
          title="Conversion Rate"
          value={
            isLoadingSummary
              ? '...'
              : `${(summary?.conversionRate || 0).toFixed(1)}%`
          }
          change={summary?.conversionChange}
          icon={Zap}
          changeLabel="checkout completion"
        />
      </div>

      {/* Row 2: Charts (Sales Area & Order Status Donut) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales Chart (2 cols) */}
        <Card className="lg:col-span-2 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Revenue & Sales Trajectory</CardTitle>
              <CardDescription>
                Gross order revenue (BDT) across the selected timeframe
              </CardDescription>
            </div>
            <span className="text-xs font-semibold text-[#2F855A] bg-[#2F855A]/10 px-2 py-1 rounded-md">
              BDT MRP VAT-Inclusive
            </span>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-72 w-full">
              {isLoadingSalesChart ? (
                <div className="flex h-full items-center justify-center text-xs text-[#6B756D]">
                  Loading chart data...
                </div>
              ) : salesChart.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-[#6B756D]">
                  No sales recorded in this interval
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={salesChart}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="revenueGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#163A2B"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor="#163A2B"
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#E5E0D5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke="#6B756D"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#6B756D"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `৳${val / 100}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E5E0D5',
                        borderRadius: '10px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)',
                        fontSize: '12px',
                        fontFamily: 'var(--font-sans)',
                      }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => [
                        formatBDT(Number(value || 0)),
                        'Revenue',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#163A2B"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#revenueGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Order Status Distribution (1 col) */}
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle>Order Status Breakdown</CardTitle>
            <CardDescription>
              Fulfillment state distribution for current period
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-52 w-full">
              {isLoadingOrderStatus ? (
                <div className="flex h-full items-center justify-center text-xs text-[#6B756D]">
                  Loading status distribution...
                </div>
              ) : orderStatus.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-[#6B756D]">
                  No orders recorded
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatus}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {orderStatus.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            STATUS_COLORS[entry.status.toLowerCase()] ||
                            '#163A2B'
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E5E0D5',
                        borderRadius: '10px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Custom Legend */}
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#E5E0D5]/60 pt-3">
              {orderStatus.map((item) => (
                <div
                  key={item.status}
                  className="flex items-center gap-2 text-xs"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        STATUS_COLORS[item.status.toLowerCase()] || '#163A2B',
                    }}
                  />
                  <span className="capitalize text-[#252A25] font-medium truncate">
                    {item.status}
                  </span>
                  <span className="ml-auto font-bold text-[#6B756D]">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Top Selling Products & Inventory Health */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Top Selling Products (2 cols) */}
        <Card className="lg:col-span-2 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Top Selling Catalog Items</CardTitle>
              <CardDescription>
                Highest volume products by revenue and units ordered
              </CardDescription>
            </div>
            <Link
              href="/admin/products"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#163A2B] hover:text-[#214D3A] transition-colors"
            >
              View Catalog
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoadingTopProducts ? (
              <div className="py-8 text-center text-xs text-[#6B756D]">
                Loading top products...
              </div>
            ) : topProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#6B756D]">
                No product sales recorded in this interval
              </div>
            ) : (
              <div className="divide-y divide-[#E5E0D5]/60">
                {topProducts.map((prod, idx) => (
                  <div
                    key={prod.productId || idx}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FAF7F0] border border-[#E5E0D5] font-bold text-xs text-[#163A2B]">
                        #{idx + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-[#252A25] max-w-sm truncate">
                          {prod.productName}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-[#6B756D]">
                          SKU: {prod.sku}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-xs text-[#163A2B]">
                        {formatBDT(prod.totalRevenue)}
                      </p>
                      <p className="text-[11px] text-[#6B756D]">
                        {prod.totalQuantity} units sold
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inventory Stock Health (1 col) */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Warehouse Stock Health</CardTitle>
              <CardDescription>Critical reorder alerts</CardDescription>
            </div>
            <Link
              href="/admin/inventory"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#163A2B] hover:text-[#214D3A] transition-colors"
            >
              Restock
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="pt-2 space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-[#267A46]/10 p-2.5 border border-[#267A46]/20">
                <p className="text-base font-bold text-[#267A46]">
                  {inventoryHealth?.healthyCount ?? '-'}
                </p>
                <p className="text-[10px] font-semibold text-[#6B756D] uppercase">
                  Healthy
                </p>
              </div>
              <div className="rounded-lg bg-[#B7791F]/10 p-2.5 border border-[#B7791F]/20">
                <p className="text-base font-bold text-[#B7791F]">
                  {inventoryHealth?.lowStockCount ?? '-'}
                </p>
                <p className="text-[10px] font-semibold text-[#6B756D] uppercase">
                  Low Stock
                </p>
              </div>
              <div className="rounded-lg bg-[#C53030]/10 p-2.5 border border-[#C53030]/20">
                <p className="text-base font-bold text-[#C53030]">
                  {inventoryHealth?.outOfStockCount ?? '-'}
                </p>
                <p className="text-[10px] font-semibold text-[#6B756D] uppercase">
                  Out of Stock
                </p>
              </div>
            </div>

            {/* Low stock items preview */}
            <div className="space-y-2 pt-2 border-t border-[#E5E0D5]/60">
              <p className="text-xs font-semibold text-[#252A25]">
                SKUs Requiring Immediate Action
              </p>
              {inventoryHealth?.lowStockItems &&
              inventoryHealth.lowStockItems.length > 0 ? (
                inventoryHealth.lowStockItems.slice(0, 3).map((item) => (
                  <div
                    key={item.sku}
                    className="flex items-center justify-between rounded-lg border border-[#E5E0D5] bg-[#FAF7F0] p-2 text-xs"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <AlertTriangle className="h-3.5 w-3.5 text-[#B7791F] shrink-0" />
                      <span className="font-medium text-[#252A25] truncate">
                        {item.productName} ({item.sku})
                      </span>
                    </div>
                    <span className="font-bold text-[#C53030] shrink-0">
                      {item.availableStock} left
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#267A46] font-medium py-2">
                  ✓ All active SKUs are currently above reorder thresholds.
                </p>
              )}
            </div>

            <Link href="/admin/inventory">
              <Button variant="outline" size="sm" fullWidth>
                <Package className="h-3.5 w-3.5" />
                Manage All Warehouse Inventory
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Recent Orders Table */}
      <Card className="shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>Recent Orders & Fulfillment Queue</CardTitle>
            <CardDescription>
              Latest customer checkout transactions awaiting dispatch
            </CardDescription>
          </div>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#163A2B] hover:text-[#214D3A] transition-colors"
          >
            All Orders ({recentOrders.length})
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          <DataTable
            columns={recentOrderColumns}
            data={recentOrders}
            isLoading={isLoadingRecentOrders}
            emptyMessage="No recent orders found."
            onRowClick={(order) => setSelectedOrder(order)}
          />
        </CardContent>
      </Card>

      {/* Quick Order Detail Drawer */}
      <SlideOver
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title={
          selectedOrder
            ? `Order ${selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}`
            : 'Order Details'
        }
        description="Frozen financial price snapshot and shipping details"
        footer={
          selectedOrder && (
            <div className="flex w-full items-center gap-2">
              <Link href={`/admin/orders`} className="w-full">
                <Button variant="outline" size="sm" fullWidth>
                  Open in Orders Manager
                </Button>
              </Link>
            </div>
          )
        }
      >
        {selectedOrder && (
          <div className="space-y-6 text-sm">
            {/* Status and summary */}
            <div className="flex items-center justify-between rounded-xl border border-[#E5E0D5] bg-[#FAF7F0] p-4">
              <div>
                <p className="text-xs text-[#6B756D]">Status</p>
                <div className="mt-1">
                  <StatusBadge status={selectedOrder.status} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#6B756D]">Total Amount</p>
                <p className="text-lg font-bold text-[#163A2B]">
                  {formatBDT(selectedOrder.totalAmount)}
                </p>
              </div>
            </div>

            {/* Customer & Shipping */}
            <div className="space-y-2 border-b border-[#E5E0D5]/70 pb-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B756D]">
                Delivery Address (Bangladesh)
              </h4>
              <p className="font-semibold text-[#252A25]">
                {selectedOrder.shippingAddress?.recipientName}
              </p>
              <p className="text-xs text-[#6B756D]">
                Phone: {selectedOrder.shippingAddress?.recipientPhone}
              </p>
              <p className="text-xs text-[#252A25]">
                {selectedOrder.shippingAddress?.addressLine},{' '}
                {selectedOrder.shippingAddress?.area},{' '}
                {selectedOrder.shippingAddress?.district},{' '}
                {selectedOrder.shippingAddress?.division}
              </p>
            </div>

            {/* Line items */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B756D]">
                Order Items ({selectedOrder.items?.length || 0})
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

            {/* Financials breakdown */}
            <div className="rounded-xl border border-[#E5E0D5] bg-[#FAF7F0] p-4 space-y-2 text-xs">
              <div className="flex justify-between text-[#6B756D]">
                <span>Subtotal</span>
                <span>{formatBDT(selectedOrder.subtotalAmount)}</span>
              </div>
              <div className="flex justify-between text-[#6B756D]">
                <span>Shipping Fee</span>
                <span>{formatBDT(selectedOrder.shippingFeeAmount)}</span>
              </div>
              {selectedOrder.shippingFeeDiscountAmount > 0 && (
                <div className="flex justify-between text-[#267A46]">
                  <span>Shipping Discount</span>
                  <span>
                    -{formatBDT(selectedOrder.shippingFeeDiscountAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[#6B756D]">
                <span>VAT (15% MRP Backed-out)</span>
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
