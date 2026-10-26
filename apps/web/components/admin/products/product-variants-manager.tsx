'use client';

import * as React from 'react';
import {
  GripVertical,
  Plus,
  PlusCircle,
  Trash2,
  Image as ImageIcon,
  ChevronDown,
  Palette,
  Search,
  X,
  Layers,
  Database,
  SlidersHorizontal,
  Share2,
  FileText,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type AdminProductVariant } from '@/hooks/admin/use-products';
import {
  MediaPickerModal,
  type SelectedMediaItem,
} from '@/components/admin/media/media-picker-modal';

// Color name to CSS hex mapping for swatch previews
const COLOR_SWATCH_MAP: Record<string, string> = {
  red: '#EF4444',
  blue: '#3B82F6',
  green: '#10B981',
  black: '#111827',
  white: '#FFFFFF',
  yellow: '#F59E0B',
  purple: '#8B5CF6',
  pink: '#EC4899',
  orange: '#F97316',
  gray: '#6B7280',
  grey: '#6B7280',
  navy: '#1E3A8A',
  brown: '#78350F',
  beige: '#F5F5DC',
  gold: '#D97706',
  silver: '#E5E7EB',
  maroon: '#800000',
  olive: '#808000',
  teal: '#14B8A6',
  cyan: '#06B6D4',
  indigo: '#4F46E5',
  violet: '#7C3AED',
  magenta: '#D946EF',
  coral: '#FB7185',
  lime: '#84CC16',
  amber: '#F59E0B',
  emerald: '#10B981',
  sky: '#0EA5E9',
  slate: '#64748B',
  zinc: '#71717A',
};

function resolveColorSwatch(colorName: string): string {
  const clean = colorName.trim().toLowerCase();
  if (clean.startsWith('#') || clean.startsWith('rgb')) {
    return clean;
  }
  return COLOR_SWATCH_MAP[clean] || '#9CA3AF';
}

export interface ProductOptionGroup {
  id: string;
  name: string;
  values: string[];
  isEditing: boolean;
  type?: 'color' | 'standard';
}

interface ProductVariantsManagerProps {
  variants: AdminProductVariant[];
  onChange: (variants: AdminProductVariant[]) => void;
  baseSku?: string;
  basePrice?: number;
  baseStock?: number;
}

