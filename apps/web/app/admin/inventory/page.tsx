'use client';

import * as React from 'react';
import {
  PlusCircle,
  SlidersHorizontal,
  ClipboardCheck,
  History,
  Search,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/layout/admin-page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { SlideOver } from '@/components/ui/slide-over';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { KpiCard } from '@/components/ui/kpi-card';
import {
  useInventory,
  useInventorySummary,
  type InventoryItem,
} from '@/hooks/admin/use-inventory';
import { formatBDT, formatDate } from '@/lib/utils';

const INVENTORY_TABS = [
  { id: 'all', label: 'All SKUs' },
  { id: 'in_stock', label: 'In Stock' },
  { id: 'low_stock', label: 'Low Stock' },
  { id: 'out_of_stock', label: 'Out of Stock' },
];

export default function AdminInventoryPage() {
  const [activeTab, setActiveTab] = React.useState('all');
  const [page, setPage] = React.useState(1);
  const [searchInput, setSearchInput] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [isMovementsOpen, setIsMovementsOpen] = React.useState(false);

  // Modals state
  const [restockingItem, setRestockingItem] =
    React.useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = React.useState<number>(10);
  const [restockNotes, setRestockNotes] = React.useState('');

  const [adjustingItem, setAdjustingItem] =
    React.useState<InventoryItem | null>(null);
  const [adjustDelta, setAdjustDelta] = React.useState<number>(-1);
  const [adjustReason, setAdjustReason] = React.useState('damaged');
  const [adjustNotes, setAdjustNotes] = React.useState('');

  const [stocktakingItem, setStocktakingItem] =
    React.useState<InventoryItem | null>(null);
  const [physicalCount, setPhysicalCount] = React.useState<number>(0);
  const [stocktakeNotes, setStocktakeNotes] = React.useState('');

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { summary } = useInventorySummary();

  const {
    inventory,
    total,
    totalPages,
    isLoading,
    movements,
    isLoadingMovements,
    restock,
    isRestocking,
    adjustStock,
    isAdjusting,
    reconcileStocktake,
    isStocktaking,
  } = useInventory({
    page,
    limit: 10,
    search: debouncedSearch || undefined,
    status: activeTab,
  });

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockingItem) return;
    try {
      await restock({
        sku: restockingItem.sku,
        quantity: Number(restockQty),
        notes: restockNotes.trim() || undefined,
      });
      setRestockingItem(null);
      setRestockNotes('');
    } catch {
      // Toast handled in mutation
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;
    try {
      await adjustStock({
        sku: adjustingItem.sku,
        delta: Number(adjustDelta),
        reason: adjustReason.trim(),
        notes: adjustNotes.trim() || undefined,
      });
      setAdjustingItem(null);
      setAdjustNotes('');
    } catch {
      // Toast handled in mutation
    }
  };

  const handleStocktakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stocktakingItem) return;
    try {
      await reconcileStocktake({
        sku: stocktakingItem.sku,
        physicalCount: Number(physicalCount),
        notes: stocktakeNotes.trim() || undefined,
      });
      setStocktakingItem(null);
      setStocktakeNotes('');
    } catch {
      // Toast handled in mutation
    }
  };

  const columns: Column<InventoryItem>[] = [
    {
      header: 'SKU & Product',
      accessorKey: 'sku',
      cell: (item) => (
        <div>
          <p className="font-bold text-xs text-[#163A2B]">{item.sku}</p>
          <p className="text-xs text-[#252A25] max-w-xs truncate">
            {item.productName}
          </p>
        </div>
      ),
    },
    {
      header: 'Available Stock',
      accessorKey: 'availableStock',
      cell: (item) => (
        <span
          className={`font-bold text-sm ${
            item.availableStock <= 0
              ? 'text-[#C53030]'
              : item.availableStock <= item.reorderPoint
                ? 'text-[#B7791F]'
                : 'text-[#267A46]'
          }`}
        >
          {item.availableStock} units
        </span>
      ),
    },
    {
      header: 'Reserved (Orders)',
      accessorKey: 'reservedQuantity',
      cell: (item) => (
        <span className="text-xs text-[#6B756D] font-medium">
          {item.reservedQuantity} units
        </span>
      ),
    },
    {
      header: 'Physical On-Hand',
      accessorKey: 'physicalStock',
      cell: (item) => (
        <span className="text-xs font-semibold text-[#252A25]">
          {item.physicalStock} units
        </span>
      ),
    },
    {
      header: 'Low Stock Alert Level',
      accessorKey: 'reorderPoint',
      align: 'center',
      cell: (item) => (
        <span className="text-xs text-[#6B756D]">
          {item.reorderPoint} units
        </span>
      ),
    },
    {
      header: 'Health Status',
      accessorKey: 'status',
      align: 'center',
      cell: (item) => <StatusBadge status={item.status} />,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (item) => (
        <DropdownMenu
          actions={[
            {
              label: 'Restock (+ Inbound Units)',
              icon: <PlusCircle className="h-4 w-4" />,
              onClick: () => {
                setRestockingItem(item);
                setRestockQty(10);
              },
            },
            {
              label: 'Stock Adjustment (Damage/Loss)',
              icon: <SlidersHorizontal className="h-4 w-4" />,
              onClick: () => {
                setAdjustingItem(item);
                setAdjustDelta(-1);
              },
            },
            {
              label: 'Physical Stocktake Count',
              icon: <ClipboardCheck className="h-4 w-4" />,
              onClick: () => {
                setStocktakingItem(item);
                setPhysicalCount(item.physicalStock);
              },
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Warehouse Inventory & Stock Control"
        subtitle="Real-time stock levels, order reservations, inbound supply, and physical inventory audits."
        breadcrumbs={[{ label: 'Inventory' }]}
        actions={
          <Button
            variant="outline"
            size="sm"
            fullWidth={false}
            onClick={() => setIsMovementsOpen(true)}
            leftIcon={<History className="h-4 w-4" />}
          >
            Movements Audit Ledger
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total SKUs Tracked"
          value={summary?.totalSkus ?? total}
          icon={Warehouse}
          subtitle={`${summary?.totalUnitsOnHand ?? 0} total units in warehouse`}
        />
        <KpiCard
          title="In Stock (Healthy)"
          value={summary?.inStockSkus ?? 0}
          icon={CheckCircle2}
          subtitle={`${summary?.totalUnitsAvailable ?? 0} units available to sell`}
        />
        <KpiCard
          title="Low Stock Warnings"
          value={summary?.lowStockSkus ?? 0}
          icon={AlertTriangle}
          subtitle="At or below threshold"
        />
        <KpiCard
          title="Out of Stock"
          value={summary?.outOfStockSkus ?? 0}
          icon={XCircle}
          subtitle={
            summary?.estimatedRetailValueBDT
              ? `Valuation: ${formatBDT(summary.estimatedRetailValueCents)}`
              : 'Zero units available'
          }
        />
      </div>

      {/* Filters and Search Bar */}
      <Card className="border border-[#E5E0D5]">
        <CardContent className="p-4 space-y-4 sm:flex sm:items-center sm:justify-between sm:space-y-0 gap-4">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B756D]" />
            <Input
              type="text"
              placeholder="Search by SKU or product title..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>

          <Tabs
            tabs={INVENTORY_TABS}
            activeTab={activeTab}
            onChange={(tabId) => {
              setActiveTab(tabId);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card className="border border-[#E5E0D5] shadow-xs">
        <CardContent className="pt-5">
          <DataTable
            columns={columns}
            data={inventory}
            isLoading={isLoading}
            emptyMessage={
              debouncedSearch
                ? `No inventory items matching "${debouncedSearch}".`
                : 'No inventory SKUs registered yet.'
            }
            pagination={{
              page,
              totalPages,
              totalCount: total,
              onPageChange: (newPage) => setPage(newPage),
            }}
          />
        </CardContent>
      </Card>

      {/* Restock Modal */}
      <Modal
        isOpen={Boolean(restockingItem)}
        onClose={() => setRestockingItem(null)}
        title={`Restock SKU: ${restockingItem?.sku}`}
        description="Add newly received inventory from suppliers directly into available warehouse stock"
        footer={
          <div className="flex w-full items-center gap-2">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => setRestockingItem(null)}
              disabled={isRestocking}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="restock-form"
              variant="primary"
              fullWidth
              loading={isRestocking}
            >
              Confirm Restock
            </Button>
          </div>
        }
      >
        <form
          id="restock-form"
          onSubmit={handleRestockSubmit}
          className="space-y-4 py-2"
        >
          <div className="rounded-lg bg-[#FAF7F0] p-3 text-xs border border-[#E5E0D5]">
            <p className="font-semibold text-[#163A2B]">
              {restockingItem?.productName}
            </p>
            <p className="text-[#6B756D] mt-0.5">
              Current on-hand:{' '}
              <span className="font-bold text-[#252A25]">
                {restockingItem?.physicalStock} units
              </span>
            </p>
          </div>
          <Input
            label="Units to Add *"
            type="number"
            min="1"
            value={restockQty}
            onChange={(e) => setRestockQty(Number(e.target.value))}
            required
          />
          <Input
            label="Supplier / PO Reference"
            placeholder="e.g. PO-2026-10-09"
            value={restockNotes}
            onChange={(e) => setRestockNotes(e.target.value)}
          />
        </form>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={Boolean(adjustingItem)}
        onClose={() => setAdjustingItem(null)}
        title={`Adjust Stock: ${adjustingItem?.sku}`}
        description="Record manual decrement or increment for damaged, lost, or promotional items"
        footer={
          <div className="flex w-full items-center gap-2">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => setAdjustingItem(null)}
              disabled={isAdjusting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="adjust-form"
              variant="primary"
              fullWidth
              loading={isAdjusting}
            >
              Apply Adjustment
            </Button>
          </div>
        }
      >
        <form
          id="adjust-form"
          onSubmit={handleAdjustSubmit}
          className="space-y-4 py-2"
        >
          <div className="rounded-lg bg-[#FAF7F0] p-3 text-xs border border-[#E5E0D5]">
            <p className="font-semibold text-[#163A2B]">
              {adjustingItem?.productName}
            </p>
            <p className="text-[#6B756D] mt-0.5">
              Current on-hand:{' '}
              <span className="font-bold text-[#252A25]">
                {adjustingItem?.physicalStock} units
              </span>
            </p>
          </div>
          <Input
            label="Stock Delta (+/-) *"
            type="number"
            value={adjustDelta}
            onChange={(e) => setAdjustDelta(Number(e.target.value))}
            required
          />
          <Input
            label="Reason for Adjustment *"
            placeholder="e.g. damaged during transit, display sample"
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
            required
          />
          <Input
            label="Additional Notes"
            placeholder="Optional audit notes"
            value={adjustNotes}
            onChange={(e) => setAdjustNotes(e.target.value)}
          />
        </form>
      </Modal>

      {/* Stocktake Modal */}
      <Modal
        isOpen={Boolean(stocktakingItem)}
        onClose={() => setStocktakingItem(null)}
        title={`Physical Stocktake Audit: ${stocktakingItem?.sku}`}
        description="Reconcile database records with actual warehouse physical count"
        footer={
          <div className="flex w-full items-center gap-2">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => setStocktakingItem(null)}
              disabled={isStocktaking}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="stocktake-form"
              variant="primary"
              fullWidth
              loading={isStocktaking}
            >
              Reconcile Count
            </Button>
          </div>
        }
      >
        <form
          id="stocktake-form"
          onSubmit={handleStocktakeSubmit}
          className="space-y-4 py-2"
        >
          <div className="rounded-lg bg-[#FAF7F0] p-3 text-xs border border-[#E5E0D5]">
            <p className="font-semibold text-[#163A2B]">
              {stocktakingItem?.productName}
            </p>
            <p className="text-[#6B756D] mt-0.5">
              System recorded on-hand:{' '}
              <span className="font-bold text-[#252A25]">
                {stocktakingItem?.physicalStock} units
              </span>
            </p>
          </div>
          <Input
            label="Actual Physical Count Counted *"
            type="number"
            min="0"
            value={physicalCount}
            onChange={(e) => setPhysicalCount(Number(e.target.value))}
            required
          />
          <Input
            label="Audit Notes"
            placeholder="e.g. Q4 warehouse physical inventory audit"
            value={stocktakeNotes}
            onChange={(e) => setStocktakeNotes(e.target.value)}
          />
        </form>
      </Modal>

      {/* Movements Audit Trail Drawer */}
      <SlideOver
        isOpen={isMovementsOpen}
        onClose={() => setIsMovementsOpen(false)}
        title="Inventory Movements Audit Trail"
        description="Append-only immutable transaction ledger of all stock mutations across the warehouse"
        width="xl"
      >
        <div className="space-y-3">
          {isLoadingMovements ? (
            <div className="py-8 text-center text-xs text-[#6B756D]">
              Loading movements ledger...
            </div>
          ) : movements.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#6B756D]">
              No inventory movements recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-[#E5E0D5]/70">
              {movements.map((m) => (
                <div
                  key={m.id}
                  className="py-3 text-xs flex justify-between items-start"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#163A2B]">{m.sku}</span>
                      <span className="rounded-full bg-[#E8DFD0] px-2 py-0.5 text-[10px] font-bold uppercase text-[#252A25]">
                        {m.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {m.productTitle && (
                      <p className="text-[11px] text-[#252A25] mt-0.5 font-medium">
                        {m.productTitle}
                      </p>
                    )}
                    {m.reason && m.reason !== m.type && (
                      <p className="text-[11px] text-[#6B756D] mt-0.5">
                        Reason: {m.reason}
                      </p>
                    )}
                    {m.note && (
                      <p className="text-[10px] text-[#6B756D] italic mt-0.5">
                        &ldquo;{m.note}&rdquo;
                      </p>
                    )}
                    <p className="text-[10px] text-[#6B756D]/70 mt-1">
                      {formatDate(m.createdAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p
                      className={`font-bold ${
                        m.quantityDelta > 0
                          ? 'text-[#267A46]'
                          : m.quantityDelta < 0
                            ? 'text-[#C53030]'
                            : 'text-[#6B756D]'
                      }`}
                    >
                      {m.quantityDelta > 0
                        ? `+${m.quantityDelta}`
                        : m.quantityDelta}
                    </p>
                    <p className="text-[10px] text-[#6B756D]">
                      Bal: {m.balanceAfter}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SlideOver>
    </div>
  );
}
