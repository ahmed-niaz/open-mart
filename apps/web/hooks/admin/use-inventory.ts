'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

export interface InventoryItem {
  id: string;
  productId?: string;
  sku: string;
  productName: string;
  physicalStock: number;
  reservedQuantity: number;
  availableStock: number;
  reorderPoint: number;
  status: string;
  isActive: boolean;
  updatedAt?: string;
}

export interface InventorySummary {
  totalSkus: number;
  inStockSkus: number;
  lowStockSkus: number;
  outOfStockSkus: number;
  totalUnitsOnHand: number;
  totalUnitsReserved: number;
  totalUnitsAvailable: number;
  estimatedRetailValueCents: number;
  estimatedRetailValueBDT: number;
}

export interface InventoryMovement {
  id: string;
  sku: string;
  productTitle?: string;
  type: string;
  quantityDelta: number;
  balanceAfter: number;
  referenceId?: string;
  referenceType?: string;
  reason?: string;
  note?: string;
  createdAt: string;
}

export interface UseInventoryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

interface RawInventoryItem {
  id?: string;
  productId?: string;
  sku: string;
  productTitle?: string;
  productName?: string;
  quantityOnHand?: number;
  physicalStock?: number;
  reservedQuantity?: number;
  availableQuantity?: number;
  availableStock?: number;
  lowStockThreshold?: number;
  reorderPoint?: number;
  status?: string;
  isActive?: boolean;
  updatedAt?: string;
}

interface RawInventoryResponse {
  data?:
    | {
        items?: RawInventoryItem[];
        total?: number;
        page?: number;
        totalPages?: number;
      }
    | RawInventoryItem[];
  items?: RawInventoryItem[];
  total?: number;
  totalPages?: number;
  meta?: {
    total?: number;
    page?: number;
    totalPages?: number;
  };
}

interface RawMovementItem {
  id: string;
  sku: string;
  productTitle?: string;
  type?: string;
  reason?: string;
  quantityDelta?: number;
  onHandDelta?: number;
  reservedDelta?: number;
  balanceAfter?: number;
  onHandAfter?: number;
  referenceId?: string;
  referenceType?: string;
  note?: string;
  createdAt: string;
}

interface RawMovementsResponse {
  data?: RawMovementItem[];
  movements?: RawMovementItem[];
}

export function useInventorySummary() {
  const summaryQuery = useQuery<InventorySummary | null>({
    queryKey: ['admin-inventory-summary'],
    queryFn: async (): Promise<InventorySummary | null> => {
      const res = await apiClient<{ data: InventorySummary }>(
        '/api/admin/inventory/summary',
      );
      return res?.data || null;
    },
  });

  return {
    summary: summaryQuery.data,
    isLoading: summaryQuery.isLoading,
    refetch: summaryQuery.refetch,
  };
}