export function ProductVariantsManager({
  variants,
  onChange,
  baseSku = '',
  basePrice = 0,
  baseStock = 0,
}: ProductVariantsManagerProps) {
  const [enabled, setEnabled] = React.useState<boolean>(variants.length > 0);
  const hasVariants = variants.length > 0 || enabled;

  // Initialize option groups from existing variants or default to Size
  const [optionGroups, setOptionGroups] = React.useState<ProductOptionGroup[]>(
    () => {
      if (variants.length === 0) {
        return [
          {
            id: 'opt-size',
            name: 'Size',
            values: ['S', 'M', 'L'],
            isEditing: false,
            type: 'standard',
          },
        ];
      }

      const map = new Map<string, Set<string>>();
      for (const v of variants) {
        if (v.options) {
          for (const [k, val] of Object.entries(v.options)) {
            if (!map.has(k)) map.set(k, new Set());
            if (val) map.get(k)!.add(val);
          }
        }
      }

      if (map.size === 0) {
        return [
          {
            id: 'opt-size',
            name: 'Size',
            values: ['S', 'M', 'L'],
            isEditing: false,
            type: 'standard',
          },
        ];
      }

      return Array.from(map.entries()).map(([name, valSet], idx) => ({
        id: `opt-${idx + 1}`,
        name,
        values: Array.from(valSet),
        isEditing: false,
        type: name.trim().toLowerCase() === 'color' ? 'color' : 'standard',
      }));
    },
  );

  // Group by option name ('Color', 'Size', etc., or 'none')
  const [groupBy, setGroupBy] = React.useState<string>(() => {
    return optionGroups[0]?.name || 'Size';
  });

  // Derived effective groupBy ensures no stale selection if an option group is removed
  const effectiveGroupBy =
    groupBy !== 'none' && !optionGroups.some((g) => g.name === groupBy)
      ? optionGroups[0]?.name || 'none'
      : groupBy;

  // Search filter
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [showSearchInput, setShowSearchInput] = React.useState<boolean>(false);

  // Selected variant indices for bulk operations
  const [selectedIndices, setSelectedIndices] = React.useState<Set<number>>(
    new Set(),
  );

  // Collapsed status for grouped rows (default: expanded)
  const [expandedGroups, setExpandedGroups] = React.useState<
    Record<string, boolean>
  >({});

  // Input states for adding values per option
  const [newValInputs, setNewValInputs] = React.useState<
    Record<string, string>
  >({});

  // Bulk input state
  const [bulkPrice, setBulkPrice] = React.useState<string>('');
  const [bulkStock, setBulkStock] = React.useState<string>('');

  // Media Picker state for variant thumbnail assignment
  const [isMediaPickerOpen, setIsMediaPickerOpen] = React.useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = React.useState<{
    type: 'group' | 'variant';
    groupName?: string;
    variantIndex?: number;
  } | null>(null);

  // Synchronize combinations whenever option groups change
  const syncCombinations = (updatedGroups: ProductOptionGroup[]) => {
    // Deduplicate values inside each group and filter valid groups
    const activeGroups = updatedGroups
      .map((g) => ({
        ...g,
        values: Array.from(
          new Set(g.values.map((v) => v.trim()).filter(Boolean)),
        ),
      }))
      .filter((g) => g.name.trim() !== '' && g.values.length > 0);

    if (activeGroups.length === 0) {
      onChange([]);
      return;
    }

    const cartesian = (grps: typeof activeGroups): Record<string, string>[] => {
      if (grps.length === 0) return [{}];
      const [first, ...rest] = grps;
      const restCombos = cartesian(rest);
      const result: Record<string, string>[] = [];
      for (const val of first.values) {
        for (const combo of restCombos) {
          result.push({ [first.name.trim()]: val.trim(), ...combo });
        }
      }
      return result;
    };

    const combinations = cartesian(activeGroups);

    // Existing variants index by normalized combination signature
    const existingMap = new Map<string, AdminProductVariant>();
    for (const v of variants) {
      if (v.options && Object.keys(v.options).length > 0) {
        const sig = Object.entries(v.options)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(
            ([k, val]) =>
              `${k.toLowerCase().trim()}:${val.toLowerCase().trim()}`,
          )
          .join('|');
        existingMap.set(sig, v);
      }
    }

    const cleanBaseSku = (baseSku || 'SKU')
      .replace(/[^A-Za-z0-9-]/g, '')
      .toUpperCase()
      .substring(0, 30);
    const usedSkus = new Set<string>();
    // Parent product SKU cannot be reused by any variant
    usedSkus.add(cleanBaseSku);

    const newVariants: AdminProductVariant[] = combinations.map((combo) => {
      const sig = Object.entries(combo)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([k, val]) => `${k.toLowerCase().trim()}:${val.toLowerCase().trim()}`,
        )
        .join('|');

      const existing = existingMap.get(sig);
      if (existing) {
        let candidateSku = existing.sku
          ? existing.sku.trim().toUpperCase()
          : '';
        if (!candidateSku || usedSkus.has(candidateSku)) {
          const skuSuffix = Object.values(combo)
            .map((val) =>
              val
                .replace(/[^A-Za-z0-9]/g, '')
                .substring(0, 4)
                .toUpperCase(),
            )
            .join('-');
          let candidate = `${cleanBaseSku}-${skuSuffix || 'VAR'}`;
          let counter = 1;
          while (usedSkus.has(candidate)) {
            candidate = `${cleanBaseSku}-${skuSuffix || 'VAR'}-${counter++}`;
          }
          candidateSku = candidate;
        }
        usedSkus.add(candidateSku);

        return {
          ...existing,
          name: Object.values(combo).join(' / '),
          options: combo,
          sku: candidateSku,
          priceBDT:
            existing.priceBDT !== undefined && !isNaN(existing.priceBDT)
              ? existing.priceBDT
              : basePrice > 0
                ? basePrice
                : 99,
          inventoryQuantity:
            existing.inventoryQuantity !== undefined
              ? existing.inventoryQuantity
              : baseStock > 0
                ? baseStock
                : 0,
        };
      }

      // Generate suggested unique SKU: e.g. "SHIRT-RED-M"
      const skuSuffix = Object.values(combo)
        .map((val) =>
          val
            .replace(/[^A-Za-z0-9]/g, '')
            .substring(0, 4)
            .toUpperCase(),
        )
        .join('-');
      let candidate = `${cleanBaseSku}-${skuSuffix || 'VAR'}`;
      let counter = 1;
      while (usedSkus.has(candidate)) {
        candidate = `${cleanBaseSku}-${skuSuffix || 'VAR'}-${counter++}`;
      }
      usedSkus.add(candidate);

      return {
        id: undefined,
        name: Object.values(combo).join(' / '),
        options: combo,
        sku: candidate,
        priceBDT: basePrice > 0 ? basePrice : 99,
        inventoryQuantity: baseStock > 0 ? baseStock : 0,
      };
    });

    onChange(newVariants);
  };

  // Enable/disable variants
  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (!checked) {
      onChange([]);
    } else {
      if (
        optionGroups.length === 0 ||
        !optionGroups.some((g) => g.values.length > 0)
      ) {
        const defaultGroup: ProductOptionGroup = {
          id: 'opt-size',
          name: 'Size',
          values: ['S', 'M', 'L'],
          isEditing: false,
          type: 'standard',
        };
        setOptionGroups([defaultGroup]);
        syncCombinations([defaultGroup]);
      } else {
        syncCombinations(optionGroups);
      }
    }
  };

  // Add a new option group
  const addOption = () => {
    const defaultNames = ['Color', 'Size', 'Material', 'Style', 'Title'];
    const usedNames = new Set(optionGroups.map((g) => g.name.toLowerCase()));
    const nextSuggestedName =
      defaultNames.find((n) => !usedNames.has(n.toLowerCase())) ||
      `Option ${optionGroups.length + 1}`;

    const isColor = nextSuggestedName.toLowerCase() === 'color';

    const newGroup: ProductOptionGroup = {
      id: `opt-${Date.now()}`,
      name: nextSuggestedName,
      values: [],
      isEditing: true,
      type: isColor ? 'color' : 'standard',
    };
    const next = [...optionGroups, newGroup];
    setOptionGroups(next);
  };

  // Remove an option group
  const removeOption = (id: string) => {
    const next = optionGroups.filter((g) => g.id !== id);
    setOptionGroups(next);
    syncCombinations(next);
    if (next.length > 0 && !next.some((g) => g.name === groupBy)) {
      setGroupBy(next[0].name);
    }
  };

  // Update option name
  const updateOptionName = (id: string, name: string) => {
    const isColor = name.trim().toLowerCase() === 'color';
    const next: ProductOptionGroup[] = optionGroups.map((g) =>
      g.id === id
        ? {
            ...g,
            name,
            type: isColor
              ? ('color' as const)
              : g.type === 'color'
                ? ('standard' as const)
                : g.type,
          }
        : g,
    );
    setOptionGroups(next);
    syncCombinations(next);
  };

  // Toggle edit/done state for an option group
  const setOptionEditing = (id: string, isEditing: boolean) => {
    const next = optionGroups.map((g) =>
      g.id === id ? { ...g, isEditing } : g,
    );
    setOptionGroups(next);
    if (!isEditing) {
      syncCombinations(next);
    }
  };

  // Add an option value (via tag chip or row input)
  const addOptionValue = (groupId: string, val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;

    const next = optionGroups.map((g) => {
      if (g.id === groupId) {
        if (g.values.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
          return g;
        }
        return { ...g, values: [...g.values, trimmed] };
      }
      return g;
    });

    setOptionGroups(next);
    setNewValInputs((prev) => ({ ...prev, [groupId]: '' }));
    syncCombinations(next);
  };

  // Update a specific option value row
  const updateOptionValueAt = (
    groupId: string,
    index: number,
    newVal: string,
  ) => {
    const next = optionGroups.map((g) => {
      if (g.id === groupId) {
        const updatedVals = [...g.values];
        updatedVals[index] = newVal;
        return { ...g, values: updatedVals };
      }
      return g;
    });
    setOptionGroups(next);
    syncCombinations(next);
  };

  // Remove an option value
  const removeOptionValueAt = (groupId: string, index: number) => {
    const next = optionGroups.map((g) => {
      if (g.id === groupId) {
        const updatedVals = g.values.filter((_, idx) => idx !== index);
        return { ...g, values: updatedVals };
      }
      return g;
    });
    setOptionGroups(next);
    syncCombinations(next);
  };

  // Update a specific variant row field
  const updateVariantRow = (
    index: number,
    field: keyof AdminProductVariant,
    value: unknown,
  ) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  // Delete a variant row
  const removeVariantRow = (index: number) => {
    const updated = variants.filter((_, idx) => idx !== index);
    onChange(updated);
    setSelectedIndices((prev) => {
      const next = new Set<number>();
      prev.forEach((idx) => {
        if (idx < index) next.add(idx);
        else if (idx > index) next.add(idx - 1);
      });
      return next;
    });
  };

  // Bulk Apply Price to selected
  const applyBulkPrice = () => {
    const price = parseFloat(bulkPrice);
    if (isNaN(price) || price < 0 || selectedIndices.size === 0) return;
    const updated = variants.map((v, idx) =>
      selectedIndices.has(idx) ? { ...v, priceBDT: price } : v,
    );
    onChange(updated);
    setBulkPrice('');
  };

  // Bulk Apply Stock to selected
  const applyBulkStock = () => {
    const stock = parseInt(bulkStock, 10);
    if (isNaN(stock) || stock < 0 || selectedIndices.size === 0) return;
    const updated = variants.map((v, idx) =>
      selectedIndices.has(idx) ? { ...v, inventoryQuantity: stock } : v,
    );
    onChange(updated);
    setBulkStock('');
  };

  // Bulk Delete selected
  const deleteSelected = () => {
    const updated = variants.filter((_, idx) => !selectedIndices.has(idx));
    onChange(updated);
    setSelectedIndices(new Set());
  };

  // Toggle selection for all variants
  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIndices(new Set(variants.map((_, idx) => idx)));
    } else {
      setSelectedIndices(new Set());
    }
  };

  // Toggle selection for a single variant
  const toggleSelectVariant = (index: number, checked: boolean) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (checked) next.add(index);
      else next.delete(index);
      return next;
    });
  };

  // Filtered variants based on search
  const filteredVariants = React.useMemo(() => {
    if (!searchQuery.trim()) return variants;
    const q = searchQuery.toLowerCase().trim();
    return variants.filter(
      (v) =>
        v.name?.toLowerCase().includes(q) ||
        v.sku?.toLowerCase().includes(q) ||
        (v.options &&
          Object.values(v.options).some((val) =>
            val.toLowerCase().includes(q),
          )),
    );
  }, [variants, searchQuery]);

  // Total inventory stock tally
  const totalStock = variants.reduce(
    (sum, v) => sum + (v.inventoryQuantity ?? 0),
    0,
  );

  // Grouped variants map
  const groupedData = React.useMemo(() => {
    if (effectiveGroupBy === 'none') {
      return null;
    }

    const groups: Record<
      string,
      { variants: { variant: AdminProductVariant; originalIndex: number }[] }
    > = {};

    filteredVariants.forEach((variant) => {
      const originalIndex = variants.indexOf(variant);
      const groupVal = variant.options?.[effectiveGroupBy] || 'Default';
      if (!groups[groupVal]) {
        groups[groupVal] = { variants: [] };
      }
      groups[groupVal].variants.push({ variant, originalIndex });
    });

    return groups;
  }, [filteredVariants, variants, effectiveGroupBy]);

  // Toggle expand/collapse for a group row
  const toggleGroupExpand = (groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: prev[groupName] === undefined ? false : !prev[groupName],
    }));
  };

  // Handle media selection from MediaPickerModal
  const handleMediaSelected = (items: SelectedMediaItem[]) => {
    if (!mediaPickerTarget || items.length === 0) {
      setIsMediaPickerOpen(false);
      return;
    }

    const selectedUrl = items[0].url;

    if (
      mediaPickerTarget.type === 'variant' &&
      mediaPickerTarget.variantIndex !== undefined
    ) {
      updateVariantRow(mediaPickerTarget.variantIndex, 'imageUrl', selectedUrl);
    } else if (
      mediaPickerTarget.type === 'group' &&
      mediaPickerTarget.groupName
    ) {
      const groupName = mediaPickerTarget.groupName;
      const updated = variants.map((v) => {
        if (v.options?.[effectiveGroupBy] === groupName) {
          return { ...v, imageUrl: selectedUrl };
        }
        return v;
      });
      onChange(updated);
    }

    setIsMediaPickerOpen(false);
    setMediaPickerTarget(null);
  };

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#252A25]">Variants</h3>
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hasVariants}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-[#E5E0D5] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#163A2B]"></div>
          <span className="ml-2 text-xs font-medium text-[#6B756D]">
            {hasVariants ? 'Enabled' : 'Disabled'}
          </span>
        </label>
      </div>

      {!hasVariants ? (
        <Card className="border border-[#E5E0D5] bg-white rounded-2xl shadow-xs p-6 text-center">
          <Layers className="h-8 w-8 text-[#6B756D]/40 mx-auto mb-2" />
          <p className="text-xs font-semibold text-[#252A25]">
            This product has no variants
          </p>
          <p className="text-[11px] text-[#6B756D] mt-1 mb-3">
            Add options like Color, Size, or Material to sell different
            variations of this product.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleToggle(true)}
            className="rounded-full text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Options & Variants
          </Button>
        </Card>
      ) : (
        /* Shopify-Style Variants Card Container */
        <Card className="border border-[#E5E0D5] bg-white rounded-2xl shadow-xs overflow-hidden">
          <CardContent className="p-0 bg-white divide-y divide-[#E5E0D5]">
            {/* 1. Option Cards List */}
            <div className="divide-y divide-[#E5E0D5]">
              {optionGroups.map((group) => {
                const isColor =
                  group.type === 'color' ||
                  group.name.trim().toLowerCase() === 'color';

                return (
                  <div key={group.id} className="p-4 sm:p-5 bg-white space-y-4">
                    {group.isEditing ? (
                      /* EDITING STATE FOR OPTION CARD */
                      <div className="space-y-4">
                        {/* Option Name Row */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-semibold text-[#252A25]">
                                Option name
                              </label>
                            </div>
                            {isColor ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#0284C7] bg-[#E0F2FE] border border-[#BAE6FD] px-2.5 py-0.5 rounded-md">
                                <Palette className="h-3.5 w-3.5 text-[#0284C7]" />
                                Color
                              </span>
                            ) : (
                              <Database className="h-4 w-4 text-[#64748B]" />
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-[#64748B]/60 shrink-0 cursor-grab" />
                            <Input
                              type="text"
                              value={group.name}
                              onChange={(e) =>
                                updateOptionName(group.id, e.target.value)
                              }
                              placeholder="e.g. Color, Size, Material"
                              className="h-9 text-xs bg-white rounded-lg border-[#E5E0D5] text-[#252A25] font-medium"
                            />
                          </div>
                        </div>

                        {/* Option Values Section */}
                        {isColor ? (
                          /* COLOR OPTION: Inner Box with Swatch Pills and Add Color Input */
                          <div className="space-y-1.5 pl-6">
                            <div className="rounded-xl border border-[#E5E0D5] bg-white p-3 space-y-2.5">
                              {/* Pill Swatches */}
                              <div className="flex flex-wrap items-center gap-2">
                                {group.values.map((val, vIdx) => (
                                  <span
                                    key={`${val}-${vIdx}`}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-[#E0F2FE]/40 px-2.5 py-1 text-xs font-medium text-[#1E293B]"
                                  >
                                    <span
                                      className="h-3.5 w-3.5 rounded-xs shrink-0 border border-black/10 shadow-2xs"
                                      style={{
                                        backgroundColor:
                                          resolveColorSwatch(val),
                                      }}
                                    />
                                    <span>{val}</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeOptionValueAt(group.id, vIdx)
                                      }
                                      className="text-neutral-400 hover:text-neutral-800 transition-colors cursor-pointer ml-0.5"
                                      title="Remove color"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </span>
                                ))}
                              </div>

                              {/* Add color input field */}
                              <input
                                type="text"
                                placeholder="Add color"
                                value={newValInputs[group.id] || ''}
                                onChange={(e) =>
                                  setNewValInputs((prev) => ({
                                    ...prev,
                                    [group.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ',') {
                                    e.preventDefault();
                                    addOptionValue(
                                      group.id,
                                      newValInputs[group.id] || '',
                                    );
                                  }
                                }}
                                onBlur={() => {
                                  if (newValInputs[group.id]?.trim()) {
                                    addOptionValue(
                                      group.id,
                                      newValInputs[group.id],
                                    );
                                  }
                                }}
                                className="w-full border-none bg-transparent text-xs text-[#252A25] placeholder:text-[#94A3B8] focus:outline-none py-1"
                              />
                            </div>
                          </div>
                        ) : (
                          /* STANDARD OPTION: Values Rows with Grips, Inputs, and Trash Can */
                          <div className="space-y-2 pl-6">
                            <label className="text-xs font-semibold text-[#64748B] block">
                              Option values
                            </label>

                            <div className="space-y-2">
                              {group.values.map((val, vIdx) => (
                                <div
                                  key={`${val}-${vIdx}`}
                                  className="flex items-center gap-2"
                                >
                                  <GripVertical className="h-4 w-4 text-[#64748B]/60 shrink-0 cursor-grab" />
                                  <div className="flex-1 relative flex items-center">
                                    <Input
                                      type="text"
                                      value={val}
                                      onChange={(e) =>
                                        updateOptionValueAt(
                                          group.id,
                                          vIdx,
                                          e.target.value,
                                        )
                                      }
                                      className="h-9 text-xs bg-white rounded-lg border-[#E5E0D5] pr-9"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeOptionValueAt(group.id, vIdx)
                                      }
                                      className="absolute right-2 text-[#64748B] hover:text-red-600 transition-colors p-1 cursor-pointer"
                                      title="Delete value"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}

                              {/* Add another value input */}
                              <div className="pt-1">
                                <Input
                                  type="text"
                                  placeholder="Add another value"
                                  value={newValInputs[group.id] || ''}
                                  onChange={(e) =>
                                    setNewValInputs((prev) => ({
                                      ...prev,
                                      [group.id]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ',') {
                                      e.preventDefault();
                                      addOptionValue(
                                        group.id,
                                        newValInputs[group.id] || '',
                                      );
                                    }
                                  }}
                                  onBlur={() => {
                                    if (newValInputs[group.id]?.trim()) {
                                      addOptionValue(
                                        group.id,
                                        newValInputs[group.id],
                                      );
                                    }
                                  }}
                                  className="h-9 text-xs bg-white rounded-lg border-[#E5E0D5]"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Card Bottom Actions: Delete (light red pill) & Done (solid black pill) */}
                        <div className="flex items-center justify-between pt-2">
                          <button
                            type="button"
                            onClick={() => removeOption(group.id)}
                            className="px-4 py-1.5 text-xs font-semibold text-[#DC2626] bg-[#FEE2E2] hover:bg-[#FECACA] rounded-full transition-colors cursor-pointer"
                          >
                            Delete
                          </button>

                          <button
                            type="button"
                            onClick={() => setOptionEditing(group.id, false)}
                            className="px-5 py-1.5 text-xs font-semibold text-white bg-[#18181B] hover:bg-neutral-800 rounded-full transition-colors shadow-xs cursor-pointer"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* COLLAPSED SUMMARY STATE */
                      <div
                        onClick={() => setOptionEditing(group.id, true)}
                        className="flex items-center justify-between cursor-pointer group py-1"
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical className="h-4 w-4 text-[#64748B]/60 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-[#252A25]">
                                {group.name}
                              </p>
                              {isColor && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#0284C7] bg-[#E0F2FE] px-1.5 py-0.2 rounded">
                                  <Palette className="h-2.5 w-2.5" />
                                  Color
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {group.values.map((v, vIdx) => (
                                <span
                                  key={`${v}-${vIdx}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6B756D] bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200"
                                >
                                  {isColor && (
                                    <span
                                      className="h-2.5 w-2.5 rounded-xs shrink-0 border border-black/10"
                                      style={{
                                        backgroundColor: resolveColorSwatch(v),
                                      }}
                                    />
                                  )}
                                  {v}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOptionEditing(group.id, true);
                          }}
                          className="text-xs font-semibold text-[#163A2B] hover:underline cursor-pointer px-2 py-1"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 2. Full-Width '+ Add another option' Row */}
            <div className="p-2 sm:p-3 bg-white">
              <button
                type="button"
                onClick={addOption}
                className="w-full flex items-center justify-start gap-2 px-3 py-2 text-xs font-semibold text-[#252A25] hover:bg-neutral-50 rounded-xl transition-colors cursor-pointer"
              >
                <PlusCircle className="h-4 w-4 text-[#252A25]" />
                <span>Add another option</span>
              </button>
            </div>

            {/* 3. Group by & Search Toolbar */}
            <div className="p-3.5 px-4 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-[#64748B]">Group by</span>
                <div className="relative">
                  <select
                    value={effectiveGroupBy}
                    onChange={(e) => setGroupBy(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-1.5 text-xs font-semibold text-[#1E293B] bg-neutral-100/80 hover:bg-neutral-200/80 border border-[#E2E8F0] rounded-full focus:outline-none focus:ring-1 focus:ring-[#163A2B] cursor-pointer"
                  >
                    <option value="none">None (All variants)</option>
                    {optionGroups
                      .filter((g) => g.name.trim() !== '')
                      .map((g) => (
                        <option key={g.id} value={g.name}>
                          {g.name}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="h-3.5 w-3.5 text-[#64748B] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                {showSearchInput ? (
                  <div className="relative w-52 sm:w-64">
                    <Input
                      type="text"
                      placeholder="Search variants..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      leftIcon={<Search className="h-3.5 w-3.5" />}
                      className="h-8 text-xs bg-white rounded-full border-[#E5E0D5]"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setShowSearchInput(false);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[#64748B]">
                    <button
                      type="button"
                      onClick={() => setShowSearchInput(true)}
                      className="p-1.5 rounded-full hover:bg-neutral-100 hover:text-neutral-800 transition-colors cursor-pointer"
                      title="Search variants"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // Toggle search or filter
                        setShowSearchInput(true);
                      }}
                      className="p-1.5 rounded-full hover:bg-neutral-100 hover:text-neutral-800 transition-colors cursor-pointer"
                      title="Filter variants"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Bulk Action Bar (when rows are selected) */}
            {selectedIndices.size > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#163A2B]/5 px-4 py-2.5 border-b border-[#163A2B]/15 text-xs">
                <span className="font-semibold text-[#163A2B]">
                  {selectedIndices.size} variant
                  {selectedIndices.size > 1 ? 's' : ''} selected
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      placeholder="Price ($/৳)"
                      value={bulkPrice}
                      onChange={(e) => setBulkPrice(e.target.value)}
                      className="h-7 w-24 text-xs bg-white rounded-full"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={applyBulkPrice}
                      className="h-7 px-2.5 text-xs rounded-full"
                    >
                      Set Price
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      placeholder="Stock"
                      value={bulkStock}
                      onChange={(e) => setBulkStock(e.target.value)}
                      className="h-7 w-20 text-xs bg-white rounded-full"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={applyBulkStock}
                      className="h-7 px-2.5 text-xs rounded-full"
                    >
                      Set Stock
                    </Button>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={deleteSelected}
                    className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 rounded-full"
                  >
                    Delete Selected
                  </Button>
                </div>
              </div>
            )}

            {/* 5. Variants Matrix Table */}
            {variants.length === 0 ? (
              <div className="p-8 text-center bg-white space-y-2">
                <Layers className="h-8 w-8 text-[#6B756D]/40 mx-auto" />
                <p className="text-xs font-semibold text-[#252A25]">
                  No variant combinations configured yet
                </p>
                <p className="text-[11px] text-[#6B756D] max-w-sm mx-auto">
                  Add option values above and click &ldquo;Done&rdquo; to
                  automatically build the variant matrix.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E0D5] bg-neutral-50/50 text-[#64748B] font-medium">
                      <th className="py-2.5 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={
                            variants.length > 0 &&
                            selectedIndices.size === variants.length
                          }
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#163A2B] focus:ring-[#163A2B] cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3 min-w-[200px]">Variant</th>
                      <th className="py-2.5 px-3 min-w-[130px]">Price</th>
                      <th className="py-2.5 px-3 min-w-[110px]">
                        <span className="underline decoration-dotted underline-offset-4 cursor-help">
                          Available
                        </span>
                      </th>
                      <th className="py-2.5 px-3 min-w-[120px] text-right">
                        <span className="inline-flex items-center gap-1 cursor-pointer">
                          Publishing <ChevronDown className="h-3.5 w-3.5" />
                        </span>
                      </th>
                      <th className="py-2.5 px-3 w-8 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E0D5]/70 bg-white">
                    {groupedData
                      ? /* GROUPED RENDERING BY OPTION (e.g. Color) */
                        Object.entries(groupedData).map(
                          ([groupTitle, groupInfo]) => {
                            const isExpanded =
                              expandedGroups[groupTitle] !== false; // Default expanded
                            const groupCount = groupInfo.variants.length;
                            const groupIndices = groupInfo.variants.map(
                              (v) => v.originalIndex,
                            );
                            const isGroupAllSelected = groupIndices.every((i) =>
                              selectedIndices.has(i),
                            );

                            // Group total available stock
                            const groupAvailable = groupInfo.variants.reduce(
                              (acc, cur) =>
                                acc + (cur.variant.inventoryQuantity ?? 0),
                              0,
                            );

                            // Primary price for group
                            const firstPrice =
                              groupInfo.variants[0]?.variant.priceBDT;

                            // Check if group has a shared image
                            const groupImage = groupInfo.variants.find(
                              (v) => v.variant.imageUrl,
                            )?.variant.imageUrl;

                            return (
                              <React.Fragment key={groupTitle}>
                                {/* Parent Group Header Row */}
                                <tr className="hover:bg-neutral-50/60 font-semibold transition-colors">
                                  <td className="py-3 px-4">
                                    <input
                                      type="checkbox"
                                      checked={isGroupAllSelected}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        groupIndices.forEach((idx) =>
                                          toggleSelectVariant(idx, checked),
                                        );
                                      }}
                                      className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#163A2B] focus:ring-[#163A2B] cursor-pointer"
                                    />
                                  </td>

                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-3">
                                      {/* Media Thumbnail Box */}
                                      <div
                                        onClick={() => {
                                          setMediaPickerTarget({
                                            type: 'group',
                                            groupName: groupTitle,
                                          });
                                          setIsMediaPickerOpen(true);
                                        }}
                                        className="h-10 w-10 rounded-xl border border-dashed border-[#CBD5E1] bg-white flex items-center justify-center text-[#3B82F6] hover:border-[#3B82F6] overflow-hidden transition-colors cursor-pointer shrink-0 shadow-2xs group/thumb"
                                        title="Click to assign image to group"
                                      >
                                        {groupImage ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={groupImage}
                                            alt={groupTitle}
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <ImageIcon className="h-4 w-4 text-[#3B82F6] group-hover/thumb:scale-110 transition-transform" />
                                        )}
                                      </div>

                                      <div
                                        onClick={() =>
                                          toggleGroupExpand(groupTitle)
                                        }
                                        className="cursor-pointer min-w-0"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className="font-bold text-[#1E293B] text-xs truncate max-w-[200px]"
                                            title={groupTitle}
                                          >
                                            {groupTitle}
                                          </span>
                                          <span className="h-1.5 w-1.5 rounded-full bg-[#1E293B]/60 shrink-0" />
                                        </div>
                                        <p className="text-[11px] text-[#64748B] font-normal">
                                          {groupCount}{' '}
                                          {groupCount === 1
                                            ? 'variant'
                                            : 'variants'}
                                        </p>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Group Price input (updates all items in group) */}
                                  <td className="py-2.5 px-3">
                                    <div className="relative w-28">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#64748B]">
                                        ৳
                                      </span>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={
                                          firstPrice !== undefined
                                            ? firstPrice
                                            : ''
                                        }
                                        onChange={(e) => {
                                          const val =
                                            e.target.value !== ''
                                              ? parseFloat(e.target.value)
                                              : undefined;
                                          groupIndices.forEach((idx) =>
                                            updateVariantRow(
                                              idx,
                                              'priceBDT',
                                              val,
                                            ),
                                          );
                                        }}
                                        placeholder={String(basePrice || 99)}
                                        className="h-8 pl-6 text-xs font-medium text-[#1E293B] bg-white rounded-lg border-[#E2E8F0]"
                                      />
                                    </div>
                                  </td>

                                  {/* Group Available Total */}
                                  <td className="py-2.5 px-3">
                                    <div className="w-20">
                                      <Input
                                        type="number"
                                        readOnly
                                        value={groupAvailable}
                                        className="h-8 text-xs text-center bg-white font-medium text-[#1E293B] rounded-lg border-[#E2E8F0] cursor-default"
                                      />
                                    </div>
                                  </td>

                                  {/* Publishing stats: Share 3, File 0, and expand chevron */}
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="inline-flex items-center justify-end gap-2 text-[#64748B] text-[11px]">
                                      <span className="inline-flex items-center gap-1 font-medium">
                                        <Share2 className="h-3.5 w-3.5" /> 3
                                      </span>
                                      <span className="inline-flex items-center gap-1 font-medium">
                                        <FileText className="h-3.5 w-3.5" /> 0
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          toggleGroupExpand(groupTitle)
                                        }
                                        className="p-1 hover:text-[#18181B] transition-colors cursor-pointer"
                                      >
                                        <ChevronDown
                                          className={`h-4 w-4 transition-transform ${
                                            isExpanded ? '' : '-rotate-90'
                                          }`}
                                        />
                                      </button>
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-3 text-right"></td>
                                </tr>

                                {/* Expanded Sub-Variant Rows */}
                                {isExpanded &&
                                  groupInfo.variants.map(
                                    ({ variant, originalIndex }) => (
                                      <tr
                                        key={
                                          variant.id || `sub-${originalIndex}`
                                        }
                                        className="bg-neutral-50/40 hover:bg-neutral-50 transition-colors"
                                      >
                                        <td className="py-2.5 px-4 pl-8">
                                          <input
                                            type="checkbox"
                                            checked={selectedIndices.has(
                                              originalIndex,
                                            )}
                                            onChange={(e) =>
                                              toggleSelectVariant(
                                                originalIndex,
                                                e.target.checked,
                                              )
                                            }
                                            className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#163A2B] focus:ring-[#163A2B] cursor-pointer"
                                          />
                                        </td>

                                        <td className="py-2.5 px-3 pl-8">
                                          <div className="flex items-center gap-2.5">
                                            {/* Individual sub-variant thumbnail */}
                                            <div
                                              onClick={() => {
                                                setMediaPickerTarget({
                                                  type: 'variant',
                                                  variantIndex: originalIndex,
                                                });
                                                setIsMediaPickerOpen(true);
                                              }}
                                              className="h-7 w-7 rounded-lg border border-dashed border-[#CBD5E1] bg-white flex items-center justify-center text-[#3B82F6] hover:border-[#3B82F6] overflow-hidden transition-colors cursor-pointer shrink-0"
                                              title="Set image for this variant"
                                            >
                                              {variant.imageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                  src={variant.imageUrl}
                                                  alt={variant.name || ''}
                                                  className="h-full w-full object-cover"
                                                />
                                              ) : (
                                                <ImageIcon className="h-3 w-3 text-[#3B82F6]" />
                                              )}
                                            </div>

                                            <span
                                              className="font-medium text-[#252A25] text-xs truncate max-w-[180px]"
                                              title={variant.name}
                                            >
                                              {variant.name}
                                            </span>
                                          </div>
                                        </td>

                                        {/* Sub-variant Price */}
                                        <td className="py-2 px-3">
                                          <div className="relative w-28">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#64748B]">
                                              ৳
                                            </span>
                                            <Input
                                              type="number"
                                              min="0"
                                              step="any"
                                              value={
                                                variant.priceBDT !== undefined
                                                  ? variant.priceBDT
                                                  : ''
                                              }
                                              onChange={(e) =>
                                                updateVariantRow(
                                                  originalIndex,
                                                  'priceBDT',
                                                  e.target.value !== ''
                                                    ? parseFloat(e.target.value)
                                                    : undefined,
                                                )
                                              }
                                              placeholder={String(
                                                basePrice || 99,
                                              )}
                                              className="h-8 pl-6 text-xs font-medium text-[#1E293B] bg-white rounded-lg border-[#E2E8F0]"
                                            />
                                          </div>
                                        </td>

                                        {/* Sub-variant Available */}
                                        <td className="py-2 px-3">
                                          <div className="w-20">
                                            <Input
                                              type="number"
                                              min="0"
                                              step="1"
                                              value={
                                                variant.inventoryQuantity !==
                                                undefined
                                                  ? variant.inventoryQuantity
                                                  : 0
                                              }
                                              onChange={(e) =>
                                                updateVariantRow(
                                                  originalIndex,
                                                  'inventoryQuantity',
                                                  e.target.value !== ''
                                                    ? parseInt(
                                                        e.target.value,
                                                        10,
                                                      )
                                                    : 0,
                                                )
                                              }
                                              className="h-8 text-xs text-center bg-white rounded-lg border-[#E2E8F0]"
                                            />
                                          </div>
                                        </td>

                                        {/* Sub-variant SKU */}
                                        <td className="py-2 px-3 text-right">
                                          <Input
                                            type="text"
                                            value={variant.sku || ''}
                                            onChange={(e) =>
                                              updateVariantRow(
                                                originalIndex,
                                                'sku',
                                                e.target.value.toUpperCase(),
                                              )
                                            }
                                            placeholder="SKU"
                                            className="h-8 text-xs font-mono uppercase bg-white rounded-lg border-[#E2E8F0]"
                                          />
                                        </td>

                                        {/* Delete Sub-variant */}
                                        <td className="py-2 px-3 text-right">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              removeVariantRow(originalIndex)
                                            }
                                            className="p-1 text-[#64748B] hover:text-[#DC2626] transition-colors rounded-full hover:bg-red-50 cursor-pointer"
                                            title="Delete Variant"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    ),
                                  )}
                              </React.Fragment>
                            );
                          },
                        )
                      : /* FLAT RENDERING (NO GROUPING) */
                        filteredVariants.map((variant, idx) => (
                          <tr
                            key={variant.id || `flat-${idx}`}
                            className="hover:bg-neutral-50/60 transition-colors"
                          >
                            <td className="py-2.5 px-4">
                              <input
                                type="checkbox"
                                checked={selectedIndices.has(idx)}
                                onChange={(e) =>
                                  toggleSelectVariant(idx, e.target.checked)
                                }
                                className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#163A2B] focus:ring-[#163A2B] cursor-pointer"
                              />
                            </td>

                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-3">
                                <div
                                  onClick={() => {
                                    setMediaPickerTarget({
                                      type: 'variant',
                                      variantIndex: idx,
                                    });
                                    setIsMediaPickerOpen(true);
                                  }}
                                  className="h-9 w-9 rounded-xl border border-dashed border-[#CBD5E1] bg-white flex items-center justify-center text-[#3B82F6] hover:border-[#3B82F6] overflow-hidden transition-colors cursor-pointer shrink-0"
                                >
                                  {variant.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={variant.imageUrl}
                                      alt={variant.name || ''}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <ImageIcon className="h-4 w-4 text-[#3B82F6]" />
                                  )}
                                </div>
                                <span
                                  className="font-semibold text-[#1E293B] truncate max-w-[220px]"
                                  title={variant.name}
                                >
                                  {variant.name}
                                </span>
                              </div>
                            </td>

                            <td className="py-2 px-3">
                              <div className="relative w-28">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#64748B]">
                                  ৳
                                </span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={
                                    variant.priceBDT !== undefined
                                      ? variant.priceBDT
                                      : ''
                                  }
                                  onChange={(e) =>
                                    updateVariantRow(
                                      idx,
                                      'priceBDT',
                                      e.target.value !== ''
                                        ? parseFloat(e.target.value)
                                        : undefined,
                                    )
                                  }
                                  placeholder={String(basePrice || 99)}
                                  className="h-8 pl-6 text-xs font-medium text-[#1E293B] bg-white rounded-lg border-[#E2E8F0]"
                                />
                              </div>
                            </td>

                            <td className="py-2 px-3">
                              <div className="w-20">
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={
                                    variant.inventoryQuantity !== undefined
                                      ? variant.inventoryQuantity
                                      : 0
                                  }
                                  onChange={(e) =>
                                    updateVariantRow(
                                      idx,
                                      'inventoryQuantity',
                                      e.target.value !== ''
                                        ? parseInt(e.target.value, 10)
                                        : 0,
                                    )
                                  }
                                  className="h-8 text-xs text-center bg-white rounded-lg border-[#E2E8F0]"
                                />
                              </div>
                            </td>

                            <td className="py-2 px-3 text-right">
                              <Input
                                type="text"
                                value={variant.sku || ''}
                                onChange={(e) =>
                                  updateVariantRow(
                                    idx,
                                    'sku',
                                    e.target.value.toUpperCase(),
                                  )
                                }
                                placeholder="SKU"
                                className="h-8 text-xs font-mono uppercase bg-white rounded-lg border-[#E2E8F0]"
                              />
                            </td>

                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => removeVariantRow(idx)}
                                className="p-1 text-[#64748B] hover:text-[#DC2626] transition-colors rounded-full hover:bg-red-50 cursor-pointer"
                                title="Delete Variant"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 6. Table Footer with Location Summary */}
            <div className="px-4 py-3 bg-white flex items-center justify-between text-xs text-[#64748B]">
              <span>
                Total inventory at Shop location:{' '}
                <strong className="text-[#1E293B] font-semibold">
                  {totalStock} available
                </strong>
              </span>

              <span className="font-medium text-[11px]">
                {variants.length} total{' '}
                {variants.length === 1 ? 'variant' : 'variants'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Media Picker Modal for Variant Thumbnail Assignment */}
      <MediaPickerModal
        isOpen={isMediaPickerOpen}
        onClose={() => {
          setIsMediaPickerOpen(false);
          setMediaPickerTarget(null);
        }}
        onSelect={handleMediaSelected}
        multiple={false}
      />
    </div>
  );
}
