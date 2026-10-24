'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Eye,
  UserCheck,
  UserX,
  ShoppingBag,
  Coins,
  ShieldCheck,
} from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/layout/admin-page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { KpiCard } from '@/components/ui/kpi-card';
import {
  useCustomers,
  type AdminCustomerListItem,
} from '@/hooks/admin/use-customers';
import { formatBDT, formatDate } from '@/lib/utils';

const STATUS_TABS = [
  { id: 'all', label: 'All Customers' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Suspended / Inactive' },
];

export default function AdminCustomersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState('all');
  const [page, setPage] = React.useState(1);
  const [searchInput, setSearchInput] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  // Confirmation dialogs
  const [activatingCustomer, setActivatingCustomer] =
    React.useState<AdminCustomerListItem | null>(null);
  const [deactivatingCustomer, setDeactivatingCustomer] =
    React.useState<AdminCustomerListItem | null>(null);

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const isActiveFilter = React.useMemo(() => {
    if (activeTab === 'active') return true;
    if (activeTab === 'inactive') return false;
    return undefined;
  }, [activeTab]);

  const {
    customers,
    total,
    totalPages,
    isLoading,
    activateCustomer,
    isActivating,
    deactivateCustomer,
    isDeactivating,
  } = useCustomers({
    page,
    limit: 10,
    search: debouncedSearch || undefined,
    isActive: isActiveFilter,
  });

  // Calculate quick summary metrics from current records
  const totalSpentAll = React.useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.totalSpentCents || 0), 0);
  }, [customers]);

  const totalOrdersAll = React.useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.totalOrders || 0), 0);
  }, [customers]);

  const activeCount = React.useMemo(() => {
    return customers.filter((c) => c.isActive).length;
  }, [customers]);

  const handleConfirmActivate = async () => {
    if (!activatingCustomer) return;
    try {
      await activateCustomer(activatingCustomer.id);
      setActivatingCustomer(null);
    } catch {
      // toast is already handled in hook
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingCustomer) return;
    try {
      await deactivateCustomer(deactivatingCustomer.id);
      setDeactivatingCustomer(null);
    } catch {
      // toast is already handled in hook
    }
  };

  const columns: Column<AdminCustomerListItem>[] = [
    {
      header: 'Customer',
      cell: (row) => {
        const initials =
          `${row.firstName?.[0] || ''}${row.lastName?.[0] || ''}`.toUpperCase() ||
          row.email.substring(0, 2).toUpperCase();

        return (
          <div className="flex items-center gap-3">
            {row.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.avatarUrl}
                alt={row.fullName}
                className="h-10 w-10 rounded-full object-cover border border-[#E5E0D5]"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#163A2B]/10 text-xs font-bold text-[#163A2B]">
                {initials}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-[#163A2B] truncate hover:underline">
                <Link href={`/admin/customers/${row.id}`}>{row.fullName}</Link>
              </span>
              <span className="text-xs text-[#6B756D] truncate">
                {row.email}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Phone',
      cell: (row) => (
        <span className="text-sm text-[#252A25]">
          {row.phoneNumber || <span className="text-[#6B756D]/50">—</span>}
        </span>
      ),
    },
    {
      header: 'Orders',
      align: 'center',
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#FAF7F0] px-2.5 py-1 text-xs font-semibold text-[#163A2B] border border-[#E5E0D5]">
          <ShoppingBag className="h-3 w-3 text-[#2F855A]" />
          {row.totalOrders}
        </span>
      ),
    },
    {
      header: 'Total Spent',
      align: 'right',
      cell: (row) => (
        <span className="font-semibold text-[#163A2B]">
          {formatBDT(row.totalSpentCents)}
        </span>
      ),
    },
    {
      header: 'Last Order',
      cell: (row) => (
        <span className="text-xs text-[#6B756D]">
          {row.lastOrderAt ? (
            formatDate(row.lastOrderAt)
          ) : (
            <span className="text-[#6B756D]/60 italic">Never ordered</span>
          )}
        </span>
      ),
    },
    {
      header: 'Status',
      align: 'center',
      cell: (row) => (
        <Badge variant={row.isActive ? 'success' : 'error'} dot>
          {row.isActive ? 'Active' : 'Suspended'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div
          className="flex items-center justify-end gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="outline"
            size="sm"
            fullWidth={false}
            onClick={() => router.push(`/admin/customers/${row.id}`)}
            title="View Details"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">View</span>
          </Button>

          {row.isActive ? (
            <Button
              variant="destructive"
              size="sm"
              fullWidth={false}
              onClick={() => setDeactivatingCustomer(row)}
              title="Suspend Customer"
            >
              <UserX className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Suspend</span>
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              fullWidth={false}
              onClick={() => setActivatingCustomer(row)}
              title="Activate Customer"
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Activate</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Customer Management"
        subtitle="View registered store customers, purchase history, and control customer account status."
        breadcrumbs={[{ label: 'Customers' }]}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Customers"
          value={total}
          icon={Users}
          subtitle="Registered accounts"
        />
        <KpiCard
          title="Active in View"
          value={activeCount}
          icon={ShieldCheck}
          subtitle="Account status active"
        />
        <KpiCard
          title="Orders Placed"
          value={totalOrdersAll}
          icon={ShoppingBag}
          subtitle="From current list"
        />
        <KpiCard
          title="Gross Customer Value"
          value={formatBDT(totalSpentAll)}
          icon={Coins}
          subtitle="Lifetime purchases"
        />
      </div>

      {/* Filters and Search Bar */}
      <Card className="border border-[#E5E0D5]">
        <CardContent className="p-4 space-y-4 sm:flex sm:items-center sm:justify-between sm:space-y-0 gap-4">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B756D]" />
            <Input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>

          <Tabs
            tabs={STATUS_TABS}
            activeTab={activeTab}
            onChange={(tabId) => {
              setActiveTab(tabId);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      {/* Customers Table */}
      <DataTable
        columns={columns}
        data={customers}
        isLoading={isLoading}
        emptyMessage={
          debouncedSearch
            ? `No customers found matching "${debouncedSearch}".`
            : 'No customer accounts registered yet.'
        }
        pagination={{
          page,
          totalPages,
          totalCount: total,
          onPageChange: (newPage) => setPage(newPage),
        }}
        onRowClick={(row) => router.push(`/admin/customers/${row.id}`)}
      />

      {/* Confirm Deactivation Dialog */}
      <ConfirmDialog
        isOpen={!!deactivatingCustomer}
        onClose={() => setDeactivatingCustomer(null)}
        onConfirm={handleConfirmDeactivate}
        title="Suspend Customer Account"
        description={`Are you sure you want to suspend "${deactivatingCustomer?.fullName}" (${deactivatingCustomer?.email})? They will be unable to log in, place new orders, or manage their account until reactivated.`}
        confirmLabel="Suspend Account"
        variant="destructive"
        loading={isDeactivating}
      />

      {/* Confirm Activation Dialog */}
      <ConfirmDialog
        isOpen={!!activatingCustomer}
        onClose={() => setActivatingCustomer(null)}
        onConfirm={handleConfirmActivate}
        title="Reactivate Customer Account"
        description={`Are you sure you want to reactivate "${activatingCustomer?.fullName}" (${activatingCustomer?.email})? They will regain full access to their customer account.`}
        confirmLabel="Activate Account"
        variant="primary"
        loading={isActivating}
      />
    </div>
  );
}
