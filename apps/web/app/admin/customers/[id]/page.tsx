'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ShoppingBag,
  Coins,
  MapPin,
  TrendingUp,
  Package,
  UserCheck,
  UserX,
  ExternalLink,
} from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/layout/admin-page-header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/ui/kpi-card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useCustomer, useCustomers } from '@/hooks/admin/use-customers';
import { formatBDT, formatDate } from '@/lib/utils';

export default function AdminCustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { customer, isLoading, refetch } = useCustomer(id);
  const { activateCustomer, isActivating, deactivateCustomer, isDeactivating } =
    useCustomers();

  const [confirmStatusModal, setConfirmStatusModal] = React.useState<
    'activate' | 'deactivate' | null
  >(null);

  const handleToggleStatus = async () => {
    if (!customer) return;
    try {
      if (customer.isActive) {
        await deactivateCustomer(customer.id);
      } else {
        await activateCustomer(customer.id);
      }
      setConfirmStatusModal(null);
      refetch();
    } catch {
      // toast is handled in mutation hooks
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-8 w-64 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-xl lg:col-span-2" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E5E0D5]/50 text-[#6B756D] mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-[#163A2B]">Customer Not Found</h2>
        <p className="mt-1 max-w-sm text-sm text-[#6B756D]">
          The customer profile with ID &ldquo;{id}&rdquo; does not exist or has
          been removed.
        </p>
        <div className="mt-6">
          <Button
            variant="outline"
            fullWidth={false}
            onClick={() => router.push('/admin/customers')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Customers
          </Button>
        </div>
      </div>
    );
  }

  const initials =
    `${customer.firstName?.[0] || ''}${customer.lastName?.[0] || ''}`.toUpperCase() ||
    customer.email.substring(0, 2).toUpperCase();

  const getOrderStatusVariant = (
    status: string,
  ): 'success' | 'secondary' | 'info' | 'warning' | 'error' | 'muted' => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return 'success';
      case 'processing':
      case 'confirmed':
        return 'secondary';
      case 'shipped':
        return 'info';
      case 'pending':
        return 'warning';
      case 'cancelled':
        return 'error';
      default:
        return 'muted';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <AdminPageHeader
        title={customer.fullName}
        subtitle={`Customer since ${formatDate(customer.createdAt)} • ID: ${customer.id}`}
        breadcrumbs={[
          { label: 'Customers', href: '/admin/customers' },
          { label: customer.fullName },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              fullWidth={false}
              onClick={() => router.push('/admin/customers')}
            >
              <ArrowLeft className="h-4 w-4" />
              All Customers
            </Button>

            {customer.isActive ? (
              <Button
                variant="destructive"
                size="sm"
                fullWidth={false}
                onClick={() => setConfirmStatusModal('deactivate')}
              >
                <UserX className="h-4 w-4" />
                Suspend Account
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                fullWidth={false}
                onClick={() => setConfirmStatusModal('activate')}
              >
                <UserCheck className="h-4 w-4" />
                Activate Account
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Lifetime Value (LTV)"
          value={formatBDT(customer.stats.totalSpentCents)}
          icon={Coins}
          subtitle={`Currency: ${customer.stats.currency}`}
        />
        <KpiCard
          title="Total Orders"
          value={customer.stats.totalOrders}
          icon={ShoppingBag}
          subtitle={`${customer.stats.completedOrders} completed • ${customer.stats.cancelledOrders} cancelled`}
        />
        <KpiCard
          title="Average Order Value"
          value={formatBDT(customer.stats.averageOrderValueBDT * 100)}
          icon={TrendingUp}
          subtitle="Per finalized checkout"
        />
        <KpiCard
          title="Last Order Date"
          value={
            customer.stats.lastOrderAt
              ? formatDate(customer.stats.lastOrderAt)
              : 'Never'
          }
          icon={Package}
          subtitle="Most recent purchase"
        />
      </div>

      {/* Main Grid: Details + Orders & Saved Addresses */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2 Cols): Profile & Order History */}
        <div className="space-y-6 lg:col-span-2">
          {/* Profile Overview Card */}
          <Card className="border border-[#E5E0D5]">
            <CardHeader className="pb-4 border-b border-[#E5E0D5]/60 bg-[#FAF7F0]/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-[#163A2B]">
                    Account Overview
                  </CardTitle>
                  <CardDescription className="text-xs text-[#6B756D]">
                    Core customer identity, contact details, and account
                    security
                  </CardDescription>
                </div>
                <Badge variant={customer.isActive ? 'success' : 'error'} dot>
                  {customer.isActive ? 'Active Account' : 'Account Suspended'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-6 border-b border-[#E5E0D5]/60">
                {customer.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={customer.avatarUrl}
                    alt={customer.fullName}
                    className="h-20 w-20 rounded-full object-cover border-2 border-[#163A2B]/20"
                  />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#163A2B]/10 text-2xl font-bold text-[#163A2B]">
                    {initials}
                  </div>
                )}
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-[#163A2B]">
                    {customer.fullName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1.5 text-xs text-[#6B756D]">
                      <Mail className="h-3.5 w-3.5 text-[#163A2B]" />
                      {customer.email}
                    </span>
                    {customer.isEmailVerified ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Verified Email
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="text-[10px]">
                        Unverified
                      </Badge>
                    )}
                    {customer.isGoogleLinked && (
                      <Badge variant="info" className="text-[10px]">
                        Google Linked
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 text-sm">
                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#6B756D]">
                    Phone Number
                  </span>
                  <div className="flex items-center gap-2 text-[#252A25] font-medium">
                    <Phone className="h-4 w-4 text-[#6B756D]" />
                    {customer.phoneNumber || (
                      <span className="text-[#6B756D]/60 italic">
                        Not provided
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#6B756D]">
                    Last Login
                  </span>
                  <div className="flex items-center gap-2 text-[#252A25] font-medium">
                    <Clock className="h-4 w-4 text-[#6B756D]" />
                    {customer.lastLoginAt ? (
                      formatDate(customer.lastLoginAt)
                    ) : (
                      <span className="text-[#6B756D]/60 italic">Never</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#6B756D]">
                    Account Registration Date
                  </span>
                  <div className="flex items-center gap-2 text-[#252A25] font-medium">
                    <Calendar className="h-4 w-4 text-[#6B756D]" />
                    {formatDate(customer.createdAt)}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#6B756D]">
                    Data Version
                  </span>
                  <div className="flex items-center gap-2 text-[#252A25] font-medium">
                    <ShieldCheck className="h-4 w-4 text-[#6B756D]" />
                    Version {customer.version}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Orders Card */}
          <Card className="border border-[#E5E0D5]">
            <CardHeader className="pb-4 border-b border-[#E5E0D5]/60 bg-[#FAF7F0]/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-[#163A2B]">
                    Recent Orders
                  </CardTitle>
                  <CardDescription className="text-xs text-[#6B756D]">
                    Latest purchase orders placed by this customer
                  </CardDescription>
                </div>
                <span className="text-xs font-semibold text-[#6B756D]">
                  {customer.recentOrders?.length || 0} recent recorded
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {customer.recentOrders && customer.recentOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-[#252A25]">
                    <thead className="border-b border-[#E5E0D5] bg-[#FAF7F0]/60 text-xs font-semibold uppercase tracking-wider text-[#6B756D]">
                      <tr>
                        <th className="px-4 py-3">Order ID</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-center">Items</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E0D5]/70">
                      {customer.recentOrders.map((order) => (
                        <tr
                          key={order.id}
                          className="hover:bg-[#FAF7F0]/40 transition-colors"
                        >
                          <td className="px-4 py-3.5 font-mono text-xs font-bold text-[#163A2B]">
                            {order.id.substring(0, 8)}...
                          </td>
                          <td className="px-4 py-3.5 text-xs text-[#6B756D]">
                            {formatDate(order.createdAt)}
                          </td>
                          <td className="px-4 py-3.5 text-center text-xs font-semibold text-[#252A25]">
                            {order.itemsCount}{' '}
                            {order.itemsCount === 1 ? 'item' : 'items'}
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-[#163A2B]">
                            {formatBDT(order.totalAmount)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <Badge
                              variant={getOrderStatusVariant(order.status)}
                              dot
                              className="text-[10px]"
                            >
                              {order.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              fullWidth={false}
                              onClick={() => router.push(`/admin/orders`)}
                              title="Go to Orders"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-[#6B756D]">
                  <ShoppingBag className="mx-auto h-8 w-8 text-[#6B756D]/40 mb-2" />
                  <p className="text-sm font-medium">
                    No orders found for this customer
                  </p>
                  <p className="text-xs text-[#6B756D]/80">
                    When this customer places an order, it will appear here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 Col): Delivery Addresses */}
        <div className="space-y-6">
          <Card className="border border-[#E5E0D5]">
            <CardHeader className="pb-4 border-b border-[#E5E0D5]/60 bg-[#FAF7F0]/40">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#163A2B]" />
                <div>
                  <CardTitle className="text-base text-[#163A2B]">
                    Delivery Addresses
                  </CardTitle>
                  <CardDescription className="text-xs text-[#6B756D]">
                    Saved shipping destinations from completed checkout orders
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {customer.addresses && customer.addresses.length > 0 ? (
                customer.addresses.map((addr, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-[#E5E0D5] bg-[#FAF7F0]/40 p-3.5 text-xs text-[#252A25] space-y-1.5 hover:border-[#163A2B]/40 transition-colors"
                  >
                    <div className="flex items-center justify-between font-semibold text-[#163A2B]">
                      <span>{addr.recipientName}</span>
                      <span className="text-[10px] text-[#6B756D] font-normal">
                        Used {formatDate(addr.lastUsedAt)}
                      </span>
                    </div>
                    <div className="text-[#6B756D] flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-[#163A2B]" />
                      <span>{addr.recipientPhone}</span>
                      {addr.altPhone && <span>/ {addr.altPhone}</span>}
                    </div>
                    <div className="pt-1 text-[#252A25]">
                      <p>{addr.addressLine}</p>
                      <p className="text-[#6B756D]">
                        {addr.area}, {addr.city}, {addr.district}
                      </p>
                      <p className="text-[#6B756D]">
                        {addr.division}{' '}
                        {addr.postalCode ? `- ${addr.postalCode}` : ''},{' '}
                        {addr.country}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-[#6B756D]">
                  <MapPin className="mx-auto h-7 w-7 text-[#6B756D]/40 mb-2" />
                  <p className="text-xs font-medium">
                    No delivery addresses on record
                  </p>
                  <p className="text-[11px] text-[#6B756D]/70">
                    Addresses are recorded upon order checkout.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={confirmStatusModal === 'deactivate'}
        onClose={() => setConfirmStatusModal(null)}
        onConfirm={handleToggleStatus}
        title="Suspend Customer Account"
        description={`Are you sure you want to suspend "${customer.fullName}" (${customer.email})? They will be unable to log in, place new orders, or access their customer account.`}
        confirmLabel="Suspend Account"
        variant="destructive"
        loading={isDeactivating}
      />

      <ConfirmDialog
        isOpen={confirmStatusModal === 'activate'}
        onClose={() => setConfirmStatusModal(null)}
        onConfirm={handleToggleStatus}
        title="Reactivate Customer Account"
        description={`Are you sure you want to reactivate "${customer.fullName}" (${customer.email})? They will regain access to log in and shop.`}
        confirmLabel="Activate Account"
        variant="primary"
        loading={isActivating}
      />
    </div>
  );
}