export function useInventory(params: UseInventoryParams = {}) {
  const queryClient = useQueryClient();
  const page = params.page || 1;
  const limit = params.limit || 20;
  const search = params.search || undefined;
  const status =
    params.status && params.status !== 'all' ? params.status : undefined;

  const inventoryQuery = useQuery<{
    items: InventoryItem[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: ['admin-inventory', page, limit, search, status],
    queryFn: async () => {
      const res = await apiClient<RawInventoryResponse>(
        '/api/admin/inventory',
        {
          params: {
            page,
            limit,
            search,
            status,
          },
        },
      );

      const rawItems = (
        res?.data && !Array.isArray(res.data) && Array.isArray(res.data.items)
          ? res.data.items
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.items)
              ? res.items
              : []
      ) as RawInventoryItem[];

      const metaTotal = !Array.isArray(res?.data)
        ? res?.data?.total
        : undefined;
      const metaTotalPages = !Array.isArray(res?.data)
        ? res?.data?.totalPages
        : undefined;
      const total =
        res?.meta?.total ?? metaTotal ?? res?.total ?? rawItems.length;
      const totalPages =
        res?.meta?.totalPages ?? metaTotalPages ?? res?.totalPages ?? 1;

      const items: InventoryItem[] = rawItems.map((item: RawInventoryItem) => ({
        id: item.id || item.sku,
        productId: item.productId,
        sku: item.sku,
        productName: item.productTitle || item.productName || item.sku,
        physicalStock: item.quantityOnHand ?? item.physicalStock ?? 0,
        reservedQuantity: item.reservedQuantity ?? 0,
        availableStock: item.availableQuantity ?? item.availableStock ?? 0,
        reorderPoint: item.lowStockThreshold ?? item.reorderPoint ?? 5,
        status: item.status || 'in_stock',
        isActive: item.isActive ?? true,
        updatedAt: item.updatedAt || '',
      }));

      return {
        items,
        total,
        page,
        totalPages,
      };
    },
  });

  const movementsQuery = useQuery<InventoryMovement[]>({
    queryKey: ['admin-inventory-movements'],
    queryFn: async (): Promise<InventoryMovement[]> => {
      const res = await apiClient<RawMovementsResponse>(
        '/api/admin/inventory/movements',
        {
          params: { limit: 50 },
        },
      );

      const rawMovements = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.movements)
          ? res.movements
          : [];

      return rawMovements.map((m: RawMovementItem) => ({
        id: m.id,
        sku: m.sku,
        productTitle: m.productTitle,
        type: m.type || m.reason || 'movement',
        quantityDelta:
          m.quantityDelta ??
          (m.onHandDelta && m.onHandDelta !== 0
            ? m.onHandDelta
            : m.reservedDelta) ??
          0,
        balanceAfter: m.balanceAfter ?? m.onHandAfter ?? 0,
        referenceId: m.referenceId,
        referenceType: m.referenceType,
        reason: m.reason,
        note: m.note,
        createdAt: m.createdAt,
      }));
    },
  });

  const restockMutation = useMutation({
    mutationFn: async (data: {
      sku: string;
      quantity: number;
      notes?: string;
    }) => {
      const idempotencyKey = crypto.randomUUID();
      return apiClient('/api/admin/inventory/restock', {
        method: 'POST',
        headers: {
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          sku: data.sku,
          quantity: data.quantity,
          note: data.notes,
        }),
      });
    },
    onSuccess: () => {
      toast.success('Inventory restocked successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
      queryClient.invalidateQueries({
        queryKey: ['admin-inventory-movements'],
      });
      queryClient.invalidateQueries({ queryKey: ['admin-inventory-summary'] });
      queryClient.invalidateQueries({
        queryKey: ['analytics-inventory-health'],
      });
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async (data: {
      sku: string;
      delta: number;
      reason: string;
      notes?: string;
    }) => {
      const idempotencyKey = crypto.randomUUID();
      return apiClient('/api/admin/inventory/adjust', {
        method: 'POST',
        headers: {
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          sku: data.sku,
          delta: data.delta,
          reason: data.reason,
          note: data.notes,
        }),
      });
    },
    onSuccess: () => {
      toast.success('Stock adjustment applied');
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
      queryClient.invalidateQueries({
        queryKey: ['admin-inventory-movements'],
      });
      queryClient.invalidateQueries({ queryKey: ['admin-inventory-summary'] });
    },
  });

  const stocktakeMutation = useMutation({
    mutationFn: async (data: {
      sku: string;
      physicalCount: number;
      notes?: string;
    }) => {
      return apiClient('/api/admin/inventory/stocktake', {
        method: 'POST',
        body: JSON.stringify({
          sku: data.sku,
          countedQuantity: data.physicalCount,
          note: data.notes,
        }),
      });
    },
    onSuccess: () => {
      toast.success('Physical stock count reconciled');
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
      queryClient.invalidateQueries({
        queryKey: ['admin-inventory-movements'],
      });
      queryClient.invalidateQueries({ queryKey: ['admin-inventory-summary'] });
    },
  });

  return {
    inventory: inventoryQuery.data?.items || [],
    total: inventoryQuery.data?.total || 0,
    page: inventoryQuery.data?.page || page,
    totalPages: inventoryQuery.data?.totalPages || 1,
    isLoading: inventoryQuery.isLoading,
    refetch: inventoryQuery.refetch,
    movements: movementsQuery.data || [],
    isLoadingMovements: movementsQuery.isLoading,
    restock: restockMutation.mutateAsync,
    isRestocking: restockMutation.isPending,
    adjustStock: adjustMutation.mutateAsync,
    isAdjusting: adjustMutation.isPending,
    reconcileStocktake: stocktakeMutation.mutateAsync,
    isStocktaking: stocktakeMutation.isPending,
  };
}
